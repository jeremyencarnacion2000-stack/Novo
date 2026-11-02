use super::process;
use std::{
    fs,
    path::{Path, PathBuf},
};

pub fn quoted(value: &str) -> String {
    serde_json::to_string(
        &value
            .strip_prefix("\\\\?\\")
            .unwrap_or(value)
            .replace('\\', "/"),
    )
    .unwrap_or_else(|_| "\"\"".into())
}
// CLI override keys split on dots; path keys belong inside one TOML table value.
pub fn permission_args(workspace: &Path, writable: bool, readable: &[PathBuf]) -> Vec<String> {
    let mut entries = vec![
        "\":minimal\"=\"read\"".into(),
        format!("{}=\"{}\"", quoted(&workspace.to_string_lossy()), if writable { "write" } else { "read" }),
    ];
    for path in readable {
        entries.push(format!("{}=\"read\"", quoted(&path.to_string_lossy())));
    }
    for suffix in [
        ".git",
        ".codex",
        ".agents",
        ".claude",
        "**/.env*",
        "**/credentials*",
        "**/auth.json",
    ] {
        entries.push(format!("{}=\"deny\"", quoted(&format!("{}/{suffix}", workspace.to_string_lossy()))));
    }
    vec![
        "-c".into(),
        "default_permissions=\"novo\"".into(),
        "-c".into(),
        format!("permissions.novo.filesystem={{{}}}", entries.join(",")),
        "-c".into(),
        "permissions.novo.network.enabled=false".into(),
        "-c".into(),
        "windows.sandbox=\"elevated\"".into(),
        "-c".into(),
        "approval_policy=\"never\"".into(),
        "-c".into(),
        "shell_environment_policy.inherit=\"none\"".into(),
    ]
}
pub fn agent_args(workspace: &Path, model: &str, writable: bool, readable: &[PathBuf]) -> Result<Vec<String>, String> {
    if model.is_empty()
        || model.len() > 100
        || !model
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "_.:-".contains(c))
    {
        return Err("runtime_unavailable".into());
    }
    let mut args = vec![
        "exec".into(),
        "--json".into(),
        "--ephemeral".into(),
        "--strict-config".into(),
        "--ignore-user-config".into(),
        "--ignore-rules".into(),
        "--skip-git-repo-check".into(),
        "--cd".into(),
        workspace.to_string_lossy().into(),
        "--model".into(),
        model.into(),
        "--disable".into(),
        "apps".into(),
        "--disable".into(),
        "plugins".into(),
        "--disable".into(),
        "multi_agent".into(),
        "-c".into(),
        "web_search=\"disabled\"".into(),
    ];
    args.extend(permission_args(workspace, writable, readable));
    args.push("-".into());
    Ok(args)
}

fn chat_args(workspace: &Path, model: &str) -> Result<Vec<String>, String> {
    let mut args = agent_args(workspace, model, false, &[])?;
    args.pop();
    // A plan reply needs no project discovery or local tools; keep narrow read permissions.
    args.extend(["-c".into(), "project_doc_max_bytes=0".into(), "-c".into(), "forced_login_method=\"chatgpt\"".into()]);
    for feature in ["shell_tool", "unified_exec", "apply_patch_freeform", "view_image", "image_generation", "hooks", "browser_use", "computer_use", "in_app_browser", "in_app_local_automation", "code_mode_host"] {
        args.extend(["--disable".into(), feature.into()]);
    }
    args.push("-".into());
    Ok(args)
}

