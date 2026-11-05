# Prueba de la cola de envío: tope de 12 intentos y espera mínima de 30 s

Fecha: 2026-11-05 · Funciones puras (sin base de datos).

## 1. Las constantes aprobadas

- ✅ El tope es de 12 intentos
- ✅ Las esperas son 30 s, 1, 2, 5, 15 y 30 min
- ✅ La espera mínima entre intentos es de 30 segundos
- ✅ Después de la sexta espera se repite la de 30 min

## 2. Tras fallar: espera creciente y, al llegar al tope, «necesita atención»

- ✅ Fallo n.º 1: sigue pendiente y queda con 1 intento(s)
- ✅ Fallo n.º 2: sigue pendiente y queda con 2 intento(s)
- ✅ Fallo n.º 3: sigue pendiente y queda con 3 intento(s)
- ✅ Fallo n.º 4: sigue pendiente y queda con 4 intento(s)
- ✅ Fallo n.º 5: sigue pendiente y queda con 5 intento(s)
- ✅ Fallo n.º 6: sigue pendiente y queda con 6 intento(s)
- ✅ Fallo n.º 7: sigue pendiente y queda con 7 intento(s)
- ✅ Fallo n.º 8: sigue pendiente y queda con 8 intento(s)
- ✅ Fallo n.º 9: sigue pendiente y queda con 9 intento(s)
- ✅ Fallo n.º 10: sigue pendiente y queda con 10 intento(s)
- ✅ Fallo n.º 11: sigue pendiente y queda con 11 intento(s)
- ✅ Las esperas crecen 30, 60, 120, 300, 900 y 1800 s y luego se quedan en 1800 s
- ✅ Hasta el fallo 11 todavía se reintenta sola
- ✅ El fallo n.º 12 la pasa a «necesita atención»
- ✅ Al pasar a «necesita atención» ya no tiene próximo intento programado
- ✅ Aunque algo la intentara una vez más, sigue en «necesita atención»
- ✅ Las esperas programadas de los primeros 11 fallos suman unas 3 horas (la cifra de «unas 6 horas» del informe era una cota alta)

## 3. Quién se reintenta sola

- ✅ «enviada» no se reintenta sola, ni con envío forzado
- ✅ «rechazada» no se reintenta sola, ni con envío forzado
- ✅ «atencion» no se reintenta sola, ni con envío forzado
- ✅ «necesita atención» tampoco se reintenta sola cada 60 s ni al volver la señal
- ✅ Una pendiente nueva (sin intentos) sale en el envío normal
- ✅ Una «enviando» que quedó a medias (la app se cerró) se retoma
- ✅ Una pendiente con la espera sin cumplir NO sale en el envío normal
- ✅ …y sale cuando la espera se cumple

## 4. Envío forzado: se salta la espera creciente pero respeta los 30 segundos mínimos

- ✅ Forzado a los 10 s del último intento: NO sale
- ✅ Forzado a los 29,999 s: NO sale
- ✅ Forzado justo a los 30 s: sale, aunque la espera creciente (30 min) no se haya cumplido
- ✅ Forzado a los 5 min: sale
- ✅ Una señal que se corta y vuelve 5 veces en 20 s no produce reintentos
- ✅ Envío normal con la espera cumplida pero a menos de 30 s del último intento: NO sale
- ✅ Una inspección que nunca se intentó sale forzada de inmediato
- ✅ Cada inspección cuenta su propio último intento (una reciente no bloquea a otra antigua)

## 5. «Reintentar ahora» (a mano)

- ✅ El envío manual no espera ni la espera creciente ni los 30 s
- ✅ Tras reintentar a mano los intentos vuelven a cero: se cuenta de nuevo hasta 12
- ✅ «Necesita atención» no se reintenta ni con el indicador manual hasta que el botón la devuelva a «pendiente»

**Resultado: 40 de 40**
