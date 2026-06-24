# Novo Design Language (NDL)

Version 1.0

> "The interface is a living cognitive organism."

---

## 1. Filosofía & Visión

Novo no es una aplicación de productividad tradicional; es un **sistema cognitivo**. El diseño es el puente biológico entre el cerebro del usuario y el estado de la máquina.

Toda decisión visual e interactiva debe responder a la búsqueda de:
*   **Inteligencia:** La interfaz parece predecir la intención del usuario.
*   **Precisión:** La información se presenta con exactitud quirúrgica, sin ruido superfluo.
*   **Calma:** Reducción sistemática de la fricción sensorial para optimizar la carga cognitiva.
*   **Adaptación:** El entorno transmuta de forma continua según el estado neurológico.
*   **Elegancia:** Una estética refinada de tecnología invisible, donde "todo parece inevitable".

### Lo que NUNCA debe ser Novo:
*   ❌ **Gamer:** Sin luces estridentes, contrastes hiperactivos o decorados innecesarios.
*   ❌ **Cyberpunk:** Sin estéticas distópicas, fallos digitales (glitches) simulados o ruido neón.
*   ❌ **Futurista Exagerado:** Sin interfaces de ciencia ficción imprácticas (FUI).
*   ❌ **Flashy:** Sin transiciones bruscas o animaciones meramente cosméticas.
*   ❌ **Lleno de efectos:** Cada efecto debe tener un propósito adaptativo y funcional directo.

---

## 2. Principios de Diseño Cognitivo

### Principio 1: Every animation must communicate information.
Toda animación tiene significado y comunica un cambio de estado interno. La animación meramente decorativa está prohibida.
*   **Hover:** *"Esto es interactivo y está listo para ser activado."*
*   **Glow:** *"Esto es importante o requiere tu atención inmediata."*
*   **Respiración:** *"El sistema está vivo, procesando en segundo plano."*
*   **Pulso:** *"Algo ha cambiado y requiere confirmación o lectura."*
*   **Ripple:** *"El sistema ha confirmado tu acción táctil o click."*

### Principio 2: The interface must breathe.
Ningún elemento debe ser 100% estático. La interfaz entera mantiene ciclos suaves y sutiles de respiración biológica:
*   **Orb central:** Variación de escala entre `99%` y `101%` en ciclos de 6 segundos.
*   **Glow:** Fluctuación de opacidad de luz ambiental del `8%` al `10%`.
*   **Blur:** Modulación dinámica del desenfoque entre `16px` y `18px`.

### Principio 3: Motion follows cognition.
La velocidad y el tempo de la interfaz son directamente proporcionales al estado cognitivo del usuario:
*   **Peak Focus (Alta Concentración):**
    *   Respuestas ultra-rápidas.
    *   Transiciones de hover: `100ms`.
    *   Transiciones de tarjetas: `180ms`.
    *   Cursor Glow: Intensidad máxima y enfoque concéntrico.
*   **Recovery (Recuperación / Cansancio):**
    *   Respuestas pausadas y orgánicas.
    *   Transiciones de hover: `180ms`.
    *   Transiciones de tarjetas: `320ms`.
    *   Glow: Muy suave, disperso y de baja luminancia.
*   **Late Night (Noche / Fatiga Extrema):**
    *   Animaciones: 30% más lentas para evitar sobre-estimulación.
    *   Colores: Desplazamiento hacia tonos cálidos (sepia/ámbar) atenuando luz azul.

### Principio 4: Interface density adapts.
La densidad de la información se ajusta según la carga de trabajo mental del usuario:
*   **Carga Mental Alta (Sobrecarga detectada):**
    *   Se ocultan automáticamente widgets secundarios o métricas no esenciales.
    *   Se simplifican o colapsan gráficos complejos.
    *   Se incrementa el espaciado (padding/gap) para dar "aire" a la interfaz.
    *   Se amplía el tamaño visual del editor o de la tarea principal en foco.
*   **Claridad Alta (Bajo estrés, alto rendimiento):**
    *   Mayor densidad visual de información.
    *   Paneles multi-tarea visibles con accesos rápidos.
    *   Gráficos detallados y analíticas en tiempo real expuestas.

---

## 3. Color System

No existen colores decorativos. Cada color en el espectro Novo representa un estado cognitivo o del sistema.

