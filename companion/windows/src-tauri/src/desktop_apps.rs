//! Local, allowlisted Windows app and window controls. Handles and paths never
//! leave this process; the chat receives only the action's verified result.

use crate::{novo_account, settings, Shared};
use serde::Serialize;
use std::{collections::HashMap, sync::Mutex};
use tauri::{AppHandle, Emitter, State};

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppChoice { id: String, name: String, available: bool, allowed: bool }

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowChoice { id: String, app_id: String, title: String, minimized: bool, maximized: bool }

#[derive(Default)]
pub struct WindowRegistry(Mutex<HashMap<String, (isize, String)>>);

const APPS: &[(&str, &str, &str)] = &[
    ("chrome", "Google Chrome", "chrome.exe"),
    ("edge", "Microsoft Edge", "msedge.exe"),
    ("firefox", "Firefox", "firefox.exe"),
    ("vscode", "Visual Studio Code", "Code.exe"),
    ("notepad", "Bloc de notas", "notepad.exe"),
    ("explorer", "Explorador de archivos", "explorer.exe"),
];

fn known_app(id: &str) -> Option<(&'static str, &'static str)> {
    APPS.iter().find(|(app, _, _)| *app == id).map(|(_, name, exe)| (*name, *exe))
}

#[tauri::command]
pub fn desktop_app_catalog(shared: State<'_, Shared>) -> Vec<AppChoice> {
    let settings = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    APPS.iter().map(|(id, name, _)| AppChoice {
        id: (*id).into(), name: (*name).into(), available: app_path(id).is_some(), allowed: settings.desktop_allowed_apps.iter().any(|saved| saved == id),
    }).collect()
}

#[tauri::command]
pub fn desktop_app_allowed_set(app: AppHandle, shared: State<'_, Shared>, app_id: String, enabled: bool) -> Result<Vec<String>, crate::novo_account::SafeError> {
    if known_app(&app_id).is_none() || (enabled && app_path(&app_id).is_none()) { return Err(novo_account::SafeError::new("invalid_request")); }
    let (saved, updated) = {
        let mut settings = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        if enabled && !settings.desktop_allowed_apps.iter().any(|id| id == &app_id) { settings.desktop_allowed_apps.push(app_id.clone()); }
        if !enabled { settings.desktop_allowed_apps.retain(|id| id != &app_id); }
        settings.desktop_allowed_apps.sort();
        settings.desktop_allowed_apps.dedup();
        (settings.desktop_allowed_apps.clone(), settings.clone())
    };
    settings::save(&updated).map_err(|_| novo_account::SafeError::new("unavailable"))?;
    let _ = app.emit("settings-changed", updated);
    Ok(saved)
}

fn is_allowed(shared: &Shared, app_id: &str) -> Result<(), novo_account::SafeError> {
    if known_app(app_id).is_none() { return Err(novo_account::SafeError::new("invalid_request")); }
    let settings = shared.settings.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
    if settings.desktop_allowed_apps.iter().any(|id| id == app_id) { Ok(()) }
    else { Err(novo_account::SafeError::new("permission_required")) }
}

async fn require_capability(shared: &Shared, control: bool) -> Result<(), novo_account::SafeError> {
    let authorization = novo_account::verify_account(shared).await?;
    let allowed = if control { authorization.capabilities.desktop_control } else { authorization.capabilities.desktop_read };
    if allowed { Ok(()) } else { Err(novo_account::SafeError::new("permission_required")) }
}

#[tauri::command]
pub async fn desktop_app_open(shared: State<'_, Shared>, app_id: String) -> Result<(), novo_account::SafeError> {
    is_allowed(&shared, &app_id)?;
    require_capability(&shared, true).await?;
    #[cfg(windows)]
    {
        if let Some((handle, _, _, _)) = windows::list_for_app(&app_id).into_iter().next() {
            return windows::act(handle, &app_id, "focus");
        }
        let path = app_path(&app_id).ok_or_else(|| novo_account::SafeError::new("unavailable"))?;
        std::process::Command::new(path).spawn().map_err(|_| novo_account::SafeError::new("unavailable"))?;
        for _ in 0..30 {
            if let Some((handle, _, _, _)) = windows::list_for_app(&app_id).into_iter().next() {
                return windows::act(handle, &app_id, "focus");
            }
            tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        }
        return Err(novo_account::SafeError::new("unavailable"));
    }
    #[cfg(not(windows))]
    Err(novo_account::SafeError::new("unavailable"))
}

