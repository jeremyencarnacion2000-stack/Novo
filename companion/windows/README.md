# Novo Companion para Windows

Versión preparada: **0.2.10**.

[Descargar el instalador](https://github.com/jeremyencarnacion2000-stack/Novo/releases/download/companion-v0.2.10/Novo-Companion-Windows-0.2.10-setup.exe) · [Alternativa MSI](https://github.com/jeremyencarnacion2000-stack/Novo/releases/download/companion-v0.2.10/Novo-Companion-Windows-0.2.10.msi)

## Novedades de 0.2.10

- Unifica la cuenta, el asistente, las conexiones, las carpetas autorizadas y la actividad delegada bajo la identidad de Novo.
- Comparte el mismo estado de seguimiento entre el Companion, el chat y la actividad web. Los trabajos distinguen seguimiento de permiso de ejecución, muestran los resultados y requieren aprobación para guardar cambios internos.
- Presenta los archivos y comprobaciones de una propuesta con su referencia local. El parche permanece en el PC autorizado y los archivos originales no se modifican.
- Añade dictado de voz de activación manual al chat abierto del Companion: revisas el texto antes de enviarlo y no se crea una conversación nueva.
- Sincroniza con el Twin solo un resumen breve y depurado de la tarea y el resultado de Codex; no envía historial completo, rutas, código ni salidas de herramientas.

## Conectar

Abre el compañero y entra en Configuración → Cuenta. Conecta tu cuenta de Novo mediante el navegador o un token con acceso al compañero y al chat. Los tokens antiguos necesitan reautorizar los permisos nuevos para consultar proyectos.

La configuración única reúne Cuenta y privacidad, Asistente, Conexiones y Escritorio. Las carpetas se eligen en Asistente; las consultas leen solo las fuentes autorizadas. Los proyectos locales, GitHub y Vercel se relacionan por identificadores verificables; el nombre por sí solo es una coincidencia probable. La captura de actividad es opcional.

## Desarrollo

Requisitos: Node.js, Rust, herramientas de compilación de Windows y WebView2. Ejecuta desde esta carpeta:

```powershell
npm ci
npm run build
npm test
npm run pack
```

Los instaladores se generan en `release/`. No se guardan en Git: se publican como archivos de GitHub Releases. Credenciales, preferencias, carpetas personales y archivos compilados quedan fuera del repositorio.

## Estado de las comprobaciones

El seguimiento actualiza Twin y el contexto del proyecto desde fuentes autorizadas y resultados verificados. No lee el historial completo de Codex. La actualización en segundo plano requiere configurar el secreto `NOVO_PROJECT_REFRESH_SECRET` en GitHub Actions para que el flujo llame al endpoint protegido de Vercel.

Para compartir contexto de Codex, confía sus hooks desde Codex con `/hooks` y empieza una sesión nueva. El Companion conserva solo el nombre breve del proyecto y el resumen depurado de la tarea/resultado; la lectura completa del historial sigue pendiente.

## Licencias

Derivado de [Coucou](https://github.com/Louis-CFM/coucou), revisión `a7bd575e90253673e7e08370a78f1261eb53ac2f`, bajo licencia MIT. Se conserva el nombre del relé `coucou-hook.exe` por compatibilidad. Consulta `THIRD-PARTY-LICENSE.txt` para los avisos completos y la licencia de Manrope.
