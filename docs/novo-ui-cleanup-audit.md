# Novo UI cleanup audit

Fecha: 2026-08-04

## Dirección

La interfaz debe hacer perceptible un segundo yo cognitivo: understanding, adaptation, agency y continuity. No se eliminan datos ni rutas; se reduce la atención primaria y se usa progressive disclosure.

## Inventario de superficies

| Superficie | Propósito | Pilar | Fricción | Duplicación | Clasificación | Acción |
|---|---|---|---|---|---|---|
| `/today` | Próxima acción y loops | Agency/Continuity | Varias cards y tareas con igual peso | Analytics/Checklist | Core | Mantener; brief dominante |
| `/cognitive` | Modelo vivo explicable | Understanding/Adaptation | Puede abrir como statistics-first | Analytics/Twin legacy | Core | Mantener; brief antes del grafo |
| `/ai` | Conversar y actuar con Twin | Agency/Continuity | Navegación y controles repetidos | Activity | Core | Consolidar actividad y composer |
| Activity/AI runs | Qué ocurrió y qué sigue | Continuity | Parte de la superficie está embebida | Chat/notifications | Core | Unificar protocolo |
| `/projects`, `/checklist`, `/calendar` | Contexto y ejecución | Agency | Demasiados destinos primarios | Today | Supporting | Secundario |
| `/analytics` | Evidencia histórica | Adaptation | Statistics-first y poco accionable | Cognitive | Secondary | Mover a vista secundaria |
| `/connectors` | Fuentes y permisos | Continuity | Configuración compite con valor | Settings | Supporting | Secundario |
| `/routines`, `/trackers` | Hábitos y recurrencia | Supporting | No son wedge inicial | Checklist | Experimental | More/Labs |
| `/music` | Ambiente | Ninguno del kernel | Distracción y carga pesada | Voice/audio | Distracting | Ocultar de navegación primaria |
| `/social`, `/school`, `/business` | Contextos especializados | Experimental | Amplían demasiado la propuesta | Projects | Legacy/Experimental | More/Labs |
| `/library`, `/spiritual`, `/appearance` | Apoyo personal | Supporting bajo | Desvía onboarding | Journal | Legacy | More/Labs |
| Settings/Profile | Control y cuenta | Continuity | Duplicación en nav móvil/sidebar | Billing/Connectors | Supporting | Un único acceso |

## Hallazgos

1. `components/app-sidebar.tsx` expone más de veinte destinos en tres grupos; Today, AI y Cognitive compiten con analytics, focus y módulos de vida.
2. `components/mobile-section-drawer.tsx` repite una taxonomía distinta (Overview/Productivity/Life & Growth) y usa labels en inglés mientras el selector de idioma existe.
3. `components/mobile-nav.tsx` muestra Home/Stats/Calendar/AI, omitiendo Today y Cognitive, por lo que la navegación móvil no refleja el kernel.
4. `components/dashboard-shell.tsx` monta VoiceCommandHub globalmente en superficies no fullscreen; debe conservarse como acceso contextual, no como segunda navegación.
5. El backend ya ofrece recommendation, evidence, activity y graph; el trabajo principal es jerarquía, no nuevos módulos.

## Antes / después conceptual

- Antes: `/`, `/today`, `/analytics`, `/calendar`, `/ai`, `/cognitive`, `/focus` con igual presencia.
- Después: Today · Cognitive · Chat · Activity como destinos primarios; Workspace y More/Labs como capas secundarias.

## Elementos que no se borran

Las rutas legacy siguen accesibles por URL y sus datos permanecen. La limpieza solo reduce su presencia en navegación primaria y documenta el motivo.