### Palette Primitives
*   **Neural Purple:** `#7C3AED` — Representa el pensamiento, la inteligencia artificial y el estado de reflexión profunda.
*   **Execution Blue:** `#3B82F6` — Representa la acción directa, la ejecución de tareas y el progreso dinámico.
*   **Recovery Cyan:** `#06B6D4` — Representa el reposo, el bienestar, la calma y la recarga de energía.
*   **Signal White:** `#F8FAFC` — Contraste de lectura y foco principal.
*   **Surface:** `#080808` — La base de los paneles y contenedores.
*   **Background:** `#040404` — El lienzo infinito del sistema.

### Semantic State Mapping
| Color | Código Hex | Estado Representado |
| :--- | :--- | :--- |
| **Morado** | `#7C3AED` | Pensamiento / IA / Peak Focus |
| **Azul** | `#3B82F6` | Ejecución / Tareas Activas / Linear Execution |
| **Cyan** | `#06B6D4` | Recuperación / Descanso / Synaptic Fatigue |
| **Verde** | `#10B981` | Progreso / Completado con éxito |
| **Ámbar** | `#F59E0B` | Advertencia / Carga mental media-alta |
| **Rojo** | `#EF4444` | Estado crítico / Fricción extrema / Reduced Capacity |

---

## 4. Glass System & Blur System

El vidrio (glass) es la textura primordial de Novo, ofreciendo profundidad espacial mediante difracción y refracción.

### Glass Levels
1.  **Glass Surface (Cards & Paneles Internos):**
    ```css
    background: rgba(255, 255, 255, 0.03);
    backdrop-filter: blur(18px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.06);
    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.35), 
                inset 0 1px 0 rgba(255, 255, 255, 0.08);
    ```
2.  **Floating Glass (Dialogs & Overlays flotantes):**
    ```css
    background: rgba(255, 255, 255, 0.04);
    backdrop-filter: blur(28px) saturate(180%);
    border: 1px solid rgba(255, 255, 255, 0.08);
    box-shadow: 0 25px 70px rgba(0, 0, 0, 0.45), 
                inset 0 1px 0 rgba(255, 255, 255, 0.12);
    ```
3.  **Active Glass (Elementos seleccionados / Foco activo):**
    *   Glow sutil en los bordes utilizando el color semántico del estado actual.
    *   Gradiente interior extremadamente suave en su base.
    *   Borde refractivo vivo, pero nunca brillante o saturado.

---

## 5. Bloom System & Shadows

### Bloom Levels
*   **Soft:** Luminancia sutil de 8px a 12px, solo visible sobre fondo completamente negro. Usado para estados secundarios.
*   **Medium:** Foco de luz de 15px a 25px. Usado para destacar tarjetas activas o tareas prioritarias.
*   **Strong:** Bloom expansivo de 40px a 60px. **Reservado exclusivamente para el Orb central, estados de Héroe e interacciones de Inteligencia Artificial.** Nunca usar en botones o elementos normales.

### Shadow System
*   **Shadow XS:** Usado exclusivamente en estados de *Hover* de botones pequeños o inputs.
*   **Shadow S:** Usado por defecto en tarjetas (`Cards`).
*   **Shadow M:** Usado en diálogos flotantes (`Dialogs`).
*   **Shadow L:** Reservado para secciones de estado `Hero`.
*   **Shadow XL:** Reservado exclusivamente para el `Orb` central.

---

## 6. Border Radius & Grid System

### Border Radius System
*   **Cards:** `20px` (radio interno estándar).
*   **Paneles:** `28px` (contenedores principales).
*   **Dialogs:** `34px` (modales y ventanas emergentes).
*   **Orb:** `999px` (perfectamente circular).
*   *Nota: No se permiten radios aleatorios o diferentes a estos primitivos.*

### Grid System (Escala de Espaciados Oficial)
Se utiliza una cuadrícula de espaciado estricta de base 4/8:
$$\{4, 8, 12, 16, 24, 32, 40, 64, 96\} \text{ pixels}$$
*Cualquier value de margen, padding o separación que no pertenezca a esta escala está prohibido.*

---

## 7. Typography System

Tipografía corporativa limpia, enfocada en la legibilidad y la jerarquía editorial.

| Nivel | Tamaño (px) | Peso | Estilo / Transformación | Carta de Espaciado |
| :--- | :--- | :--- | :--- | :--- |
| **Display** | `72px` | ExtraLight | Cursiva / Suave | Normal |
| **Section Title** | `34px` | SemiBold | Normal | Normal |
| **Metric** | `52px` | Bold | Numérico / Mono | Estrecho |
| **Label** | `11px` | Black / Bold | Mayúsculas (Uppercase) | Tracking `0.28em` |
| **Body** | `16px` | Regular | Normal | Normal |
| **Caption** | `13px` | Medium | Normal | Normal |

