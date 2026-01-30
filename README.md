# Postit

Sticky notes for your browser.

## Demo

Open `index.html` in your browser for a plugin-less demo (uses localStorage).

## Install

- **Chrome**: Load `chrome-postit-plugin/` as unpacked extension
- **Firefox**: Load `firefox-postit-plugin/` as temporary add-on

## Features

- Create notes with random colors and positions
- Drag notes anywhere
- Auto-save on edit
- Minimize to tray
- Per-URL storage (with extension)
- Cross-device sync via browser storage API

## API Mode

For server-side storage, configure before loading the script:

```html
<script>
  window.postitConfig = { apiUrl: '/api/postit' };
</script>
<script src="postit.js"></script>
```

Expected API endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/postit` | List all notes |
| POST | `/api/postit` | Create note |
| PUT | `/api/postit/{id}` | Update note |
| DELETE | `/api/postit/{id}` | Delete note |

Note payload: `{ id, color, x, y, rotate, content, minimized }`

When `apiUrl` is set, localStorage is bypassed entirely.
