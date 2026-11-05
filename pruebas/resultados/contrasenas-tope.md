# Prueba del tope de 50 intentos al generar contraseñas

Fecha: 2026-11-05 · Sin base de datos.

## 1. El tope

- ✅ El tope por omisión es de 50 intentos
- ✅ Si ninguna candidata sirve, falla (no sigue sin fin)
- ✅ Probó exactamente 50 veces antes de rendirse
- ✅ El error es claro y dice cuántos intentos se hicieron
- ✅ El tope se puede cambiar (para pruebas): con 7 prueba 7 veces

## 2. Funciona normal cuando hay una candidata buena

- ✅ Si la tercera candidata sirve, la devuelve y se detiene ahí
- ✅ Una candidata buena al primer intento se devuelve al primer intento
- ✅ La candidata que contiene el documento se rechaza (y se sigue probando)

## 3. La generación al azar de siempre sigue igual

- ✅ 300 contraseñas al azar: todas cumplen las reglas
- ✅ Todas de 12 caracteres
- ✅ No se repite ninguna

**Resultado: 11 de 11**