pub fn chat_answer(runtime: &Runtime, prompt: &str, cancel: std::sync::Arc<std::sync::atomic::AtomicBool>) -> Result<String, String> {
    let workspace = std::env::temp_dir().join(format!(
        "novo-codex-chat-{}",
        uuid::Uuid::new_v4()
    ));
    fs::create_dir(&workspace).map_err(|_| "runtime_unavailable")?;
    struct Cleanup(PathBuf);
    impl Drop for Cleanup {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
    let _cleanup = Cleanup(workspace.clone());
    let args = chat_args(&workspace, &runtime.model)?;
    let output = super::process::run_guarded(
        &runtime.cli,
        &args,
        Some(&workspace),
        Some(prompt.as_bytes()),
        90,
        2 * 1024 * 1024,
        cancel,
    )?;
    if !output.success {
        return Err("execution_failed".into());
    }
    answer_from_jsonl(&output.bytes)
}

fn answer_from_jsonl(bytes: &[u8]) -> Result<String, String> {
    if bytes.len() > 2 * 1024 * 1024 {
        return Err("execution_failed".into());
    }
    let mut answer = None;
    let mut started = false;
    let mut completed = false;
    for line in bytes.split(|byte| *byte == b'\n').filter(|line| !line.is_empty()) {
        if line.len() > 65536 {
            return Err("execution_failed".into());
        }
        let event: serde_json::Value =
            serde_json::from_slice(line).map_err(|_| "execution_failed")?;
        match event["type"].as_str() {
            Some("thread.started") => {
                if started
                    || !event["thread_id"]
                        .as_str()
                        .is_some_and(|id| !id.is_empty() && id.len() <= 128)
                {
                    return Err("execution_failed".into());
                }
                started = true;
            }
            Some("item.completed") if started && event["item"]["type"] == "agent_message" => {
                if let Some(text) = event["item"]["text"]
                    .as_str()
                    .filter(|text| !text.trim().is_empty())
                {
                    answer = Some(text.trim().to_string());
                }
            }
            Some("turn.completed") => {
                if !started || completed {
                    return Err("execution_failed".into());
                }
                completed = true;
            }
            Some("turn.failed") | Some("error") => return Err("execution_failed".into()),
            Some(_) => {}
            None => return Err("execution_failed".into()),
        }
    }
    if started && completed {
        answer.ok_or_else(|| "execution_failed".into())
    } else {
        Err("execution_failed".into())
    }
}
#[derive(Clone)]
pub struct Runtime {
    pub cli: PathBuf,
    pub model: String,
    pub version: String,
}
pub fn detect() -> Result<Runtime, String> {
    detect_auth(false)
}
pub fn detect_chatgpt() -> Result<Runtime, String> {
    detect_auth(true)
}

fn detect_auth(require_chatgpt: bool) -> Result<Runtime, String> {
    if !cfg!(windows) {
        return Err("unsupported_sandbox".into());
    }
    let home = std::env::var_os("CODEX_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("USERPROFILE").map(|home| PathBuf::from(home).join(".codex")))
        .ok_or("runtime_unavailable")?;
    let config = fs::read_to_string(home.join("config.toml")).map_err(|_| "runtime_unavailable")?;
    if config.len() > 1024 * 1024 {
        return Err("runtime_unavailable".into());
    }
    let mut model = None;
    for line in config
        .lines()
        .take_while(|line| !line.trim_start().starts_with('['))
    {
        let Some((key, value)) = line.split_once('=') else {
            continue;
        };
        if key.trim() == "model_provider"
            && value.trim().split('#').next().unwrap_or("").trim() != "\"openai\""
        {
            return Err("runtime_unavailable".into());
        }
        if key.trim() == "model" {
            model = serde_json::from_str::<String>(value.trim()).ok()
        }
    }
    let model = model.ok_or("runtime_unavailable")?;
    // Reuse the installed CLI's authentication; never copy provider credentials.
    let app_root = PathBuf::from(std::env::var_os("LOCALAPPDATA").ok_or("runtime_unavailable")?)
        .join("OpenAI/Codex/bin");
    let mut candidates: Vec<_> = fs::read_dir(&app_root)
        .into_iter()
        .flatten()
        .filter_map(Result::ok)
        .map(|entry| entry.path().join("codex.exe"))
        .filter(|path| path.is_file())
        .collect();
    candidates
        .sort_by_key(|path| std::cmp::Reverse(fs::metadata(path).and_then(|m| m.modified()).ok()));
    for cli in candidates.into_iter().take(8) {
        let out = process::capture(
            &cli,
            &["exec".into(), "--help".into()],
            None,
            10,
            128 * 1024,
        )?;
        let help = String::from_utf8_lossy(&out.bytes);
        if !out.success
            || ![
                "--ignore-user-config",
                "--ignore-rules",
                "--strict-config",
                "--json",
                "--ephemeral",
            ]
            .iter()
            .all(|flag| help.contains(flag))
        {
            continue;
        }
        if require_chatgpt {
            if !crate::codex_plan::uses_chatgpt_login(&cli) {
                return Err("runtime_unavailable".into());
            }
        } else {
        let doctor = process::capture(
            &cli,
            &["doctor".into(), "--json".into()],
            None,
            30,
            128 * 1024,
        )?;
        let health: serde_json::Value =
            serde_json::from_slice(&doctor.bytes).map_err(|_| "runtime_unavailable")?;
        if health["checks"]["auth.credentials"]["status"] != "ok" {
            continue;
        }
        }
        let version = process::capture(&cli, &["--version".into()], None, 10, 512)?;
        return Ok(Runtime {
            cli,
            model,
            version: String::from_utf8_lossy(&version.bytes)
                .trim()
                .chars()
                .take(100)
                .collect(),
        });
    }
    Err("runtime_unavailable".into())
}
pub fn probe(runtime: &Runtime, root: &Path) -> Result<(), String> {
    let dir = root.join(uuid::Uuid::new_v4().to_string());
    let workspace = dir.join("inside");
    crate::platform::ensure_private_dir(&workspace).map_err(|_| "unsupported_sandbox")?;
    fs::write(dir.join("outside.txt"), "public containment fixture")
        .map_err(|_| "unsupported_sandbox")?;
    let readonly = dir.join("readonly");
    fs::create_dir(&readonly).map_err(|_| "unsupported_sandbox")?;
    fs::write(readonly.join("public.txt"), "public fixture").map_err(|_| "unsupported_sandbox")?;
    super::workspace::link_dependencies(
        &system_node()?,
        &readonly,
        &workspace.join("readonly-link"),
        std::sync::Arc::new(std::sync::atomic::AtomicBool::new(false)),
    )?;
    let mut args = vec!["sandbox".into()];
    args.extend(permission_args(&workspace, true, &[readonly, workspace.join("readonly-link")]));
    args.extend(["-P".into(),"novo".into(),"-C".into(),workspace.to_string_lossy().into(),"--".into(),system_powershell().to_string_lossy().into(),"-NoProfile".into(),"-NonInteractive".into(),"-Command".into(),"$ErrorActionPreference='Stop'; Set-Content -LiteralPath './ok.txt' -Value fixture; try { Get-Content -LiteralPath '../outside.txt' -ErrorAction Stop | Out-Null; exit 4 } catch {}; Get-Content -LiteralPath './readonly-link/public.txt' -ErrorAction Stop | Out-Null; try { Set-Content -LiteralPath './readonly-link/private.txt' -Value fixture -ErrorAction Stop; exit 5 } catch { exit 0 }".into()]);
    let out = process::capture(&runtime.cli, &args, None, 20, 32768)?;
    if out.success && workspace.join("ok.txt").is_file() {
        Ok(())
    } else {
        Err("unsupported_sandbox".into())
    }
}
pub fn system_powershell() -> PathBuf {
    PathBuf::from(std::env::var_os("SystemRoot").unwrap_or_else(|| "C:/Windows".into()))
        .join("System32/WindowsPowerShell/v1.0/powershell.exe")
}
pub fn system_node() -> Result<PathBuf, String> {
    let mut paths = vec![];
    if let Some(program_files) = std::env::var_os("ProgramFiles") {
        paths.push(PathBuf::from(program_files).join("nodejs/node.exe"))
    }
    if let Some(path) = std::env::var_os("PATH") {
        paths.extend(std::env::split_paths(&path).map(|dir| dir.join("node.exe")));
    }
    paths
        .into_iter()
        .find(|path| path.is_absolute() && path.is_file())
        .ok_or("runtime_unavailable".into())
}

#[cfg(test)]
mod permission_tests {
    use super::{answer_from_jsonl, permission_args};
    use std::path::Path;

    #[test]
    fn filesystem_paths_are_values_not_dotted_cli_override_keys() {
        let args = permission_args(Path::new("C:/Users/Angel/work/project.v2"), false, &[]);
        let filesystem: Vec<_> = args.windows(2)
            .filter(|pair| pair[0] == "-c" && pair[1].starts_with("permissions.novo.filesystem"))
            .map(|pair| pair[1].as_str()).collect();
        assert_eq!(filesystem.len(), 1, "Codex CLI splits override keys on dots and retains quotes");
        let table = filesystem[0];
        assert!(table.starts_with("permissions.novo.filesystem={"));
        assert!(table.contains("\":minimal\"=\"read\""));
        assert!(table.contains("\"C:/Users/Angel/work/project.v2\"=\"read\""));
        assert!(table.contains("\"C:/Users/Angel/work/project.v2/**/.env*\"=\"deny\""));
        assert!(!table.contains("=\"write\""));
    }

    #[test]
    fn dependency_reads_keep_workspace_writes_and_secret_denials_in_one_table() {
        let args = permission_args(Path::new("C:/work/project.v2"), true, &["C:/deps.v1/node_modules".into()]);
        let tables: Vec<_> = args.iter().filter(|arg| arg.starts_with("permissions.novo.filesystem=")).collect();
        assert_eq!(tables.len(), 1);
        assert!(tables[0].contains("\"C:/work/project.v2\"=\"write\""));
        assert!(tables[0].contains("\"C:/deps.v1/node_modules\"=\"read\""));
        assert!(tables[0].contains("\"C:/work/project.v2/.git\"=\"deny\""));
        assert!(tables[0].contains("\"C:/work/project.v2/**/auth.json\"=\"deny\""));
        assert!(!tables[0].contains("\":root\"=\"read\""));
    }

    #[test]
    fn windows_codex_uses_elevated_sandbox_and_denies_secrets_and_network() {
        let args = permission_args(Path::new("C:/Users/Angel/work/project"), true, &[]);
        let settings: Vec<_> = args
            .windows(2)
            .filter_map(|pair| (pair[0] == "-c").then_some(pair[1].as_str()))
            .collect();

        assert!(settings.contains(&"windows.sandbox=\"elevated\""));
        assert!(settings.contains(&"permissions.novo.network.enabled=false"));
        assert!(settings.iter().any(|setting| setting.contains("**/.env*")));
        assert!(settings.iter().any(|setting| setting.contains("**/credentials*")));
        assert!(settings.iter().any(|setting| setting.contains("**/auth.json")));
        assert!(!settings.contains(&"windows.sandbox=\"mxc\""));
    }

    #[test]
    fn plan_chat_does_not_load_project_docs_or_expose_local_tools() {
        let args = super::chat_args(Path::new("C:/Users/Angel/temp"), "gpt-6-luna").unwrap();
        assert!(args.iter().any(|arg| arg == "project_doc_max_bytes=0"));
        for feature in ["shell_tool", "unified_exec", "apply_patch_freeform", "view_image", "image_generation", "hooks", "browser_use", "computer_use", "in_app_browser", "in_app_local_automation", "code_mode_host"] {
            assert!(args.windows(2).any(|pair| pair[0] == "--disable" && pair[1] == feature), "{feature}");
        }
        let project = super::agent_args(Path::new("C:/work/project"), "gpt-6-luna", true, &[]).unwrap();
        assert!(!project.iter().any(|arg| arg == "project_doc_max_bytes=0"));
    }

    #[test]
    fn codex_chat_is_read_only() {
        let args = super::chat_args(Path::new("C:/Users/Angel/temp"), "gpt-5-codex").unwrap();
        let settings: Vec<_> = args
            .windows(2)
            .filter_map(|pair| (pair[0] == "-c").then_some(pair[1].as_str()))
            .collect();
        assert!(settings.iter().any(|setting| setting.contains("=\"read\"")));
        assert!(!settings.iter().any(|setting| setting.contains("=\"write\"")));
        assert!(settings.contains(&"permissions.novo.network.enabled=false"));
        assert!(settings.contains(&"forced_login_method=\"chatgpt\""));
        let project = super::agent_args(Path::new("C:/Users/Angel/temp"), "gpt-5-codex", true, &[]).unwrap();
        assert!(!project.iter().any(|argument| argument.contains("forced_login_method")));
    }

    #[test]
    fn chat_returns_only_the_completed_assistant_message() {
        let events = br#"{"type":"thread.started","thread_id":"thread_1"}
{"type":"item.completed","item":{"type":"command_execution","command":"ignored"}}
{"type":"item.completed","item":{"type":"agent_message","text":"  Hola, Angel.  "}}
{"type":"turn.completed"}
"#;
        assert_eq!(answer_from_jsonl(events).unwrap(), "Hola, Angel.");
    }

    #[test]
    fn chat_rejects_failed_or_incomplete_turns() {
        assert!(answer_from_jsonl(br#"{"type":"turn.completed"}"#).is_err());
        assert!(answer_from_jsonl(br#"{"type":"turn.failed"}"#).is_err());
    }
}
