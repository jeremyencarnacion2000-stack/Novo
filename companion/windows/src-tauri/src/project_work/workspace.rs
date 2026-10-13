use super::process;
use sha2::{Digest, Sha256};
use std::{
    fs,
    path::{Path, PathBuf},
    sync::{atomic::AtomicBool, Arc},
};
pub fn safe_relative(value: &str) -> bool {
    !value.is_empty()
        && value.len() <= 240
        && !value.starts_with('/')
        && !value.chars().any(|c| c.is_control() || "\\:".contains(c))
        && !value.split('/').any(|part| {
            let part = part.to_ascii_lowercase();
            part.is_empty()
                || [
                    ".",
                    "..",
                    ".git",
                    ".codex",
                    ".agents",
                    ".claude",
                    ".npmrc",
                    ".netrc",
                    "auth.json",
                    "credentials.json",
                    ".mcp.json",
                ]
                .contains(&part.as_str())
                || part.starts_with(".env")
        })
}
fn git(
    dir: &Path,
    args: &[String],
    cancel: Arc<AtomicBool>,
    limit: usize,
) -> Result<process::Output, String> {
    let mut argv = vec![
        "--no-optional-locks".into(),
        "-c".into(),
        "core.fsmonitor=false".into(),
        "-c".into(),
        "core.hooksPath=".into(),
        "-c".into(),
        "core.symlinks=false".into(),
        "-c".into(),
        "credential.helper=".into(),
        "-C".into(),
        local_git_path(dir)?,
    ];
    argv.extend_from_slice(args);
    process::run_guarded(Path::new("git"), &argv, None, None, 30, limit, cancel)
}
fn local_git_path(path: &Path) -> Result<String, String> {
    let value = path.to_string_lossy();
    let plain = value.strip_prefix("\\\\?\\").unwrap_or(&value);
    if plain.starts_with("\\\\") || plain.starts_with("UNC\\") {
        return Err("workspace_not_authorized".into());
    }
    Ok(plain.replace('\\', "/"))
}
pub struct Prepared {
    pub path: PathBuf,
    pub base: String,
    pub artifact_id: String,
    pub omitted: Vec<String>,
    pub dependencies: Option<PathBuf>,
    pub original_scripts: serde_json::Value,
}
fn scripts(path: &Path) -> Result<serde_json::Value, String> {
    let file = path.join("package.json");
    if !file.exists() {
        return Ok(serde_json::Value::Null);
    }
    let actual = file.canonicalize().map_err(|_| "verification_failed")?;
    if !actual.starts_with(path.canonicalize().map_err(|_| "verification_failed")?)
        || fs::metadata(&actual)
            .map_err(|_| "verification_failed")?
            .len()
            > 1024 * 1024
    {
        return Err("verification_failed".into());
    }
    let value: serde_json::Value =
        serde_json::from_slice(&fs::read(actual).map_err(|_| "verification_failed")?)
            .map_err(|_| "verification_failed")?;
    Ok(value["scripts"].clone())
}
pub fn verification_scripts_unchanged(prepared: &Prepared) -> Result<bool, String> {
    Ok(scripts(&prepared.path)? == prepared.original_scripts)
}
pub fn dependency_permission_args(prepared: &Prepared) -> Vec<String> {
    let mut args = vec![];
    if let Some(deps) = &prepared.dependencies {
        for dir in [deps.clone(), prepared.path.join("node_modules")] {
            args.extend([
                "-c".into(),
                format!(
                    "permissions.novo.filesystem.{}=\"read\"",
                    super::codex::quoted(&dir.to_string_lossy())
                ),
            ]);
        }
    }
    args
}
pub fn link_dependencies(
    node: &Path,
    source: &Path,
    target: &Path,
    cancel: Arc<AtomicBool>,
) -> Result<(), String> {
    if target.exists() {
        return Err("workspace_not_authorized".into());
    }
    let argv = vec![
        "-e".into(),
        "require('fs').symlinkSync(process.argv[1],process.argv[2],'junction')".into(),
        source.to_string_lossy().into(),
        target.to_string_lossy().into(),
    ];
    if !process::run_guarded(node, &argv, None, None, 10, 1024, cancel)?.success {
        return Err("workspace_not_authorized".into());
    }
    Ok(())
}
pub fn prepare(source: &Path, root: &Path, cancel: Arc<AtomicBool>) -> Result<Prepared, String> {
    let canonical = source
        .canonicalize()
        .map_err(|_| "workspace_not_authorized")?;
    let output = git(
        &canonical,
        &["rev-parse".into(), "HEAD".into()],
        cancel.clone(),
        1024,
    )?;
    let base = String::from_utf8(output.bytes)
        .map_err(|_| "base_changed")?
        .trim()
        .to_string();
    if !output.success
        || ![40, 64].contains(&base.len())
        || !base.chars().all(|c| c.is_ascii_hexdigit())
    {
        return Err("base_changed".into());
    }
    let artifact_id = uuid::Uuid::new_v4().to_string();
    let artifact_root = root.join(&artifact_id);
    crate::platform::ensure_private_dir(&artifact_root).map_err(|_| "execution_failed")?;
    let path = artifact_root.join("workspace");
    let empty = artifact_root.join("empty-template");
    fs::create_dir(&empty).map_err(|_| "execution_failed")?;
    // A private object reference avoids copying gigabytes of Git history. The
    // agent cannot read .git, and native commands never mutate the source.
    let args = vec![
        "clone".into(),
        "--shared".into(),
        "--no-hardlinks".into(),
        "--no-checkout".into(),
        format!("--template={}", local_git_path(&empty)?),
        "--".into(),
        local_git_path(&canonical)?,
        local_git_path(&path)?,
    ];
    if !git(&artifact_root, &args, cancel.clone(), 128 * 1024)?.success {
        return Err("execution_failed".into());
    }
    // Reject links/submodules before checkout and cap the entire tracked tree.
    let tree = git(
        &path,
        &[
            "ls-tree".into(),
            "-r".into(),
            "-l".into(),
            "-z".into(),
            base.clone(),
        ],
        cancel.clone(),
        2 * 1024 * 1024,
    )?;
    if !tree.success {
        return Err("execution_failed".into());
    }
    let mut count = 0;
    let mut size = 0u64;
    let mut omitted = vec![];
    for entry in tree
        .bytes
        .split(|byte| *byte == 0)
        .filter(|entry| !entry.is_empty())
    {
        count += 1;
        if count > 12000 || entry.starts_with(b"120000 ") || entry.starts_with(b"160000 ") {
            return Err("workspace_not_authorized".into());
        }
        let metadata = std::str::from_utf8(
            entry
                .split(|byte| *byte == b'\t')
                .next()
                .ok_or("workspace_not_authorized")?,
        )
        .map_err(|_| "workspace_not_authorized")?;
        let bytes = metadata
            .split_whitespace()
            .nth(3)
            .ok_or("workspace_not_authorized")?
            .parse::<u64>()
            .map_err(|_| "workspace_not_authorized")?;
        size = size.saturating_add(bytes);
        if bytes > 10 * 1024 * 1024 || size > 80 * 1024 * 1024 {
            return Err("workspace_not_authorized".into());
        }
        let path_name = std::str::from_utf8(
            entry
                .split(|byte| *byte == b'\t')
                .nth(1)
                .ok_or("workspace_not_authorized")?,
        )
        .map_err(|_| "workspace_not_authorized")?;
        if !safe_relative(path_name) {
            omitted.push(path_name.to_string())
        }
    }
    if !git(
        &path,
        &["checkout".into(), "--detach".into(), base.clone()],
        cancel.clone(),
        128 * 1024,
    )?
    .success
    {
        return Err("execution_failed".into());
    }
    for file in &omitted {
        let target = path.join(file);
        if target.is_file() {
            fs::remove_file(target).map_err(|_| "workspace_not_authorized")?
        }
    }
    // Delete only empty configuration directories inside this owned clone.
    for folder in [".codex", ".agents", ".claude"] {
        let target = path.join(folder);
        if target.exists() {
            fs::remove_dir_all(&target).map_err(|_| "workspace_not_authorized")?
        }
    }
    if !git(
        &path,
        &["remote".into(), "remove".into(), "origin".into()],
        cancel.clone(),
        32768,
    )?
    .success
    {
        return Err("execution_failed".into());
    }
    let dependencies = canonical
        .join("node_modules")
        .canonicalize()
        .ok()
        .filter(|deps| deps.starts_with(&canonical) && deps.is_dir());
    if let Some(deps) = &dependencies {
        let node = super::codex::system_node()?;
        link_dependencies(&node, deps, &path.join("node_modules"), cancel)?;
        fs::write(path.join(".git/info/exclude"), "node_modules/\n")
            .map_err(|_| "execution_failed")?;
    }
    let original_scripts = scripts(&path)?;
    Ok(Prepared {
        path,
        base,
        artifact_id,
        omitted,
        dependencies,
        original_scripts,
    })
}
pub fn manifest(
    workspace: &Prepared,
    cancel: Arc<AtomicBool>,
) -> Result<(Vec<String>, String), String> {
    let head = git(
        &workspace.path,
        &["rev-parse".into(), "HEAD".into()],
        cancel.clone(),
        1024,
    )?;
    if !head.success || String::from_utf8_lossy(&head.bytes).trim() != workspace.base {
        return Err("base_changed".into());
    }
    let status = git(
        &workspace.path,
        &[
            "status".into(),
            "--porcelain".into(),
            "--no-renames".into(),
            "--untracked-files=all".into(),
            "-z".into(),
        ],
        cancel.clone(),
        65536,
    )?;
    if !status.success {
        return Err("execution_failed".into());
    }
    let mut paths = vec![];
    for entry in status.bytes.split(|b| *b == 0).filter(|e| !e.is_empty()) {
        let name = std::str::from_utf8(entry.get(3..).ok_or("workspace_not_authorized")?)
            .map_err(|_| "workspace_not_authorized")?;
        if workspace.omitted.iter().any(|value| value == name) {
            continue;
        }
        if !safe_relative(name) {
            return Err("workspace_not_authorized".into());
        }
        let full = workspace.path.join(name);
        if full.exists() {
            let actual = full
                .canonicalize()
                .map_err(|_| "workspace_not_authorized")?;
            if !actual.starts_with(
                workspace
                    .path
                    .canonicalize()
                    .map_err(|_| "workspace_not_authorized")?,
            ) || fs::symlink_metadata(full)
                .map_err(|_| "workspace_not_authorized")?
                .file_type()
                .is_symlink()
            {
                return Err("workspace_not_authorized".into());
            }
        }
        paths.push(name.to_string());
    }
    paths.sort();
    paths.dedup();
    if paths.len() > 100 {
        return Err("execution_failed".into());
    }
    if !paths.is_empty() {
        let mut add = vec!["add".into(), "--intent-to-add".into(), "--".into()];
        add.extend(
            paths
                .iter()
                .filter(|name| workspace.path.join(name).is_file())
                .cloned(),
        );
        if add.len() > 3 && !git(&workspace.path, &add, cancel.clone(), 32768)?.success {
            return Err("execution_failed".into());
        }
    }
    let mut diff = vec![
        "diff".into(),
        "--binary".into(),
        "--no-ext-diff".into(),
        "--no-textconv".into(),
        "--no-renames".into(),
        workspace.base.clone(),
        "--".into(),
    ];
    diff.extend(paths.clone());
    let patch = if paths.is_empty() {
        vec![]
    } else {
        let out = git(&workspace.path, &diff, cancel, 1024 * 1024)?;
        if !out.success {
            return Err("execution_failed".into());
        }
        out.bytes
    };
    let hash = format!("{:x}", Sha256::digest(&patch));
    fs::write(
        workspace
            .path
            .parent()
            .ok_or("execution_failed")?
            .join("prepared.patch"),
        &patch,
    )
    .map_err(|_| "execution_failed")?;
    Ok((paths, hash))
}
