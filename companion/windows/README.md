# Novo Companion para Windows

Versión actual: **0.2.7**.

[Descargar el instalador](https://github.com/jeremyencarnacion2000-stack/Novo/releases/download/companion-v0.2.7/Novo-Companion-Windows-0.2.7-setup.exe) · [Alternativa MSI](https://github.com/jeremyencarnacion2000-stack/Novo/releases/download/companion-v0.2.7/Novo-Companion-Windows-0.2.7.msi)

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

La versión 0.2.7 compiló e instaló correctamente. Pasaron 367 de 368 pruebas. La comprobación de paridad del catálogo de traducciones requiere el archivo externo del proyecto original `NotchBuddy/Resources/Localizable.xcstrings`, que no forma parte de este repositorio.

El contexto de Codex procede de las sesiones observadas por la integración; la lectura completa de su historial y la actualización automática persistente del Twin siguen pendientes.

## Licencias

Derivado de [Coucou](https://github.com/Louis-CFM/coucou), revisión `a7bd575e90253673e7e08370a78f1261eb53ac2f`, bajo licencia MIT. Se conserva el nombre del relé `coucou-hook.exe` por compatibilidad. Consulta `THIRD-PARTY-LICENSE.txt` para los avisos completos y la licencia de Manrope.
