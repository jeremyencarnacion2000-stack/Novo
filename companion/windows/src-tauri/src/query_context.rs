//! Live, read-only lookups. Local provider keys never leave the native process.
use serde_json::{json,Value};
use crate::context_folders::{LocalContextResult,ProjectHint};

fn text(value:&Value)->String {value.as_str().unwrap_or_default().chars().take(180).collect()}
fn repository(value:&str)->Option<String>{crate::context_folders::github_repository(&format!("https://github.com/{value}"))}
fn id(value:&Value)->Option<String>{value.as_str().filter(|id|!id.is_empty()&&id.len()<=128&&id.chars().all(|c|c.is_ascii_alphanumeric()||"_-".contains(c))).map(str::to_string)}
fn relevant(name:&str,query:&str,hints:&[ProjectHint])->bool{
    let name=name.to_lowercase();
    query.to_lowercase().contains(&name)||hints.iter().any(|hint|hint.name.to_lowercase()==name||hint.repository.as_ref().is_some_and(|repo|repo.to_lowercase()==name))
}
async fn get(client:&reqwest::Client,url:reqwest::Url,token:&str)->Result<Value,()> {
    let response=client.get(url).bearer_auth(token).header("Accept","application/json").send().await.map_err(|_|())?;
    crate::novo_account::read_json(response,1024*1024).await.map_err(|_|())
}
async fn github(hints:&[ProjectHint],query:&str)->(Vec<ProjectHint>,Value){
    let Some(token)=crate::secrets::get("github-token") else{return (vec![],json!({"connected":false}));};
    let Ok(client)=reqwest::Client::builder().user_agent("Novo-Companion").timeout(std::time::Duration::from_secs(4)).build() else{return (vec![],json!({"error":"unavailable"}));};
    let result=async {
        let payload=get(&client,reqwest::Url::parse("https://api.github.com/user/repos?sort=pushed&per_page=100").unwrap(),&token).await?;
        let repos=payload.as_array().ok_or(())?;
        let mut names:Vec<String>=hints.iter().filter_map(|h|h.repository.clone()).collect();
        names.extend(repos.iter().filter_map(|repo|repo["full_name"].as_str()).filter_map(repository).filter(|name|relevant(name,query,hints)||relevant(name.rsplit('/').next().unwrap_or(name),query,hints)));
        if names.is_empty(){names.extend(repos.iter().take(2).filter_map(|repo|repo["full_name"].as_str()).filter_map(repository));}
        names.sort_by_key(|name|(!relevant(name.rsplit('/').next().unwrap_or(name),query,&[]),name.clone()));names.dedup();names.truncate(2);
        let mut summaries=vec![];let mut observed=vec![];
        for name in names {
            let base=format!("https://api.github.com/repos/{name}");
            let (pulls,commits)=tokio::join!(get(&client,reqwest::Url::parse(&format!("{base}/pulls?state=open&sort=updated&per_page=5")).unwrap(),&token),get(&client,reqwest::Url::parse(&format!("{base}/commits?per_page=1")).unwrap(),&token));
            let pulls=pulls.ok().and_then(|v|v.as_array().cloned()).map(|rows|rows.iter().take(5).map(|p|json!({"number":p["number"].as_u64(),"title":text(&p["title"])})).collect::<Vec<_>>());
            let sha=commits.ok().and_then(|v|v.as_array().and_then(|rows|rows.first()).map(|c|text(&c["sha"])));
            if pulls.is_none()&&sha.is_none(){summaries.push(json!({"repository":name,"error":"lookup_unavailable"}));continue;}
            observed.push(ProjectHint{source:"github".into(),name:name.clone(),repository:Some(name.clone()),vercel_project_id:None});
            summaries.push(json!({"repository":name,"recentOpenPullRequests":pulls,"latestCommit":sha}));
        }
        Ok::<_,()>((observed,json!({"connected":true,"repositories":summaries})))
    }.await;
    result.unwrap_or_else(|_|(vec![],json!({"connected":true,"error":"lookup_unavailable"})))
}
async fn vercel(hints:&[ProjectHint],query:&str)->(Vec<ProjectHint>,Value){
    let Some(token)=crate::secrets::get("vercel-token") else{return (vec![],json!({"connected":false}));};
    let Ok(client)=reqwest::Client::builder().timeout(std::time::Duration::from_secs(4)).build() else{return (vec![],json!({"error":"unavailable"}));};
    let result=async{
        let payload=get(&client,reqwest::Url::parse("https://api.vercel.com/v10/projects?limit=100").unwrap(),&token).await?;
        let projects=payload["projects"].as_array().ok_or(())?;
        let mut choices:Vec<_>=projects.iter().filter(|p|relevant(&text(&p["name"]),query,hints)||hints.iter().any(|h|h.vercel_project_id.as_deref()==p["id"].as_str()||h.repository.as_ref().is_some_and(|r|*r==format!("{}/{}",text(&p["link"]["org"]),text(&p["link"]["repo"])).to_lowercase()))).collect();
        if choices.is_empty(){choices.extend(projects.iter().take(2));}choices.truncate(2);
        let mut observed=vec![];let mut summaries=vec![];
        for project in choices{
            let Some(project_id)=id(&project["id"]) else{continue;};
            let name=text(&project["name"]);
            let repo=repository(&format!("{}/{}",text(&project["link"]["org"]),text(&project["link"]["repo"])));
            observed.push(ProjectHint{source:"vercel".into(),name:name.chars().take(120).collect(),repository:repo,vercel_project_id:Some(project_id.clone())});
            let mut url=reqwest::Url::parse("https://api.vercel.com/v6/deployments").unwrap();url.query_pairs_mut().append_pair("projectId",&project_id).append_pair("limit","3");
            let deployments=get(&client,url,&token).await.ok().and_then(|v|v["deployments"].as_array().cloned()).map(|rows|rows.iter().take(3).map(|d|json!({"state":text(&d["readyState"]),"createdAt":d["createdAt"].as_u64(),"id":id(&d["uid"])})).collect::<Vec<_>>());
            summaries.push(json!({"project":name,"projectId":project_id,"deployments":deployments}));
        }
        Ok::<_,()>((observed,json!({"connected":true,"projects":summaries})))
    }.await;
    result.unwrap_or_else(|_|(vec![],json!({"connected":true,"error":"lookup_unavailable"})))
}
pub async fn augment(result:&mut LocalContextResult,query:&str){
    let (github,vercel)=tokio::join!(github(&result.project_hints,query),vercel(&result.project_hints,query));
    result.project_hints.extend(github.0);result.project_hints.extend(vercel.0);result.project_hints.truncate(32);
    result.connections.insert("github".into(),github.1.to_string().chars().take(6000).collect());
    result.connections.insert("vercel".into(),vercel.1.to_string().chars().take(6000).collect());
}
