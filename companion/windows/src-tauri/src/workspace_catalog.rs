//! The catalog binds stable UUIDs to selected canonical paths. Only bounded
//! metadata leaves the PC; resolution always rechecks the native selection.
use std::{fs,io::Read,path::{Path,PathBuf},process::{Command,Stdio},sync::Mutex};
#[cfg(not(test))]use std::collections::BTreeMap;
use serde::{Serialize,Deserialize};
use uuid::Uuid;
#[cfg(not(test))]
use tauri::{AppHandle,Manager};
use chrono::Utc;

static CATALOG_LOCK:Mutex<()>=Mutex::new(());
#[derive(Clone,Serialize,Deserialize)]
struct SavedWorkspace {id:String,path:PathBuf}
#[derive(Clone,Debug,Serialize)]
#[serde(rename_all="camelCase")]
pub struct WorkspaceDescriptor {pub id:String,pub name:String,pub repository:Option<String>,pub vercel_project_id:Option<String>,pub branch:Option<String>,pub commit:Option<String>,pub dirty_files:Option<usize>}
fn store()->PathBuf {crate::settings::config_dir().join("novo-workspaces.json")}
fn contained(path:&Path,roots:&[(String,PathBuf)])->bool {roots.iter().any(|(_,root)|path.starts_with(root))}
fn name(path:&Path)->String {let value=path.file_name().unwrap_or_default().to_string_lossy();let clean:String=value.chars().filter(|ch|!ch.is_control()&&!"/\\:".contains(*ch)).take(100).collect();if clean.trim().is_empty(){"Proyecto local".into()}else{clean}}
fn discover(dir:&Path,root:&Path,depth:usize,budget:&mut usize,paths:&mut Vec<PathBuf>){
    if depth>3||*budget>400||paths.len()>=24{return}
    if depth==0||dir.join(".git").exists()||dir.join("package.json").is_file()||dir.join("Cargo.toml").is_file(){paths.push(dir.to_path_buf())}
    let Ok(entries)=fs::read_dir(dir) else{return};
    for entry in entries.filter_map(Result::ok){
        *budget+=1;if *budget>400||paths.len()>=24{return}
        let file=entry.file_name().to_string_lossy().to_lowercase();
        if file.starts_with('.')||["node_modules","target","dist","build","vendor","venv"].contains(&file.as_str()){continue}
        if entry.file_type().is_ok_and(|kind|kind.is_dir()&&!kind.is_symlink()){
            if let Ok(path)=entry.path().canonicalize(){if path.starts_with(root){discover(&path,root,depth+1,budget,paths)}}
        }
    }
}
fn git(path:&Path,args:&[&str])->Option<String>{
    let mut cmd=Command::new("git");cmd.args(["--no-optional-locks","-c","core.fsmonitor=false","-c","core.hooksPath=","-c","core.untrackedCache=false","-C"]).arg(path).args(args);
    let mut child=crate::platform::no_console(&mut cmd).stdin(Stdio::null()).stdout(Stdio::piped()).stderr(Stdio::null()).spawn().ok()?;
    let stdout=child.stdout.take()?;
    let reader=std::thread::spawn(move||{let mut bytes=vec![];stdout.take(128*1024+1).read_to_end(&mut bytes).ok()?;Some(bytes)});
    let deadline=std::time::Instant::now()+std::time::Duration::from_secs(3);
    let success=loop{match child.try_wait(){Ok(Some(status))=>break status.success(),Ok(None) if std::time::Instant::now()<deadline=>std::thread::sleep(std::time::Duration::from_millis(25)),_=>{let _=child.kill();let _=child.wait();break false}}};
    let bytes=reader.join().ok()??;
    if !success||bytes.len()>128*1024{return None}
    String::from_utf8(bytes).ok().map(|s|s.trim().to_string())
}
fn describe(saved:&SavedWorkspace)->WorkspaceDescriptor {
    let repository=git(&saved.path,&["config","--get","remote.origin.url"]).and_then(|url|crate::context_folders::github_repository(&url));
    let project_file=saved.path.join(".vercel/project.json");
    let vercel_project_id=project_file.canonicalize().ok().filter(|file|file.starts_with(&saved.path)).and_then(|file|fs::metadata(&file).ok().filter(|meta|meta.len()<32768).and_then(|_|fs::read(file).ok())).and_then(|bytes|serde_json::from_slice::<serde_json::Value>(&bytes).ok()).and_then(|value|value["projectId"].as_str().filter(|id|id.len()<128&&id.chars().all(|ch|ch.is_ascii_alphanumeric()||"_-".contains(ch))).map(str::to_string));
    let branch=git(&saved.path,&["symbolic-ref","--short","HEAD"]).filter(|v|v.len()<200&&v.chars().all(|ch|ch.is_ascii_alphanumeric()||"_-./".contains(ch)));
    let commit=git(&saved.path,&["rev-parse","HEAD"]).filter(|v|[40,64].contains(&v.len())&&v.chars().all(|ch|ch.is_ascii_hexdigit()));
    let dirty_files=git(&saved.path,&["status","--porcelain","--untracked-files=no"]).map(|v|if v.is_empty(){0}else{v.lines().count()});
    WorkspaceDescriptor{id:saved.id.clone(),name:name(&saved.path),repository,vercel_project_id,branch,commit,dirty_files}
}
pub fn inventory()->Result<Vec<WorkspaceDescriptor>,String>{
    let _lock=CATALOG_LOCK.lock().map_err(|_|"catalog_unavailable")?;
    let roots=crate::context_folders::selected_paths()?;
    let mut old:Vec<SavedWorkspace>=match fs::read(store()){Ok(bytes)=>serde_json::from_slice(&bytes).map_err(|_|"catalog_unavailable")?,Err(e) if e.kind()==std::io::ErrorKind::NotFound=>vec![],Err(_)=>return Err("catalog_unavailable".into())};
    let mut paths=vec![];let mut budget=0;
    for (_,root) in &roots{discover(root,root,0,&mut budget,&mut paths)}
    paths.sort();paths.dedup();
    let current:Vec<_>=paths.into_iter().map(|path|old.iter().find(|entry|entry.path==path).cloned().unwrap_or(SavedWorkspace{id:Uuid::new_v4().to_string(),path})).collect();
    // Retain identities while access is enforced separately at resolution.
    old.retain(|entry|!current.iter().any(|active|active.id==entry.id));
    old.splice(0..0,current.iter().cloned());
    old.truncate(256);
    let dir=crate::settings::config_dir();crate::platform::ensure_private_dir(&dir).map_err(|_|"catalog_unavailable")?;
    let temp=dir.join(format!("novo-workspaces-{}.tmp",Uuid::new_v4()));
    fs::write(&temp,serde_json::to_vec(&old).map_err(|_|"catalog_unavailable")?).map_err(|_|"catalog_unavailable")?;
    fs::rename(&temp,store()).map_err(|_|"catalog_unavailable")?;
    Ok(current.iter().map(describe).collect())
}
pub fn resolve_workspace(id:&str)->Result<PathBuf,String>{
    if Uuid::parse_str(id).is_err(){return Err("workspace_not_authorized".into())}
    let _lock=CATALOG_LOCK.lock().map_err(|_|"catalog_unavailable")?;
    let saved:Vec<SavedWorkspace>=serde_json::from_slice(&fs::read(store()).map_err(|_|"workspace_not_authorized")?).map_err(|_|"catalog_unavailable")?;
    let path=saved.iter().find(|item|item.id==id).ok_or("workspace_not_authorized")?.path.canonicalize().map_err(|_|"workspace_not_authorized")?;
    if !contained(&path,&crate::context_folders::selected_paths()?){return Err("workspace_not_authorized".into())}
    Ok(path)
}
fn observations(workspaces:&[WorkspaceDescriptor])->Vec<serde_json::Value>{
    let at=Utc::now().to_rfc3339();
    workspaces.iter().map(|w|{let mut value=serde_json::json!({"kind":"folder","sourceKey":w.id,"title":w.name,"observedAt":at,"facts":{"workspaceId":w.id}});if let Some(v)=&w.repository{value["repository"]=v.clone().into()}if let Some(v)=&w.vercel_project_id{value["vercelProjectId"]=v.clone().into()}if let Some(v)=&w.branch{value["facts"]["branch"]=v.clone().into()}if let Some(v)=&w.commit{value["facts"]["commit"]=v.clone().into()}if let Some(v)=w.dirty_files{value["facts"]["dirtyFiles"]=v.into()}value}).collect()
}
#[cfg(not(test))]
pub fn start(app:AppHandle){
    tauri::async_runtime::spawn(async move{
        let mut signatures=BTreeMap::<String,(String,std::time::Instant)>::new();
        let mut previous_status="";
        loop{
            tokio::time::sleep(std::time::Duration::from_secs(60)).await;
            let shared=app.state::<crate::Shared>();
            let enabled=shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).novo_local_connections;
            let Ok(authorization)=crate::novo_account::verify_account(&shared).await else{
                if previous_status!="authorization_unavailable"{crate::log::line("Project context sync: authorization_unavailable");previous_status="authorization_unavailable";}continue
            };
            if !authorization.capabilities.work_context_write{
                if previous_status!="work_context_permission_required"{crate::log::line("Project context sync: work_context_permission_required");previous_status="work_context_permission_required";}continue
            }
            let Ok(access)=crate::novo_account::access_context(&shared).await else{continue};
            let mut workspaces=if enabled{match tauri::async_runtime::spawn_blocking(inventory).await{Ok(Ok(values))=>values,_=>continue}}else{vec![]};
            if !shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner).novo_local_connections{workspaces.clear()}
            workspaces.retain(|workspace|resolve_workspace(&workspace.id).is_ok());
            let signature=serde_json::to_string(&workspaces).unwrap_or_default();
            let key=format!("{}:{}:{}",access.origin,authorization.user.id,access.epoch);
            if signatures.get(&key).is_some_and(|(old,at)|old==&signature&&at.elapsed().as_secs()<600){continue}
            if shared.novo_account.lock().unwrap_or_else(std::sync::PoisonError::into_inner).epoch!=access.epoch{continue}
            let Ok(client)=crate::novo_account::client(20)else{continue};
            let body=serde_json::json!({"observations":observations(&workspaces),"replaceInventory":true});
            if let Ok(response)=client.post(format!("{}/api/companion/project-observations",access.origin)).bearer_auth(&access.token).header("X-Novo-Device-Id",access.device_id).json(&body).send().await{
                if response.status().is_success(){signatures.clear();signatures.insert(key,(signature,std::time::Instant::now()));if previous_status!="synced"{crate::log::line("Project context sync: synced");previous_status="synced";}}
            }
        }
    });
}
#[cfg(test)]pub fn start(_app:tauri::AppHandle){}
#[cfg(test)]mod tests{
    use super::*;
    #[test]fn emitted_metadata_has_no_paths_contents_or_credentials(){let descriptor=WorkspaceDescriptor{id:Uuid::new_v4().to_string(),name:"Novo".into(),repository:Some("owner/novo".into()),vercel_project_id:None,branch:Some("main".into()),commit:None,dirty_files:Some(2)};let value=serde_json::to_string(&observations(&[descriptor])).unwrap();assert!(!value.contains("path"));assert!(!value.contains("token"));assert!(value.contains("workspaceId"));}
    #[test]fn workspace_resolution_rejects_unselected_and_escaping_paths(){let root=PathBuf::from("C:/chosen");assert!(contained(&root.join("project"),&[("id".into(),root.clone())]));assert!(!contained(&PathBuf::from("C:/other/project"),&[("id".into(),root)]));assert!(resolve_workspace("untrusted-shell-text").is_err());}
}
