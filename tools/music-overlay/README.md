# Hot Coffee · Music Overlay para OBS

Overlay compacta y transparente para mostrar la canción que está sonando en YouTube o YouTube Music. La captura se hace en tu navegador y el estado se queda en tu PC: no se modifica el backend de Hot Coffee ni se suben tus datos de reproducción a un servicio remoto.

## Requisitos

- Windows, macOS o Linux.
- Node.js 18 o superior.
- Chrome o Edge para la extensión.
- OBS ejecutándose en el mismo ordenador.

## 1. Iniciar el puente local

Abre una terminal en la carpeta raíz de Hot-Coffee-Frontend y ejecuta:

    node tools/music-overlay/server.mjs

La primera vez se genera un token local y se guarda en tools/music-overlay/.music-bridge-token (está excluido de Git). Copia el token que aparece en la consola; lo necesitarás en el siguiente paso.

El servidor escucha únicamente en 127.0.0.1:4317.

## 2. Instalar la extensión de YouTube

1. Abre chrome://extensions o edge://extensions.
2. Activa el modo de desarrollador.
3. Pulsa «Cargar descomprimida».
4. Selecciona la carpeta tools/music-overlay/extension.
5. Abre los detalles de «Hot Coffee · YouTube Music Bridge» y entra en «Opciones».
6. Pega el token mostrado por server.mjs y guarda.

La extensión lee el vídeo que está reproduciéndose en las pestañas de YouTube y YouTube Music y envía únicamente título, canal/artista, imagen, duración, posición y estado al servidor local. No captura ni transmite audio.

## 3. Añadir a OBS

Crea una fuente «Navegador» y configura:

- URL: http://127.0.0.1:4317/overlay
- Ancho: 520
- Alto: 110

La página es transparente. Si no hay una canción activa, la tarjeta se oculta; no tapa el juego. Para revisar el diseño sin abrir YouTube, visita:

    http://127.0.0.1:4317/overlay?demo=1

Deja abierta la terminal mientras uses la overlay. Para apagar el puente, pulsa Ctrl+C.

## Límites de esta primera versión

- La fuente de YouTube debe estar abierta en el mismo perfil de Chrome/Edge donde instalaste la extensión.
- La información puede tardar uno o dos segundos en reflejar un cambio de canción.
- La portada se muestra solo si YouTube proporciona una imagen compatible.
- La versión actual cubre YouTube y YouTube Music. No incluye todavía una integración de Spotify.

## Sobre Spotify

La documentación oficial de Spotify para su Web API advierte que el contenido de Spotify no puede usarse para emisiones no interactivas. Como el propósito aquí es mostrar información durante un stream, no añadí una conexión automática de Spotify basada en su API. Antes de incorporarla habría que confirmar con Spotify qué uso de metadatos y carátulas permite en una emisión en directo.