#[tauri::command]
pub async fn desktop_app_windows(shared: State<'_, Shared>, registry: State<'_, WindowRegistry>, app_id: String) -> Result<Vec<WindowChoice>, crate::novo_account::SafeError> {
    is_allowed(&shared, &app_id)?;
    require_capability(&shared, false).await?;
    #[cfg(windows)]
    {
        let rows = windows::list_for_app(&app_id);
        let mut targets = registry.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        targets.clear();
        let choices = rows.into_iter().map(|(handle, title, minimized, maximized)| {
            let id = uuid::Uuid::new_v4().to_string();
            targets.insert(id.clone(), (handle, app_id.clone()));
            WindowChoice { id, app_id: app_id.clone(), title, minimized, maximized }
        }).collect();
        return Ok(choices);
    }
    #[cfg(not(windows))]
    { let _ = registry; Err(novo_account::SafeError::new("unavailable")) }
}

#[tauri::command]
pub async fn desktop_window_action(shared: State<'_, Shared>, registry: State<'_, WindowRegistry>, window_id: String, action: String) -> Result<(), crate::novo_account::SafeError> {
    if uuid::Uuid::parse_str(&window_id).is_err() || !["focus", "minimize", "maximize", "restore"].contains(&action.as_str()) {
        return Err(novo_account::SafeError::new("invalid_request"));
    }
    let target = registry.0.lock().unwrap_or_else(std::sync::PoisonError::into_inner).get(&window_id).cloned()
        .ok_or_else(|| novo_account::SafeError::new("invalid_request"))?;
    is_allowed(&shared, &target.1)?;
    require_capability(&shared, true).await?;
    #[cfg(windows)]
    { windows::act(target.0, &target.1, &action) }
    #[cfg(not(windows))]
    { let _ = target; Err(novo_account::SafeError::new("unavailable")) }
}

#[cfg(windows)]
fn app_path(id: &str) -> Option<std::path::PathBuf> {
    use std::path::PathBuf;
    let (_, exe) = known_app(id)?;
    let env_path = |key: &str| std::env::var_os(key).map(PathBuf::from);
    let program_files = env_path("ProgramFiles");
    let program_files_x86 = env_path("ProgramFiles(x86)");
    let local = env_path("LOCALAPPDATA");
    let windir = env_path("WINDIR").unwrap_or_else(|| PathBuf::from(r"C:\Windows"));
    let mut paths = Vec::new();
    match id {
        "chrome" => { for root in [program_files, program_files_x86, local].into_iter().flatten() { paths.push(root.join("Google/Chrome/Application/chrome.exe")); } }
        "edge" => { for root in [program_files_x86, program_files].into_iter().flatten() { paths.push(root.join("Microsoft/Edge/Application/msedge.exe")); } }
        "firefox" => { for root in [program_files, program_files_x86].into_iter().flatten() { paths.push(root.join("Mozilla Firefox/firefox.exe")); } }
        "vscode" => { for root in [local, program_files].into_iter().flatten() { paths.push(root.join("Programs/Microsoft VS Code/Code.exe")); paths.push(root.join("Microsoft VS Code/Code.exe")); } }
        "notepad" => paths.push(windir.join("System32/notepad.exe")),
        "explorer" => paths.push(windir.join("explorer.exe")),
        _ => return None,
    }
    paths.into_iter().find(|path| path.is_file() && path.file_name().is_some_and(|name| name.eq_ignore_ascii_case(exe)))
}

#[cfg(not(windows))]
fn app_path(_: &str) -> Option<std::path::PathBuf> { None }

