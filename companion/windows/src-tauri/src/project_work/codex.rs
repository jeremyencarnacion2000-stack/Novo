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
// Keys must be quoted complete paths (including glob); no server-controlled config.
pub fn permission_args(workspace: &Path, writable: bool) -> Vec<String> {
    let mut args = vec![
        "-c".into(),
        "default_permissions=\"novo\"".into(),
        "-c".into(),
        "permissions.novo.filesystem.\":minimal\"=\"read\"".into(),
        "-c".into(),
        format!(
            "permissions.novo.filesystem.{}=\"{}\"",
            quoted(&workspace.to_string_lossy()),
            if writable { "write" } else { "read" }
        ),
    ];
    for suffix in [
        ".git",
        ".codex",
        ".agents",
        ".claude",
        "**/.env*",
        "**/credentials*",
        "**/auth.json",
    ] {
        args.extend([
            "-c".into(),
            format!(
                "permissions.novo.filesystem.{}=\"deny\"",
                quoted(&format!("{}/{suffix}", workspace.to_string_lossy()))
            ),
        ]);
    }
    args.extend([
        "-c".into(),
        "permissions.novo.network.enabled=false".into(),
        "-c".into(),
        "windows.sandbox=\"mxc\"".into(),
        "-c".into(),
        "approval_policy=\"never\"".into(),
        "-c".into(),
        "shell_environment_policy.inherit=\"none\"".into(),
    ]);
    args
}
pub fn agent_args(workspace: &Path, model: &str, writable: bool) -> Result<Vec<String>, String> {
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
    args.extend(permission_args(workspace, writable));
    args.push("-".into());
    Ok(args)
}
#[derive(Clone)]
pub struct Runtime {
    pub cli: PathBuf,
    pub model: String,
    pub version: String,
}
pub fn detect() -> Result<Runtime, String> {
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
        let doctor = process::capture(
            &cli,
            &["doctor".into(), "--json".into()],
            None,
            10,
            128 * 1024,
        )?;
        let health: serde_json::Value =
            serde_json::from_slice(&doctor.bytes).map_err(|_| "runtime_unavailable")?;
        if health["checks"]["auth.credentials"]["status"] != "ok" {
            continue;
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
    args.extend(permission_args(&workspace, true));
    for path in [&readonly, &workspace.join("readonly-link")] {
        args.extend([
            "-c".into(),
            format!(
                "permissions.novo.filesystem.{}=\"read\"",
                quoted(&path.to_string_lossy())
            ),
        ]);
    }
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
