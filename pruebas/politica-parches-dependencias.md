# Parches de dependencias: rutina mensual y plazos

Aprobado por el dueño el 04/11/2026.

**Rutina:** el primer lunes de cada mes se corre la auditoría de dependencias del código (`npm audit` y `npm audit --omit=dev`, que muestra solo lo que llega a la app instalada) y se anota el resultado en la bitácora. Antes de actualizar algo se avisa al dueño; se actualiza solo con las pruebas pasando (`tsc`, lint, compilación y pruebas de la base).

**Plazos para corregir según la gravedad:**
| Gravedad | Plazo |
|---|---|
| Crítica | 3 días |
| Alta | 7 días |
| Media (moderada) | 30 días |
| Baja | se ve en la siguiente revisión mensual |

Cuenta el plazo desde el día en que aparece en la auditoría. Si la corrección rompe algo o no existe todavía, se anota el motivo y la fecha en que se vuelve a mirar.

**Estado al 04/11/2026:** 6 hallazgos (2 bajos, 4 moderados), todos en herramientas de compilación (`vite-plugin-pwa` → `workbox-build`); 0 en el código que llega al navegador. Se actualizó solo `serialize-javascript` (7.1.2 → 7.1.4). Los 4 moderados vencen el 04/12/2026 si siguen sin corrección; la «solución» que ofrece npm (bajar `vite-plugin-pwa` a 1.1.0) no se usa.