---

## 8. Motion Language & Easing Curves

Las animaciones imitan el movimiento natural de los tejidos orgánicos. No se permite la aceleración lineal ni el suavizado por defecto (`ease`).

### Easing Primitives
*   **Deceleration (Fast Out, Slow In):** `cubic-bezier(0.16, 1, 0.3, 1)` (Curva ultra-premium para menús y modales).
*   **Cognitive Transition:** `cubic-bezier(0.65, 0, 0.35, 1)` (Curva bi-direccional simétrica para cambios de estado).

### Motion Spec Matrix
*   **Hover:** `120ms` (escala máxima `1.02`).
*   **Press:** `90ms` (escala de presión `0.98`).
*   **Card Transition:** `220ms` (animación de opacidad y desplazamiento sutil).
*   **Panel Morphing:** `350ms` (redimensionamiento de paneles grandes).
*   **Navigation:** `450ms` (deslizamientos de pestañas principales).
*   **Adaptation (Phase Change):** `800ms` (transiciones suaves de color y densidad de la interfaz).
*   **Prediction:** `1000ms` (animaciones de anticipación cognitiva).

---

## 9. SVG Semantic Language

Los elementos vectoriales y animaciones de iconos responden directamente a su semántica en el sistema:
*   **Cognitive Clarity:** Orb perfecto, rotación extremadamente lenta y luz uniforme sin perturbación.
*   **Execution Momentum:** Líneas cinéticas de avance. Siempre se mueven hacia adelante (izquierda a derecha), simbolizando avance y finalización.
*   **Recovery Reserve:** Ondas expansivas y de contracción lentas en imitación de la respiración pulmonar.
*   **Cognitive Friction:** Micro-vibraciones en alta frecuencia, compresión de formas e imperceptibles pérdidas de nitidez temporal.
*   **Prediction:** Partículas convergentes que fluyen hacia un punto central indicando la focalización del sistema.
*   **Sync:** Ondas circulares (ripples) que se expanden desde el punto de acción del usuario.

---

## 10. Matriz de Estados de Componentes

Todo componente interactivo debe implementar obligatoriamente los siguientes estados visuales sin excepción:

1.  **Idle:** Estado base pasivo, integrado armónicamente en el vidrio de fondo.
2.  **Hover:** Aumento sutil de contraste, escala `1.02` y activación de luz difusa de fondo.
3.  **Active:** Borde refractivo y cambio en el gradiente de fondo, escala `0.98` durante el click.
4.  **Focus:** Anillo de foco bien definido de 2px `rgba(124, 102, 241, 0.8)` con separación (outline-offset).
5.  **Loading:** Desvanecimiento del texto y activación de animación de respiración en el Orb de carga.
6.  **Disabled:** Opacidad reducida al `35%`, remoción de eventos de puntero y eliminación de cualquier efecto de hover/glow.
7.  **Cognitive Adaptive:** Ajuste de los valores de sombra, bordes y color de destaque según la fase cognitiva actual (PEAK, LINEAR, FATIGUE, REDUCED).

---

## 11. Reglas de Diseño Cognitivo (Auditoría de Componentes)

Para garantizar la coherencia funcional del sistema, cada componente visible debe ayudar a responder activamente al menos una de las siguientes **cinco preguntas fundamentales**:
1.  **¿Qué está observando Novo?** (Ej. Indicadores de cámara, biometría, pulso, actividad de teclado).
2.  **¿Qué entiende Novo de lo observado?** (Ej. Indicador del estado cognitivo actual, medidor de carga mental).
3.  **¿Qué predice Novo?** (Ej. Tarea recomendada para el siguiente intervalo, predicción de fatiga en la próxima hora).
4.  **¿Qué recomienda hacer ahora?** (Ej. Foco en tarea de alta prioridad, tomar descanso de 5 minutos, cambiar música).
5.  **¿Qué aprendió Novo después de la acción del usuario?** (Ej. Feedback de aprendizaje tras click/descarte, actualización de perfil de hábito).

*Cualquier panel, botón o métrica que no contribuya a responder ninguna de estas preguntas se considera ruido visual y debe ser simplificado o eliminado del sistema.*
