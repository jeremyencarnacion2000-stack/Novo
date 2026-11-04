use serde::Deserialize;
use std::path::PathBuf;

#[derive(Clone, Debug)]
pub struct App {
    pub id: String,
    pub ids: Vec<String>,
    pub name: String,
    pub exe: Option<PathBuf>,
    pub package: Option<String>,
}
#[derive(Deserialize)]
struct RegisteredApp {
    name: String,
    identity: String,
    target: Option<String>,
}

pub fn parse_registered(bytes: &[u8]) -> Result<Vec<App>, String> {
    use sha2::{Digest, Sha256};
    if bytes.len() > 1024 * 1024 {
        return Err("catalog_unavailable".into());
    }
    let rows: Vec<RegisteredApp> =
        serde_json::from_slice(bytes).map_err(|_| "catalog_unavailable")?;
    let mut apps = std::collections::BTreeMap::new();
    for row in rows.into_iter().take(1024) {
        if row.identity.is_empty()
            || row.identity.len() > 1024
            || row.name.is_empty()
            || row.name.len() > 240
            || row.name.chars().any(char::is_control)
        {
            continue;
        }
        let (exe, package, identity) = if let Some(target) = row.target.filter(|s| !s.is_empty()) {
            let path = PathBuf::from(target);
            if !path.is_absolute()
                || !path
                    .extension()
                    .is_some_and(|e| e.eq_ignore_ascii_case("exe"))
            {
                continue;
            }
            let Ok(path) = path.canonicalize() else {
                continue;
            };
            if !path.is_file() {
                continue;
            }
            let identity = row.identity.to_lowercase();
            (Some(path), None, identity)
        } else {
            if !row.identity.contains('!')
                || row.identity.len() > 512
                || !row
                    .identity
                    .chars()
                    .all(|ch| ch.is_ascii_alphanumeric() || "._!-".contains(ch))
            {
                continue;
            }
            (None, Some(row.identity.clone()), row.identity)
        };
        let id = format!("app-{:x}", Sha256::digest(identity.as_bytes()));
        let codex = package.as_deref() == Some("OpenAI.Codex_2p2nqsd0c76g0!App");
        let id = if codex { "codex".to_string() } else { id };
        let name = if codex { "Codex".to_string() } else { row.name };
        apps.entry(id.clone()).or_insert(App {
            ids: vec![id.clone()],
            id,
            name,
            exe,
            package,
        });
    }
    let mut entries: Vec<App> = apps.into_values().collect();
    entries.sort_by_key(|app| (app.name.len(), app.name.to_lowercase(), app.id.clone()));
    let mut groups: std::collections::BTreeMap<String, App> = std::collections::BTreeMap::new();
    for app in entries {
        let target = app
            .exe
            .as_ref()
            .map(|path| path.to_string_lossy().to_lowercase())
            .unwrap_or_else(|| app.package.clone().unwrap_or_default());
        if let Some(group) = groups.get_mut(&target) {
            group.ids.extend(app.ids);
        } else {
            groups.insert(target, app);
        }
    }
    Ok(groups.into_values().collect())
}
pub fn load(refresh: bool) -> Result<Vec<App>, String> {
    use std::sync::{Mutex, OnceLock};
    use std::time::{Duration, Instant};
    static CACHE: OnceLock<Mutex<Option<(Instant, Vec<App>)>>> = OnceLock::new();
    let mut cache = CACHE
        .get_or_init(|| Mutex::new(None))
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    if !refresh {
        if let Some((at, apps)) = cache.as_ref() {
            if at.elapsed() < Duration::from_secs(60) {
                return Ok(apps.clone());
            }
        }
    }
    #[cfg(windows)]
    let mut apps = {
        let exe = PathBuf::from(std::env::var_os("WINDIR").unwrap_or_else(|| "C:\\Windows".into()))
            .join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let args = [
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            include_str!("catalog.ps1"),
        ]
        .map(String::from);
        let output = crate::project_work::process::capture(&exe, &args, None, 8, 1024 * 1024)?;
        if !output.success {
            return Err("catalog_unavailable".into());
        }
        parse_registered(&output.bytes)?
    };
    #[cfg(not(windows))]
    let mut apps = vec![];
    for (id, name, _) in super::APPS {
        if let Some(exe) = super::legacy_app_path(id).and_then(|p| p.canonicalize().ok()) {
            if !apps.iter().any(|app| {
                app.exe.as_ref().is_some_and(|path| {
                    path.to_string_lossy()
                        .eq_ignore_ascii_case(exe.to_string_lossy().as_ref())
                })
            }) {
                apps.push(App {
                    id: (*id).into(),
                    ids: vec![(*id).into()],
                    name: (*name).into(),
                    exe: Some(exe),
                    package: None,
                });
            }
        }
    }
    apps.sort_by_key(|app| app.name.to_lowercase());
    *cache = Some((Instant::now(), apps.clone()));
    Ok(apps)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn equivalent_registrations_do_not_bypass_an_application_exclusion() {
        let path = std::env::temp_dir().join(format!("novo-alias-{}.exe", uuid::Uuid::new_v4()));
        std::fs::write(&path, b"fixture").unwrap();
        let raw = serde_json::json!([{"name":"Editor","identity":"vendor.Editor","target":path},{"name":"Editor alternate","identity":"vendor.EditorAlt","target":path}]);
        let apps = parse_registered(&serde_json::to_vec(&raw).unwrap()).unwrap();
        std::fs::remove_file(path).unwrap();
        assert_eq!(apps.len(), 1);
        assert_eq!(apps[0].ids.len(), 2);
        let mut policy = super::super::DesktopPolicy::default();
        policy.entries.insert(
            apps[0].ids[1].clone(),
            super::super::AppPermissions {
                open: false,
                control: false,
                read: false,
            },
        );
        assert!(!policy.for_app(&apps[0]).open);
        assert!(!policy.for_app(&apps[0]).control);
    }
    #[test]
    fn registered_identity_survives_an_executable_version_directory_change() {
        let root = std::env::temp_dir().join(format!("novo-app-update-{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&root).unwrap();
        let one = root.join("v1.exe");
        let two = root.join("v2.exe");
        std::fs::write(&one, b"old").unwrap();
        std::fs::write(&two, b"new").unwrap();
        let parse = |target| {
            parse_registered(&serde_json::to_vec(&serde_json::json!([{"name":"Editor","identity":"vendor.Editor","target":target}])).unwrap()).unwrap()
        };
        let before = parse(one);
        let after = parse(two);
        std::fs::remove_dir_all(root).unwrap();
        assert_eq!(before[0].id, after[0].id);
    }
    #[test]
    fn codex_package_uses_its_product_alias_instead_of_the_stale_shell_label() {
        let apps = parse_registered(
            br#"[{"name":"ChatGPT","identity":"OpenAI.Codex_2p2nqsd0c76g0!App","target":null}]"#,
        )
        .unwrap();
        assert_eq!(apps[0].id, "codex");
        assert_eq!(apps[0].name, "Codex");
    }
    #[test]
    fn registered_executable_is_discovered_without_exposing_its_path_as_id() {
        let path = std::env::temp_dir().join(format!("novo-app-{}.exe", uuid::Uuid::new_v4()));
        std::fs::write(&path, b"fixture").unwrap();
        let raw = serde_json::json!([{"name":"Obsidian","identity":"Obsidian","target":path}]);
        let apps = parse_registered(&serde_json::to_vec(&raw).unwrap()).unwrap();
        std::fs::remove_file(&path).unwrap();
        assert_eq!(apps.len(), 1);
        assert_eq!(apps[0].name, "Obsidian");
        assert!(!apps[0].id.contains("Obsidian"));
        assert!(apps[0].exe.is_some());
    }
    #[test]
    fn rejects_non_apps_and_accepts_only_bounded_packaged_identities() {
        let raw=br#"[{"name":"Notes","identity":"notes","target":"relative.exe"},{"name":"Script","identity":"script","target":"C:\\run.ps1"},{"name":"Calculator","identity":"Microsoft.Calculator_123!App","target":null},{"name":"Bad","identity":"x!App & cmd","target":null}]"#;
        let apps = parse_registered(raw).unwrap();
        assert_eq!(apps.len(), 1);
        assert_eq!(apps[0].name, "Calculator");
        assert!(parse_registered(b"not json").is_err());
    }
}
