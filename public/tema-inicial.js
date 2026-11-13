// Aplica el tema elegido (claro u oscuro) antes de dibujar la app, para que no parpadee.
// Va en un archivo aparte (y no escrito dentro de index.html) para que las cabeceras de seguridad de vercel.json
// puedan prohibir todo código escrito dentro de la página (análisis de seguridad del 12/11/2026, hallazgo B1).
try {
  var t = localStorage.getItem('crc-tema')
  if (t === 'claro') document.documentElement.setAttribute('data-theme', 'light')
  else if (t === 'oscuro') document.documentElement.setAttribute('data-theme', 'dark')
} catch (e) {}
