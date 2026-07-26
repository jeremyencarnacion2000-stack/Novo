# QA prompt — Notion/Todoist/Slack integrations (2026-07-22)

```
/qa https://productivitynovo.vercel.app --standard

Enfócate en /connectors (el catálogo de integraciones), no en toda la app.
Esto es lo que cambió en la última sesión y necesita verificación:

1. Notion — reconexión ya no debe borrar las bases de datos seleccionadas.
   - Conecta Notion, selecciona al menos una base de datos.
   - Desconecta y vuelve a conectar (o pulsa "Conectar Notion" de nuevo).
   - Verifica que las bases de datos seleccionadas siguen ahí, no en 0.

2. Todoist — flujo completo nuevo.
   - Debe seguir mostrando "Conectar Todoist" con un aviso claro
     (no un error silencioso) si TODOIST_CLIENT_ID/SECRET/REDIRECT_URI
     no están configurados en Vercel todavía — confirma que el botón no
     falla en silencio.
   - Si ya están configuradas las credenciales: completa el OAuth,
     confirma que el selector de proyectos se auto-abre, selecciona un
     proyecto, sincroniza, verifica que las tareas aparecen en /checklist
     y en el today feed.
   - Marca una tarea sincronizada como completada en Novo y confirma
     (vía la cuenta real de Todoist) que también se cerró allá.

3. Slack — canal de entrega, no de sincronización.
   - Mismo chequeo de credenciales-no-configuradas que Todoist.
   - Si están configuradas: conecta, elige un canal, envía el mensaje
     de prueba, confirma que llega al canal de Slack real.

4. WhatsApp Business y Apple Calendar — deben mostrarse como
   "Activación pendiente" con el motivo real explicado (verificación de
   Meta Business / CalDAV) al hacer clic — no un "Disponible próximamente"
   genérico, y no deben intentar iniciar un flujo de conexión.

5. Regresión general: abre la consola del navegador en /connectors y
   /today — cero errores de JS. Confirma que ningún otro conector
   (Drive, Calendar, Gmail, Spotify, YouTube) se rompió por los cambios
   de esta sesión.

Reporta hallazgos por severidad. No arregles nada sin confirmar conmigo
primero si toca lógica de OAuth o tokens.
```
