## YouTube Channel Grouper (Brave/Chrome extension)

**Objetivo**: Crear grupos de canales de YouTube (music, sports, news, etc.) y en tu página de inicio de YouTube ver una tarjeta con el último vídeo de cada canal del grupo seleccionado.

### Estructura del Proyecto

Los archivos de la extensión ahora se encuentran en la carpeta `src/` para mantener el directorio raíz limpio:

- `src/manifest.json` – Manifiesto MV3 de la extensión.
- `src/contentScript.js` – Lógica que se inyecta en `youtube.com`.
- `src/styles.css` – Estilos visuales.
- `src/options.html` / `src/options.js` – Página de opciones.

### Cómo cargar la extensión en Brave/Chrome

1. Abre `brave://extensions/` o `chrome://extensions/`.
2. Activa **Modo desarrollador**.
3. Pulsa **Cargar extensión sin empaquetar**.
4. Selecciona la carpeta **src**: `~/dev/channel-groups/src`.

### Cómo usarla

1. **Configurar API key**:
   - En `brave://extensions/`, en _YouTube Channel Grouper_ pulsa **Detalles** → **Opciones de la extensión**.
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
