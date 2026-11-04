//! Installed app controls. Executables, launch identifiers and HWNDs remain local.
mod catalog;
use crate::{novo_account, settings, Shared};
use catalog::App;
use serde::{Deserialize, Serialize};
use std::{
    collections::{BTreeMap, HashMap},
    sync::Mutex,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq)]
#[serde(deny_unknown_fields)]
pub struct AppPermissions {
    pub open: bool,
    pub control: bool,
    pub read: bool,
}
impl Default for AppPermissions {
    fn default() -> Self {
        Self {
            open: true,
            control: true,
            read: false,
        }
    }
}
#[derive(Clone, Debug, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct DesktopPolicy {
    pub deny_all: bool,
    pub entries: BTreeMap<String, AppPermissions>,
}
impl DesktopPolicy {
    pub fn for_app(&self, app: &App) -> AppPermissions {
        if app.ids.is_empty() {
            return AppPermissions {
                open: false,
                control: false,
                read: false,
            };
        }
        app.ids.iter().map(|id| self.permissions(id)).fold(
            AppPermissions {
                open: true,
                control: true,
                read: true,
            },
            |held, next| AppPermissions {
                open: held.open && next.open,
                control: held.control && next.control,
                read: held.read && next.read,
            },
        )
    }
    pub fn permissions(&self, id: &str) -> AppPermissions {
        self.entries.get(id).cloned().unwrap_or_else(|| {
            if self.deny_all {
                AppPermissions {
                    open: false,
                    control: false,
                    read: false,
                }
            } else {
                AppPermissions::default()
            }
        })
    }
}
pub fn deserialize_policy<'de, D: serde::Deserializer<'de>>(
    d: D,
) -> Result<DesktopPolicy, D::Error> {
    let value = serde_json::Value::deserialize(d)?;
    Ok(
        serde_json::from_value(value).unwrap_or_else(|_| DesktopPolicy {
            deny_all: true,
            entries: BTreeMap::new(),
        }),
    )
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppChoice {
    id: String,
    name: String,
    available: bool,
    allowed: bool,
    can_open: bool,
    can_control: bool,
    can_read: bool,
}
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowChoice {
    id: String,
    app_id: String,
    title: String,
    minimized: bool,
    maximized: bool,
}
#[derive(Serialize)]
pub struct OpenReceipt {
    kind: &'static str,
}
#[derive(Serialize)]
pub struct PolicyResult {
    app: AppChoice,
    policy: DesktopPolicy,
}
#[derive(Default)]
pub struct WindowRegistry(Mutex<HashMap<String, (isize, String, Instant)>>);
const APPS: &[(&str, &str, &str)] = &[
    ("chrome", "Google Chrome", "chrome.exe"),
    ("edge", "Microsoft Edge", "msedge.exe"),
    ("firefox", "Firefox", "firefox.exe"),
    ("vscode", "Visual Studio Code", "Code.exe"),
    ("notepad", "Bloc de notas", "notepad.exe"),
    ("explorer", "Explorador de archivos", "explorer.exe"),
];
fn known_app(id: &str) -> Option<(&'static str, &'static str)> {
    APPS.iter()
        .find(|(app, _, _)| *app == id)
        .map(|(_, name, exe)| (*name, *exe))
}
fn safe_error() -> novo_account::SafeError {
    novo_account::SafeError::new("unavailable")
}
fn resolve_app(id: &str) -> Result<App, novo_account::SafeError> {
    let apps = catalog::load(false).map_err(|_| safe_error())?;
    if let Some(app) = apps.iter().find(|app| app.id == id) {
        return Ok(app.clone());
    }
    // Preserve the old six aliases while policies use registered identities.
    let legacy = legacy_app_path(id).and_then(|p| p.canonicalize().ok());
    apps.into_iter()
        .find(|app| {
            app.exe
                .as_ref()
                .zip(legacy.as_ref())
                .is_some_and(|(path, old)| {
                    path.to_string_lossy()
                        .eq_ignore_ascii_case(old.to_string_lossy().as_ref())
                })
        })
        .ok_or_else(|| novo_account::SafeError::new("invalid_request"))
}

fn permissions(shared: &Shared, app: &App) -> AppPermissions {
    shared
        .settings
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .desktop_policy
        .for_app(app)
}
fn choice(app: &App, p: AppPermissions) -> AppChoice {
    AppChoice {
        id: app.id.clone(),
        name: app.name.clone(),
        available: true,
        allowed: p.control,
        can_open: p.open,
        can_control: p.control,
        can_read: p.read,
    }
}
#[tauri::command]
pub async fn desktop_app_catalog(
    shared: State<'_, Shared>,
    refresh: Option<bool>,
) -> Result<Vec<AppChoice>, novo_account::SafeError> {
    let apps =
        tauri::async_runtime::spawn_blocking(move || catalog::load(refresh.unwrap_or(false)))
            .await
            .map_err(|_| safe_error())?
            .map_err(|_| safe_error())?;
    Ok(apps
        .iter()
        .map(|app| choice(app, permissions(&shared, app)))
        .collect())
}
#[tauri::command]
pub fn desktop_app_permissions_set(
    app: AppHandle,
    window: tauri::WebviewWindow,
    shared: State<'_, Shared>,
    app_id: String,
    permissions: AppPermissions,
) -> Result<PolicyResult, novo_account::SafeError> {
    if window.label() != "settings" {
        return Err(novo_account::SafeError::new("permission_required"));
    }
    let target = resolve_app(&app_id)?;
    let mut held = shared
        .settings
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner);
    let mut updated = held.clone();
    for id in &target.ids {
        updated
            .desktop_policy
            .entries
            .insert(id.clone(), permissions.clone());
    }
    settings::save(&updated).map_err(|_| safe_error())?;
    *held = updated.clone();
    drop(held);
    let _ = app.emit("settings-changed", updated.clone());
    Ok(PolicyResult {
        app: choice(&target, permissions),
        policy: updated.desktop_policy,
    })
}
// Legacy callers use the same policy boundary; they cannot bypass exclusions.
#[tauri::command]
pub fn desktop_app_allowed_set(
    app: AppHandle,
    window: tauri::WebviewWindow,
    shared: State<'_, Shared>,
    app_id: String,
    enabled: bool,
) -> Result<Vec<String>, novo_account::SafeError> {
    let _ = desktop_app_permissions_set(
        app,
        window,
        shared.clone(),
        app_id,
        AppPermissions {
            open: enabled,
            control: enabled,
            read: false,
        },
    )?;
    Ok(catalog::load(false)
        .map_err(|_| safe_error())?
        .iter()
        .filter(|app| permissions(&shared, app).control)
        .map(|app| app.id.clone())
        .collect())
}
async fn authorize(shared: &Shared, control: bool) -> Result<(), novo_account::SafeError> {
    let auth = novo_account::verify_account(shared).await?;
    if if control {
        auth.capabilities.desktop_control
    } else {
        auth.capabilities.desktop_read
    } {
        Ok(())
    } else {
        Err(novo_account::SafeError::new("permission_required"))
    }
}
fn require_local(
    shared: &Shared,
    id: &str,
    control: bool,
) -> Result<AppPermissions, novo_account::SafeError> {
    let app = resolve_app(id)?;
    let p = permissions(shared, &app);
    if if control { p.control } else { p.open } {
        Ok(p)
    } else {
        Err(novo_account::SafeError::new("permission_required"))
    }
}
async fn open_request(
    shared: &Shared,
    app_id: String,
    request_id: String,
) -> Result<OpenReceipt, novo_account::SafeError> {
    if uuid::Uuid::parse_str(&request_id).is_err() {
        return Err(novo_account::SafeError::new("invalid_request"));
    }
    let ticket = shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .begin_stream(request_id)?;
    let result = async {
        let app = tauri::async_runtime::spawn_blocking(move || resolve_app(&app_id))
            .await
            .map_err(|_| safe_error())??;
        authorize(shared, true).await?;
        let p = require_local(shared, &app.id, false)?;
        if !shared
            .novo_account
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .accepts(&ticket)
        {
            return Err(novo_account::SafeError::new("cancelled"));
        }
        #[cfg(windows)]
        {
            open_verified(&app, p).await
        }
        #[cfg(not(windows))]
        {
            let _ = (app, p);
            Err(safe_error())
        }
    }
    .await;
    shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .finish_stream(&ticket);
    result
}
#[tauri::command]
pub async fn desktop_app_open(
    shared: State<'_, Shared>,
    app_id: String,
    request_id: Option<String>,
) -> Result<OpenReceipt, novo_account::SafeError> {
    open_request(
        &shared,
        app_id,
        request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string()),
    )
    .await
}
#[tauri::command]
pub fn desktop_action_cancel(
    shared: State<'_, Shared>,
    request_id: String,
) -> Result<(), novo_account::SafeError> {
    if uuid::Uuid::parse_str(&request_id).is_err() {
        return Err(novo_account::SafeError::new("invalid_request"));
    }
    shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .cancel(&request_id);
    Ok(())
}
#[cfg(windows)]
async fn open_verified(
    app: &App,
    p: AppPermissions,
) -> Result<OpenReceipt, novo_account::SafeError> {
    let before = windows::list_for_app(app, false);
    if !before.is_empty() {
        if before.len() == 1 && p.control {
            windows::act(before[0].0, app, "focus")?;
            return Ok(OpenReceipt { kind: "focused" });
        }
        return Ok(OpenReceipt {
            kind: "already_open",
        });
    }
    let mut cmd = if let Some(exe) = &app.exe {
        std::process::Command::new(exe)
    } else {
        let mut cmd = std::process::Command::new(
            std::path::PathBuf::from(
                std::env::var_os("WINDIR").unwrap_or_else(|| "C:\\Windows".into()),
            )
            .join("explorer.exe"),
        );
        cmd.arg(format!(
            "shell:AppsFolder\\{}",
            app.package.as_deref().ok_or_else(safe_error)?
        ));
        cmd
    };
    cmd.spawn().map_err(|_| safe_error())?;
    for _ in 0..80 {
        if !windows::list_for_app(app, false).is_empty() {
            return Ok(OpenReceipt { kind: "opened" });
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    Err(safe_error())
}
#[tauri::command]
pub async fn desktop_app_windows(
    shared: State<'_, Shared>,
    registry: State<'_, WindowRegistry>,
    app_id: String,
) -> Result<Vec<WindowChoice>, novo_account::SafeError> {
    let app = resolve_app(&app_id)?;
    let auth = novo_account::verify_account(&shared).await?;
    if !auth.capabilities.desktop_control {
        return Err(novo_account::SafeError::new("permission_required"));
    }
    let app_id = app.id.clone();
    let p = require_local(&shared, &app_id, true)?;
    #[cfg(windows)]
    {
        let rows = windows::list_for_app(&app, p.read && auth.capabilities.desktop_read);
        let mut targets = registry
            .0
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        targets.clear();
        Ok(rows
            .into_iter()
            .enumerate()
            .map(|(index, (handle, title, minimized, maximized))| {
                let id = uuid::Uuid::new_v4().to_string();
                targets.insert(id.clone(), (handle, app_id.clone(), Instant::now()));
                WindowChoice {
                    id,
                    app_id: app_id.clone(),
                    title: if title.is_empty() {
                        format!("Ventana {}", index + 1)
                    } else {
                        title
                    },
                    minimized,
                    maximized,
                }
            })
            .collect())
    }
    #[cfg(not(windows))]
    {
        let _ = (registry, p, app);
        Err(safe_error())
    }
}
#[tauri::command]
pub async fn desktop_window_action(
    shared: State<'_, Shared>,
    registry: State<'_, WindowRegistry>,
    window_id: String,
    action: String,
    request_id: Option<String>,
) -> Result<(), novo_account::SafeError> {
    if uuid::Uuid::parse_str(&window_id).is_err()
        || !["focus", "minimize", "maximize", "restore"].contains(&action.as_str())
    {
        return Err(novo_account::SafeError::new("invalid_request"));
    }
    let request_id = request_id.unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    if uuid::Uuid::parse_str(&request_id).is_err() {
        return Err(novo_account::SafeError::new("invalid_request"));
    }
    let target = registry
        .0
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .get(&window_id)
        .cloned()
        .ok_or_else(|| novo_account::SafeError::new("invalid_request"))?;
    let ticket = shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .begin_stream(request_id)?;
    let result = async {
        let app = resolve_app(&target.1)?;
        authorize(&shared, true).await?;
        require_local(&shared, &target.1, true)?;
        if target.2.elapsed() > Duration::from_secs(30) {
            return Err(novo_account::SafeError::new("request_expired"));
        }
        if !shared
            .novo_account
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner)
            .accepts(&ticket)
        {
            return Err(novo_account::SafeError::new("cancelled"));
        }
        #[cfg(windows)]
        {
            windows::act(target.0, &app, &action)
        }
        #[cfg(not(windows))]
        {
            let _ = app;
            Err(safe_error())
        }
    }
    .await;
    shared
        .novo_account
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
        .finish_stream(&ticket);
    result
}

#[cfg(windows)]
fn legacy_app_path(id: &str) -> Option<std::path::PathBuf> {
    use std::path::PathBuf;
    let (_, exe) = known_app(id)?;
    let env_path = |key: &str| std::env::var_os(key).map(PathBuf::from);
    let program_files = env_path("ProgramFiles");
    let program_files_x86 = env_path("ProgramFiles(x86)");
    let local = env_path("LOCALAPPDATA");
    let windir = env_path("WINDIR").unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
    let mut paths = Vec::new();
    match id {
        "chrome" => {
            for root in [program_files, program_files_x86, local]
                .into_iter()
                .flatten()
            {
                paths.push(root.join("Google/Chrome/Application/chrome.exe"));
            }
        }
        "edge" => {
            for root in [program_files_x86, program_files].into_iter().flatten() {
                paths.push(root.join("Microsoft/Edge/Application/msedge.exe"));
            }
        }
        "firefox" => {
            for root in [program_files, program_files_x86].into_iter().flatten() {
                paths.push(root.join("Mozilla Firefox/firefox.exe"));
            }
        }
        "vscode" => {
            for root in [local, program_files].into_iter().flatten() {
                paths.push(root.join("Programs/Microsoft VS Code/Code.exe"));
                paths.push(root.join("Microsoft VS Code/Code.exe"));
            }
        }
        "notepad" => paths.push(windir.join("System32/notepad.exe")),
        "explorer" => paths.push(windir.join("explorer.exe")),
        _ => return None,
    }
    paths.into_iter().find(|path| {
        path.is_file()
            && path
                .file_name()
                .is_some_and(|name| name.eq_ignore_ascii_case(exe))
    })
}

#[cfg(not(windows))]
fn legacy_app_path(_: &str) -> Option<std::path::PathBuf> {
    None
}

#[cfg(windows)]
mod windows {
    use super::{catalog::App, novo_account};
    use std::{path::Path, sync::Mutex};
    use windows::core::BOOL;
    use windows::Win32::{
        Foundation::{CloseHandle, HWND, LPARAM},
        System::Threading::{
            OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
            PROCESS_QUERY_LIMITED_INFORMATION,
        },
        UI::WindowsAndMessaging::{
            EnumWindows, GetWindow, GetWindowTextW, GetWindowThreadProcessId, IsIconic, IsWindow,
            IsWindowVisible, IsZoomed, SetForegroundWindow, ShowWindow, GW_OWNER, SW_MAXIMIZE,
            SW_MINIMIZE, SW_RESTORE,
        },
    };

    static ENUM_LOCK: Mutex<()> = Mutex::new(());
    struct Row {
        handle: isize,
        title: String,
        minimized: bool,
        maximized: bool,
    }
    struct CollectContext<'a> {
        rows: Vec<Row>,
        expected: &'a App,
        read: bool,
    }
    unsafe extern "system" fn collect(hwnd: HWND, data: LPARAM) -> BOOL {
        let context = &mut *(data.0 as *mut CollectContext<'_>);
        let rows = &mut context.rows;
        if !IsWindowVisible(hwnd).as_bool()
            || GetWindow(hwnd, GW_OWNER).is_ok_and(|owner| !owner.0.is_null())
        {
            return BOOL(1);
        }
        let mut pid = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 {
            return BOOL(1);
        }
        let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else {
            return BOOL(1);
        };
        let mut path = vec![0u16; 32_768];
        let mut size = path.len() as u32;
        let read = QueryFullProcessImageNameW(
            process,
            PROCESS_NAME_FORMAT(0),
            windows::core::PWSTR(path.as_mut_ptr()),
            &mut size,
        );
        let _ = CloseHandle(process);
        if read.is_err() || size == 0 {
            return BOOL(1);
        }
        let Ok(path) = String::from_utf16(&path[..size as usize]) else {
            return BOOL(1);
        };
        if !matches_process(context.expected, pid, &path) {
            return BOOL(1);
        }
        let mut title = vec![0u16; 512];
        let len = if context.read {
            GetWindowTextW(hwnd, &mut title)
        } else {
            0
        };
        if rows.len() < 64 {
            rows.push(Row {
                handle: hwnd.0 as isize,
                title: String::from_utf16_lossy(&title[..len as usize]),
                minimized: IsIconic(hwnd).as_bool(),
                maximized: IsZoomed(hwnd).as_bool(),
            });
        }
        BOOL(1)
    }
    fn matches_process(app: &App, pid: u32, path: &str) -> bool {
        if let Some(expected) = &app.exe {
            return Path::new(path).canonicalize().is_ok_and(|path| {
                path.to_string_lossy()
                    .eq_ignore_ascii_case(expected.to_string_lossy().as_ref())
            });
        }
        let Ok(handle) = (unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) })
        else {
            return false;
        };
        let mut buffer = vec![0u16; 512];
        let mut size = buffer.len() as u32;
        let result = unsafe {
            windows::Win32::Storage::Packaging::Appx::GetApplicationUserModelId(
                handle,
                &mut size,
                Some(windows::core::PWSTR(buffer.as_mut_ptr())),
            )
        };
        let _ = unsafe { CloseHandle(handle) };
        result.0 == 0
            && size > 0
            && app.package.as_deref()
                == Some(
                    String::from_utf16_lossy(
                        &buffer[..(size as usize).saturating_sub(1).min(buffer.len())],
                    )
                    .as_str(),
                )
    }
    pub fn list_for_app(app: &App, read: bool) -> Vec<(isize, String, bool, bool)> {
        let _lock = ENUM_LOCK
            .lock()
            .unwrap_or_else(std::sync::PoisonError::into_inner);
        let mut context = CollectContext {
            rows: Vec::new(),
            expected: app,
            read,
        };
        unsafe {
            let _ = EnumWindows(Some(collect), LPARAM(&mut context as *mut _ as isize));
        }
        context
            .rows
            .into_iter()
            .map(|row| (row.handle, row.title, row.minimized, row.maximized))
            .collect()
    }
    pub fn act(handle: isize, app: &App, action: &str) -> Result<(), novo_account::SafeError> {
        let hwnd = HWND(handle as *mut _);
        if !unsafe { IsWindow(Some(hwnd)) }.as_bool() {
            return Err(novo_account::SafeError::new("unavailable"));
        }
        let mut pid = 0;
        unsafe {
            GetWindowThreadProcessId(hwnd, Some(&mut pid));
        }
        let process = unsafe {
            OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid)
                .map_err(|_| novo_account::SafeError::new("unavailable"))?
        };
        let mut path = vec![0u16; 32_768];
        let mut size = path.len() as u32;
        let result = unsafe {
            QueryFullProcessImageNameW(
                process,
                PROCESS_NAME_FORMAT(0),
                windows::core::PWSTR(path.as_mut_ptr()),
                &mut size,
            )
        };
        let _ = unsafe { CloseHandle(process) };
        let matches = result.is_ok()
            && size > 0
            && matches_process(app, pid, &String::from_utf16_lossy(&path[..size as usize]));
        if !matches {
            return Err(novo_account::SafeError::new("unavailable"));
        }
        unsafe {
            match action {
                "focus" => {
                    if IsIconic(hwnd).as_bool() {
                        let _ = ShowWindow(hwnd, SW_RESTORE);
                    }
                    let _ = SetForegroundWindow(hwnd);
                    if windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow() == hwnd {
                        Ok(())
                    } else {
                        Err(novo_account::SafeError::new("unavailable"))
                    }
                }
                "minimize" => {
                    let _ = ShowWindow(hwnd, SW_MINIMIZE);
                    if IsIconic(hwnd).as_bool() {
                        Ok(())
                    } else {
                        Err(novo_account::SafeError::new("unavailable"))
                    }
                }
                "maximize" => {
                    let _ = ShowWindow(hwnd, SW_MAXIMIZE);
                    if IsZoomed(hwnd).as_bool() {
                        Ok(())
                    } else {
                        Err(novo_account::SafeError::new("unavailable"))
                    }
                }
                "restore" => {
                    let _ = ShowWindow(hwnd, SW_RESTORE);
                    if !IsIconic(hwnd).as_bool() && !IsZoomed(hwnd).as_bool() {
                        Ok(())
                    } else {
                        Err(novo_account::SafeError::new("unavailable"))
                    }
                }
                _ => Err(novo_account::SafeError::new("invalid_request")),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn opening_control_and_reading_are_independent_and_corrupt_policy_denies() {
        let mut p = DesktopPolicy::default();
        assert_eq!(
            p.permissions("new-app"),
            AppPermissions {
                open: true,
                control: true,
                read: false
            }
        );
        p.entries.insert(
            "editor".into(),
            AppPermissions {
                open: true,
                control: false,
                read: false,
            },
        );
        assert!(!p.permissions("editor").control);
        assert!(p.permissions("editor").open);
        assert!(!p.permissions("editor").read);
        let value = serde_json::json!({"desktopPolicy":{"entries":{"editor":{"open":"true"}},"denyAll":false}});
        let settings: settings::Settings = serde_json::from_value(value).unwrap();
        assert!(!settings.desktop_policy.permissions("editor").open);
        assert!(!settings.desktop_policy.permissions("anything").control);
    }
    #[cfg(windows)]
    #[tokio::test(flavor = "current_thread")]
    #[ignore = "opens and moves real Windows app windows; requires explicit desktop-test authorization"]
    async fn real_windows_editor_and_notepad() {
        let shared = crate::Shared {
            settings: Mutex::new(settings::load()),
            gate: std::sync::Arc::new(crate::island::PollGate::new()),
            activity: Mutex::new(crate::companion::ActivityRecorder::default()),
            activity_history_lock: tokio::sync::Mutex::new(()),
            pending_companion_authorization: tokio::sync::Mutex::new(None),
            companion_auth_lock: tokio::sync::Mutex::new(()),
            novo_account: Mutex::new(novo_account::AccountRuntime::default()),
        };
        authorize(&shared, true)
            .await
            .expect("connected account desktop control scope");
        println!("Live account authorization: desktop control granted");
        let apps = catalog::load(true).expect("Windows catalog");
        println!("Observed registered apps: {}", apps.len());
        let editor = apps
            .iter()
            .find(|app| app.id == "codex")
            .expect("installed editor");
        assert!(
            !windows::list_for_app(editor, false).is_empty(),
            "running Codex window must be observable before testing"
        );
        shared
            .settings
            .lock()
            .unwrap()
            .desktop_policy
            .entries
            .insert(
                editor.id.clone(),
                AppPermissions {
                    open: true,
                    control: false,
                    read: false,
                },
            );
        let result = open_request(&shared, editor.id.clone(), uuid::Uuid::new_v4().to_string())
            .await
            .expect("verified editor window");
        println!("Editor window: {}", result.kind);
        shared
            .settings
            .lock()
            .unwrap()
            .desktop_policy
            .entries
            .insert(
                editor.id.clone(),
                AppPermissions {
                    open: false,
                    control: false,
                    read: false,
                },
            );
        let denied =
            open_request(&shared, editor.id.clone(), uuid::Uuid::new_v4().to_string()).await;
        assert!(matches!(denied,Err(error) if error.code=="permission_required"));
        println!("Excluded Codex opening rejected through the live-account request gate");
        let notepad = resolve_app("notepad").expect("Notepad alias");
        open_verified(
            &notepad,
            AppPermissions {
                open: true,
                control: false,
                read: false,
            },
        )
        .await
        .expect("verified Notepad window");
        let rows = windows::list_for_app(&notepad, false);
        assert!(!rows.is_empty());
        assert!(rows.iter().all(|row| row.1.is_empty()));
        let target = rows[0].0;
        let was_min = rows[0].2;
        let was_max = rows[0].3;
        windows::act(target, &notepad, "minimize").expect("minimize observed");
        windows::act(target, &notepad, "maximize").expect("maximize observed");
        windows::act(target, &notepad, "restore").expect("restore observed");
        if was_min {
            windows::act(target, &notepad, "minimize").unwrap();
        } else if was_max {
            windows::act(target, &notepad, "maximize").unwrap();
        }
        assert!(windows::act(target, editor, "minimize").is_err());
        println!("Notepad minimize/maximize/restore verified; titles redacted; foreign app handle rejected");
    }
}
