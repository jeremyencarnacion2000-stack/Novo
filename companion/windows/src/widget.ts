import { invoke } from "@tauri-apps/api/core";

const openButton = document.querySelector<HTMLButtonElement>("#open-companion");
openButton?.addEventListener("click", () => {
  void invoke("novo_widget_open");
});
