# Dirección de movimiento para un landing premium

## 1. Empieza por la historia

Antes de escoger una librería, escribe la secuencia:

```text
qué problema existe → qué cambia → qué entiende el usuario → qué puede hacer ahora
```

Cada capítulo debe tener:

- una idea principal;
- un objeto visual que la represente;
- una transición que conecte con el capítulo siguiente;
- un estado final que funcione sin animación.

Antes de implementarla, valida los tres pilares de motion:

1. **Intención emocional:** calma, energía, precisión, sorpresa o confianza.
2. **Narrativa visual:** preparación → acción → resolución.
3. **Craft:** física creíble, jerarquía, curvas y movimiento secundario.

Si un efecto no aclara ninguna de esas cuatro cosas, elimínalo.

## 2. Lenguaje de escenas

Un landing high-end se siente como una serie de composiciones editoriales conectadas, no como una lista de secciones.

- **Entrada:** el contenido importante aparece con calma y jerarquía.
- **Ensamblaje:** piezas separadas se acercan, se alinean o comparten un camino.
- **Revelación:** una capa se aparta para mostrar la interfaz o la prueba.
- **Resolución:** el movimiento disminuye y deja espacio a la acción.

El scroll debe dar sensación de control. El visitante puede detenerse en cualquier punto y entender la composición.

## 3. Parallax multicapa

Separa una imagen o ilustración en planos con profundidad distinta:

| Plano | Ejemplo | Velocidad relativa |
| --- | --- | ---: |
| 0 | textura, grano, cielo | 0.04× |
| 1 | luz, nubes, atmósfera | 0.10× |
| 2 | fondo arquitectónico o paisaje | 0.18× |
| 3 | sujeto principal | 0.32× |
| 4 | objetos cercanos | 0.52× |
| 5 | texto, UI o camino | 0.78–0.94× |

No es necesario tener diez capas siempre. Cinco capas bien diferenciadas se perciben mejor que diez capas iguales.

### Reglas de composición

- Todas las capas deben compartir el mismo lienzo y punto de fuga.
- Usa `object-fit: cover` y un `object-position` definido por breakpoint.
- Deja margen de seguridad para que el movimiento no revele bordes vacíos.
- Evita que una capa decorativa cruce el título, el cursor o el CTA.
- La capa más rápida no debe ser automáticamente la más importante.

## 4. Objetos que cuentan algo

Las tarjetas, líneas, puntos, recortes y mockups deben tener un origen y un destino.

- Un dato puede venir de fuera y entrar a un núcleo.
- Una línea puede unir evidencia con una conclusión.
- Una imagen puede cambiar de escala para convertirse en una prueba del producto.
- Un CTA puede permanecer estable mientras la historia llega hasta él.

Evita objetos que flotan sin relación. Esa es la diferencia entre motion editorial y decoración genérica.

## 5. Ritmo y curvas

- Escoge una personalidad de movimiento para toda la web. Para una marca premium suele funcionar una curva controlada como `cubic-bezier(0.4, 0, 0.2, 1)` sin overshoot.
- Entrada de headline: 500–800 ms, `easeOut`.
- Card o mockup: 420–700 ms, desplazamiento corto de 12–32 px.
- Dibujo de camino: 900–1600 ms.
- Atmósfera: ciclos lentos de 18–32 s y amplitud pequeña.
- Usa rebote solo para una pieza que deba sentirse física.
- No combines blur, scale, opacity y rotation en todos los elementos; el contraste de ritmo crea elegancia.
- Regla de 1/3: no muevas un objeto más de un tercio de la pantalla sin una nueva clave espacial, y no pongas más de un tercio de los elementos en movimiento a la vez.
