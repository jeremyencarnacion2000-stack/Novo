use tauri::{AppHandle, Manager, PhysicalPosition, WebviewUrl, WebviewWindowBuilder};

const LABEL: &str = "novo-widget";
const SIDE: f64 = 84.0;
const EDGE_GAP: f64 = 22.0;

/// Creates Novo's small, transparent desktop companion independently from its full panel.
pub fn setup(app: &AppHandle) -> tauri::Result<()> {
    let widget = WebviewWindowBuilder::new(app, LABEL, WebviewUrl::App("widget.html".into()))
        .title("Novo")
        .inner_size(SIDE, SIDE)
        .resizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible_on_all_workspaces(true)
        .focused(false)
        .maximizable(false)
        .minimizable(false)
        .closable(false)
        .visible(false)
        .build()?;

    if let Ok(Some(monitor)) = app.primary_monitor() {
        let scale = monitor.scale_factor();
        let origin = *monitor.position();
        let size = *monitor.size();
        let side = (SIDE * scale).round() as i32;
        let gap = (EDGE_GAP * scale).round() as i32;
        let x = (origin.x + size.width as i32 - side - gap).max(origin.x);
        let y = origin.y + gap;
        widget.set_position(PhysicalPosition::new(x, y))?;
    } else {
        widget.center()?;
    }

    widget.show()?;
    Ok(())
}

#[tauri::command]
pub fn novo_widget_open(app: AppHandle) {
    if let Some(window) = app.get_webview_window("island") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();
    }
}
