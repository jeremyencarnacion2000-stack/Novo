// Coucou's tray actions, with Novo's account surface alongside the original island.
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Wry};
use crate::i18n::{n_, t};
use crate::island::WINDOW_LABEL;
const ITEMS: [(&str, &str); 6] = [
    ("open", n_("Open Novo Companion")),
    ("recap", n_("Weekly recap")),
    ("wardrobe", n_("Wardrobe…")),
    ("settings", n_("Novo settings…")),
    ("pause", n_("Pause")),
    ("quit", n_("Quit")),
];
struct Items(Vec<(&'static str, MenuItem<Wry>)>);
pub fn build(app: &AppHandle) -> tauri::Result<()> {
    let mut items = Vec::new();
    for (id, label) in ITEMS {
        items.push((label, MenuItem::with_id(app, id, t(label), true, None::<&str>)?));
    }
    let separator = PredefinedMenuItem::separator(app)?;
    let menu = Menu::with_items(app, &[
        &items[0].1, &separator, &items[1].1, &items[2].1,
        &items[3].1, &items[4].1, &items[5].1,
    ])?;
    app.manage(Items(items));
    let mut builder = TrayIconBuilder::with_id("novo-companion")
        .tooltip("Novo Companion")
        .menu(&menu)
        .on_menu_event(|app: &AppHandle, event| match event.id.as_ref() {
            "quit" => app.exit(0),
            "settings" => crate::show_settings_window(app),
            id => { let _ = app.emit_to(WINDOW_LABEL, "tray", id.to_string()); }
        });
    if let Some(icon) = app.default_window_icon().cloned() { builder = builder.icon(icon); }
    builder.build(app)?;
    Ok(())
}
pub fn retitle(app: &AppHandle) {
    let Some(items) = app.try_state::<Items>() else { return };
    for (label, item) in &items.0 { let _ = item.set_text(t(label)); }
}