#[cfg(windows)]
mod windows {
    use super::{app_path, novo_account};
    use std::{path::Path, sync::Mutex};
    use windows::core::BOOL;
    use windows::Win32::{Foundation::{CloseHandle, HWND, LPARAM}, System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT, PROCESS_QUERY_LIMITED_INFORMATION}, UI::WindowsAndMessaging::{EnumWindows, GetWindow, GetWindowThreadProcessId, GetWindowTextW, IsIconic, IsWindow, IsWindowVisible, IsZoomed, SetForegroundWindow, ShowWindow, GW_OWNER, SW_MAXIMIZE, SW_MINIMIZE, SW_RESTORE}};

    static ENUM_LOCK: Mutex<()> = Mutex::new(());
    struct Row { handle: isize, title: String, minimized: bool, maximized: bool }
    struct CollectContext<'a> { rows: Vec<Row>, expected: &'a Path }
    unsafe extern "system" fn collect(hwnd: HWND, data: LPARAM) -> BOOL {
        let context = &mut *(data.0 as *mut CollectContext<'_>);
        let rows = &mut context.rows;
        if !IsWindowVisible(hwnd).as_bool() || GetWindow(hwnd, GW_OWNER).is_ok_and(|owner| !owner.0.is_null()) { return BOOL(1); }
        let mut pid = 0;
        GetWindowThreadProcessId(hwnd, Some(&mut pid));
        if pid == 0 { return BOOL(1); }
        let Ok(process) = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid) else { return BOOL(1); };
        let mut path = vec![0u16; 32_768];
        let mut size = path.len() as u32;
        let read = QueryFullProcessImageNameW(process, PROCESS_NAME_FORMAT(0), windows::core::PWSTR(path.as_mut_ptr()), &mut size);
        let _ = CloseHandle(process);
        if read.is_err() || size == 0 { return BOOL(1); }
        let Ok(path) = String::from_utf16(&path[..size as usize]) else { return BOOL(1); };
        let Ok(path) = Path::new(&path).canonicalize() else { return BOOL(1); };
        if !path.to_string_lossy().eq_ignore_ascii_case(context.expected.to_string_lossy().as_ref()) { return BOOL(1); }
        let mut title = vec![0u16; 512];
        let len = GetWindowTextW(hwnd, &mut title);
        if len <= 0 { return BOOL(1); }
        if rows.len() < 64 { rows.push(Row { handle: hwnd.0 as isize, title: String::from_utf16_lossy(&title[..len as usize]), minimized: IsIconic(hwnd).as_bool(), maximized: IsZoomed(hwnd).as_bool() }); }
        BOOL(1)
    }
    pub fn list_for_app(app_id: &str) -> Vec<(isize, String, bool, bool)> {
        let _lock = ENUM_LOCK.lock().unwrap_or_else(std::sync::PoisonError::into_inner);
        let Some(expected) = app_path(app_id) else { return vec![]; };
        let Ok(expected) = expected.canonicalize() else { return vec![]; };
        let mut context = CollectContext { rows: Vec::new(), expected: &expected };
        unsafe { let _ = EnumWindows(Some(collect), LPARAM(&mut context as *mut _ as isize)); }
        context.rows.into_iter().map(|row| (row.handle, row.title, row.minimized, row.maximized)).collect()
    }
    pub fn act(handle: isize, app_id: &str, action: &str) -> Result<(), novo_account::SafeError> {
        if super::known_app(app_id).is_none() { return Err(novo_account::SafeError::new("invalid_request")); }
        let expected = app_path(app_id).and_then(|path| path.canonicalize().ok()).ok_or_else(|| novo_account::SafeError::new("unavailable"))?;
        let hwnd = HWND(handle as *mut _);
        if !unsafe { IsWindow(Some(hwnd)) }.as_bool() { return Err(novo_account::SafeError::new("unavailable")); }
        let mut pid = 0; unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)); }
        let process = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).map_err(|_| novo_account::SafeError::new("unavailable"))? };
        let mut path = vec![0u16; 32_768]; let mut size = path.len() as u32;
        let result = unsafe { QueryFullProcessImageNameW(process, PROCESS_NAME_FORMAT(0), windows::core::PWSTR(path.as_mut_ptr()), &mut size) };
        let _ = unsafe { CloseHandle(process) };
        let matches = result.is_ok() && size > 0
            && Path::new(&String::from_utf16_lossy(&path[..size as usize])).canonicalize().is_ok_and(|path| path.to_string_lossy().eq_ignore_ascii_case(expected.to_string_lossy().as_ref()));
        if !matches { return Err(novo_account::SafeError::new("unavailable")); }
        unsafe {
            match action {
                "focus" => { if IsIconic(hwnd).as_bool() { let _ = ShowWindow(hwnd, SW_RESTORE); } let _ = SetForegroundWindow(hwnd); if windows::Win32::UI::WindowsAndMessaging::GetForegroundWindow() == hwnd { Ok(()) } else { Err(novo_account::SafeError::new("unavailable")) } }
                "minimize" => { let _ = ShowWindow(hwnd, SW_MINIMIZE); if IsIconic(hwnd).as_bool() { Ok(()) } else { Err(novo_account::SafeError::new("unavailable")) } }
                "maximize" => { let _ = ShowWindow(hwnd, SW_MAXIMIZE); if IsZoomed(hwnd).as_bool() { Ok(()) } else { Err(novo_account::SafeError::new("unavailable")) } }
                "restore" => { let _ = ShowWindow(hwnd, SW_RESTORE); if !IsIconic(hwnd).as_bool() && !IsZoomed(hwnd).as_bool() { Ok(()) } else { Err(novo_account::SafeError::new("unavailable")) } }
                _ => Err(novo_account::SafeError::new("invalid_request")),
            }
        }
    }
}
