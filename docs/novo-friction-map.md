# Novo friction map

| Fricción | Evidencia | Impacto | Corrección |
|---|---|---:|---|
| Demasiados destinos primarios | Sidebar y drawer enumeran módulos legacy | Alto | Cuatro destinos primarios |
| Navegación móvil inconsistente | MobileNav usa Stats/Home; drawer usa Dashboard/AI | Alto | Misma taxonomía Today/Cognitive/Chat/Activity |
| Statistics-first | Analytics y widgets históricos visibles junto al kernel | Alto | Secondary/collapsible |
| Inglés residual | Labels Settings/Profile/Stats/Calendar en drawer | Medio | Usar `useTranslation` y copy del idioma activo |
| Acciones con igual prominencia | Today y módulos muestran varias entradas | Alto | Brief + una acción dominante |
| Actividad duplicada | Chat, notifications y activity surface pueden repetir estado | Medio | Contrato común y progressive disclosure |
| Legacy cognitivo | Scores históricos pueden parecer medición | Alto | Etiquetas operativas y ocultación de métricas no accionables |
| Carga pesada global | Música y widgets se montan fuera del kernel | Medio | Lazy/progressive loading y navegación secundaria |

No se infieren conclusiones de usuarios hasta instrumentar y observar sesiones reales.
