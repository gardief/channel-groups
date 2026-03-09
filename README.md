## YouTube Channel Grouper (Brave/Chrome extension)

**Objetivo**: Crear grupos de canales de YouTube (music, sports, news, etc.) y en tu página de inicio de YouTube ver una tarjeta con el último vídeo de cada canal del grupo seleccionado.

### Estructura en la carpeta root

En `/home/diego/dev/channel-groups` ahora tienes todo lo necesario para la extensión:

- `manifest.json` – Manifiesto MV3 de la extensión.
- `contentScript.js` – Lógica que se inyecta en `youtube.com` (canales y home).
- `styles.css` – Estilos del botón flotante, overlay y grid de vídeos.
- `options.html` / `options.js` – Página de opciones para:
  - Gestionar el API key de YouTube.
  - Crear, renombrar y borrar grupos.
- `icons/` – (opcional) Coloca aquí `icon16.png`, `icon48.png`, `icon128.png` si quieres iconos personalizados.

Las carpetas antiguas `channel-grouper-extension` y `yt-channel-grouper-extension` ya no se usan; puedes borrarlas manualmente si quieres dejar el repo limpio.

### Modelo de datos

En `chrome.storage.sync`:

- **`ytChannelGroups`**: objeto `{ [groupId]: { id, name, color } }`
- **`ytChannelTags`**: objeto `{ [channelId]: string[] }` (ids de grupos asignados al canal)

En `chrome.storage.local`:

- **`ytApiKey`**: tu API key de YouTube Data API v3.

### Cómo cargar la extensión en Brave

1. Abre `brave://extensions/`.
2. Activa **Modo desarrollador**.
3. Pulsa **Cargar extensión sin empaquetar**.
4. Selecciona la carpeta root: `~/dev/channel-groups`.

### Cómo usarla

1. **Configurar API key**:
   - En `brave://extensions/`, en *YouTube Channel Grouper* pulsa **Detalles** → **Opciones de la extensión**.
   - Pega tu API key de YouTube Data API v3 y guarda.
2. **Crear grupos**:
   - Desde la página de opciones, crea grupos como `Music`, `News`, `Sports`, etc.
3. **Asignar canales a grupos**:
   - Ve a cualquier página de canal de YouTube.
   - Usa el botón flotante **“Assign to groups”**.
   - Marca los grupos a los que quieres asignar ese canal y guarda.
4. **Ver últimos vídeos por grupo**:
   - Ve a `https://www.youtube.com/` (home o `/feed/subscriptions`).
   - En la parte superior verás las chips de grupos.
   - Al seleccionar un grupo se cargará el **último vídeo** de cada canal etiquetado con ese grupo (hasta un máximo de 20 canales).

