// (o) Postit - Main UI Logic (vanilla JS, no jQuery)

(() => {
  const COLORS = ['yellow', 'green', 'pink', 'cyan', 'blue', 'sienna'];
  const STORAGE_KEY = 'notes';

  let overlay = null;
  let fab = null;
  let tray = null;
  let dragging = null;
  let dragStart = null;
  let editingNote = null;
  let zIndexCounter = 1;

  // In-memory cache for API mode
  let notesCache = [];

  // Configuration (set via window.postitConfig before loading)
  const config = window.postitConfig || {};
  const apiUrl = config.apiUrl || null;  // e.g., '/api/postit'
  const perUrl = config.perUrl !== false; // default: notes are per-URL (extension mode)

  // --- Storage helpers ---

  function getStore() {
    if (apiUrl) return null; // API mode: no local store
    if (window.postitStore) return window.postitStore;
    if (window.store) return window.store.namespace('postit');
    return null;
  }

  async function loadNotes() {
    if (apiUrl) {
      try {
        const res = await fetch(apiUrl);
        if (!res.ok) throw new Error('Failed to load notes');
        const notes = await res.json();
        notesCache = notes.map(n => ({
          id: n.postit_id,
          color: n.color,
          x: n.x,
          y: n.y,
          rotate: n.rotate,
          content: n.content || '',
          minimized: n.minimized || false
        }));
        return notesCache;
      } catch (e) {
        console.error('Postit: load error', e);
        return [];
      }
    }

    const s = getStore();
    if (!s) return [];
    const all = s(STORAGE_KEY) || {};
    return perUrl ? (all[window.location.href] || []) : (all['_global'] || []);
  }

  async function saveNote(note) {
    if (apiUrl) {
      try {
        const existing = notesCache.find(n => n.id === note.id);
        if (existing) {
          await fetch(`${apiUrl}/${note.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(note)
          });
        } else {
          await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(note)
          });
          notesCache.push(note);
        }
        // Update cache
        const idx = notesCache.findIndex(n => n.id === note.id);
        if (idx >= 0) notesCache[idx] = note;
      } catch (e) {
        console.error('Postit: save error', e);
      }
      return;
    }

    // Local storage mode
    const s = getStore();
    if (!s) return;
    const key = perUrl ? window.location.href : '_global';
    const all = s(STORAGE_KEY) || {};
    const notes = all[key] || [];
    const idx = notes.findIndex(n => n.id === note.id);
    if (idx >= 0) {
      notes[idx] = note;
    } else {
      notes.push(note);
    }
    all[key] = notes;
    s(STORAGE_KEY, all);
  }

  async function deleteNoteFromStorage(id) {
    if (apiUrl) {
      try {
        await fetch(`${apiUrl}/${id}`, { method: 'DELETE' });
        notesCache = notesCache.filter(n => n.id !== id);
      } catch (e) {
        console.error('Postit: delete error', e);
      }
      return;
    }

    const s = getStore();
    if (!s) return;
    const key = perUrl ? window.location.href : '_global';
    const all = s(STORAGE_KEY) || {};
    all[key] = (all[key] || []).filter(n => n.id !== id);
    s(STORAGE_KEY, all);
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  }

  // Debounce helper for content saves
  let saveTimeout = null;
  function debouncedSave(note) {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => saveNote(note), 300);
  }

  // --- Rendering ---

  function createOverlay() {
    overlay = document.createElement('div');
    overlay.id = 'postit-overlay';
    document.body.appendChild(overlay);

    fab = document.createElement('div');
    fab.id = 'postit-fab';
    fab.innerHTML = '+';
    fab.title = 'Add postit';
    fab.addEventListener('click', createNewNote);
    document.body.appendChild(fab);

    tray = document.createElement('div');
    tray.id = 'postit-tray';
    document.body.appendChild(tray);
  }

  function renderNote(note) {
    const wrapper = document.createElement('div');
    wrapper.className = 'postit-wrapper';
    wrapper.dataset.id = note.id;
    wrapper.dataset.rotate = note.rotate;
    wrapper.style.left = note.x + 'px';
    wrapper.style.top = note.y + 'px';
    wrapper.style.transform = `rotate(${note.rotate}deg)`;
    wrapper.style.zIndex = zIndexCounter++;

    wrapper.innerHTML = `
      <div class="${note.color} postit">
        <div class="postit-header">
          <div>
            <button class="minimize" title="Minimize">_</button>
          </div>
          <div>
            <button class="edit" title="Edit">&#9998;</button>
            <button class="delete" title="Delete">&#10005;</button>
          </div>
        </div>
        <div class="postit-content">${note.content || ''}</div>
      </div>
    `;

    wrapper.querySelector('.minimize').addEventListener('click', () => minimizeNote(note.id));
    wrapper.querySelector('.edit').addEventListener('click', () => startEdit(wrapper));
    wrapper.querySelector('.delete').addEventListener('click', () => deleteNote(note.id));

    wrapper.addEventListener('mousedown', onDragStart);

    return wrapper;
  }

  function renderMiniNote(note) {
    const mini = document.createElement('div');
    mini.className = `postit-mini ${note.color}`;
    mini.dataset.id = note.id;
    mini.title = note.content?.replace(/<[^>]*>/g, '').slice(0, 50) || 'Empty note';
    mini.innerHTML = note.content?.replace(/<[^>]*>/g, '').slice(0, 8) || '...';
    mini.addEventListener('click', () => restoreNote(note.id));
    return mini;
  }

  async function renderAll() {
    if (!overlay || !tray) return;
    overlay.innerHTML = '';
    tray.innerHTML = '';
    const notes = await loadNotes();
    notes.forEach(note => {
      if (note.minimized) {
        tray.appendChild(renderMiniNote(note));
      } else {
        overlay.appendChild(renderNote(note));
      }
    });
  }

  // --- CRUD ---

  async function createNewNote() {
    const note = {
      id: genId(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      x: Math.floor(Math.random() * 400) + 50,
      y: Math.floor(Math.random() * 300) + 50,
      rotate: Math.floor(Math.random() * 10 - 5),
      content: '',
      minimized: false
    };

    await saveNote(note);

    const wrapper = renderNote(note);
    overlay.appendChild(wrapper);
    startEdit(wrapper);
  }

  async function deleteNote(id) {
    if (!confirm('Delete this note?')) return;
    await deleteNoteFromStorage(id);
    const el = overlay.querySelector(`[data-id="${id}"]`) || tray.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
  }

  async function minimizeNote(id) {
    const note = apiUrl
      ? notesCache.find(n => n.id === id)
      : (await loadNotes()).find(n => n.id === id);
    if (!note) return;
    note.minimized = true;
    await saveNote(note);

    const wrapper = overlay.querySelector(`[data-id="${id}"]`);
    if (wrapper) wrapper.remove();
    tray.appendChild(renderMiniNote(note));
  }

  async function restoreNote(id) {
    const note = apiUrl
      ? notesCache.find(n => n.id === id)
      : (await loadNotes()).find(n => n.id === id);
    if (!note) return;
    note.minimized = false;
    await saveNote(note);

    const mini = tray.querySelector(`[data-id="${id}"]`);
    if (mini) mini.remove();
    overlay.appendChild(renderNote(note));
  }

  // --- Editing ---

  function startEdit(wrapper) {
    const postit = wrapper.querySelector('.postit');
    const content = wrapper.querySelector('.postit-content');
    postit.classList.add('edited');
    content.contentEditable = true;
    editingNote = wrapper.dataset.id;
    content.focus();
    // Place cursor at end of content
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(content);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    // Auto-save on input (debounced)
    content.addEventListener('input', () => saveContent(wrapper));
    // Escape to blur
    content.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') endEdit(wrapper);
    });
    // End edit on blur
    content.addEventListener('blur', () => endEdit(wrapper));
  }

  function saveContent(wrapper) {
    const content = wrapper.querySelector('.postit-content');
    const note = apiUrl
      ? notesCache.find(n => n.id === wrapper.dataset.id)
      : null;

    if (apiUrl && note) {
      note.content = content.innerHTML;
      debouncedSave(note);
    } else if (!apiUrl) {
      // Sync mode: load, update, save
      const s = getStore();
      if (!s) return;
      const key = perUrl ? window.location.href : '_global';
      const all = s(STORAGE_KEY) || {};
      const notes = all[key] || [];
      const n = notes.find(n => n.id === wrapper.dataset.id);
      if (n) {
        n.content = content.innerHTML;
        s(STORAGE_KEY, all);
      }
    }
  }

  async function endEdit(wrapper) {
    if (!editingNote) return;
    const postit = wrapper.querySelector('.postit');
    const content = wrapper.querySelector('.postit-content');
    postit.classList.remove('edited');
    content.contentEditable = false;
    // Deselect any selected text
    window.getSelection().removeAllRanges();
    // Delete empty new notes
    if (!content.innerHTML.trim()) {
      await deleteNoteFromStorage(wrapper.dataset.id);
      wrapper.remove();
    }
    editingNote = null;
  }

  // --- Dragging ---

  function onDragStart(e) {
    if (e.target.tagName === 'BUTTON') return;
    const wrapper = e.target.closest('.postit-wrapper');
    if (!wrapper || wrapper.querySelector('.postit.edited')) return;

    const rect = wrapper.getBoundingClientRect();
    dragStart = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    dragging = wrapper;
    overlay.classList.add('dragging');
    // Bring to top while dragging and after
    wrapper.style.zIndex = zIndexCounter++;

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!dragging) return;
    dragging.style.left = (e.clientX - dragStart.x) + 'px';
    dragging.style.top = (e.clientY - dragStart.y) + 'px';
  }

  async function onDragEnd(e) {
    if (!dragging) return;
    overlay.classList.remove('dragging');

    const id = dragging.dataset.id;
    const note = apiUrl
      ? notesCache.find(n => n.id === id)
      : (await loadNotes()).find(n => n.id === id);

    if (note) {
      note.x = parseInt(dragging.style.left);
      note.y = parseInt(dragging.style.top);
      await saveNote(note);
    }

    dragging = null;
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);
  }

  // --- Toggle visibility ---

  function toggle() {
    if (overlay) overlay.classList.toggle('hidden');
    if (fab) fab.classList.toggle('hidden');
    if (tray) tray.classList.toggle('hidden');
  }

  window.addEventListener('message', (e) => {
    if (e.data?.type === 'postit:toggle') toggle();
  });

  // --- Init ---

  async function init() {
    createOverlay();
    await renderAll();
    console.log('(o) Postit ready' + (apiUrl ? ` [API: ${apiUrl}]` : ''));
  }

  // Wait for store and DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (apiUrl) {
        init();
      } else {
        window.addEventListener('postit:ready', init);
        setTimeout(() => { if (!overlay) init(); }, 500);
      }
    });
  } else {
    if (apiUrl) {
      init();
    } else {
      window.addEventListener('postit:ready', init);
      setTimeout(() => { if (!overlay) init(); }, 500);
    }
  }
})();
