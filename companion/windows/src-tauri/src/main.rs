// Keep the companion quiet when launched as a desktop app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    novo_companion_lib::run()
}
