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
  let origContent = '';

  // --- Storage helpers ---

  function getStore() {
    // Use unified postitStore if available (extension or localStorage)
    if (window.postitStore) return window.postitStore;
    // Fallback to raw store with namespace
    if (window.store) return window.store.namespace('postit');
    return null;
  }

  function loadNotes() {
    const s = getStore();
    if (!s) return [];
    const url = window.location.href;
    const all = s(STORAGE_KEY) || {};
    return all[url] || [];
  }

  function saveNotes(notes) {
    const s = getStore();
    if (!s) return;
    const url = window.location.href;
    const all = s(STORAGE_KEY) || {};
    all[url] = notes;
    s(STORAGE_KEY, all);
  }

  function genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
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
        <div class="postit-footer">
          <button class="cancel" title="Cancel">&#10005; Cancel</button>
          <button class="save" title="Save">&#10003; Save</button>
        </div>
      </div>
    `;

    wrapper.querySelector('.minimize').addEventListener('click', () => minimizeNote(note.id));
    wrapper.querySelector('.edit').addEventListener('click', () => startEdit(wrapper));
    wrapper.querySelector('.delete').addEventListener('click', () => deleteNote(note.id));
    wrapper.querySelector('.cancel').addEventListener('click', () => cancelEdit(wrapper));
    wrapper.querySelector('.save').addEventListener('click', () => saveEdit(wrapper));

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

  function renderAll() {
    if (!overlay || !tray) return;
    overlay.innerHTML = '';
    tray.innerHTML = '';
    const notes = loadNotes();
    notes.forEach(note => {
      if (note.minimized) {
        tray.appendChild(renderMiniNote(note));
      } else {
        overlay.appendChild(renderNote(note));
      }
    });
  }

  // --- CRUD ---

  function createNewNote() {
    const note = {
      id: genId(),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      x: Math.floor(Math.random() * 400) + 50,
      y: Math.floor(Math.random() * 300) + 50,
      rotate: Math.floor(Math.random() * 10 - 5),
      content: '',
      minimized: false
    };

    const notes = loadNotes();
    notes.push(note);
    saveNotes(notes);

    const wrapper = renderNote(note);
    overlay.appendChild(wrapper);
    startEdit(wrapper);
  }

  function deleteNote(id) {
    if (!confirm('Delete this note?')) return;
    let notes = loadNotes();
    notes = notes.filter(n => n.id !== id);
    saveNotes(notes);
    // Remove from overlay or tray
    const el = overlay.querySelector(`[data-id="${id}"]`) || tray.querySelector(`[data-id="${id}"]`);
    if (el) el.remove();
  }

  function minimizeNote(id) {
    const notes = loadNotes();
    const note = notes.find(n => n.id === id);
    if (!note) return;
    note.minimized = true;
    saveNotes(notes);

    // Move from overlay to tray
    const wrapper = overlay.querySelector(`[data-id="${id}"]`);
    if (wrapper) wrapper.remove();
    tray.appendChild(renderMiniNote(note));
  }

  function restoreNote(id) {
    const notes = loadNotes();
    const note = notes.find(n => n.id === id);
    if (!note) return;
    note.minimized = false;
    saveNotes(notes);

    // Move from tray to overlay
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
    origContent = content.innerHTML;
    editingNote = wrapper.dataset.id;
    content.focus();
  }

  function cancelEdit(wrapper) {
    const postit = wrapper.querySelector('.postit');
    const content = wrapper.querySelector('.postit-content');
    postit.classList.remove('edited');
    content.contentEditable = false;

    // If new note with no content, delete it
    if (!origContent && !content.innerHTML.trim()) {
      let notes = loadNotes();
      notes = notes.filter(n => n.id !== wrapper.dataset.id);
      saveNotes(notes);
      wrapper.remove();
    } else {
      content.innerHTML = origContent;
    }
    editingNote = null;
  }

  function saveEdit(wrapper) {
    const postit = wrapper.querySelector('.postit');
    const content = wrapper.querySelector('.postit-content');
    postit.classList.remove('edited');
    content.contentEditable = false;

    const notes = loadNotes();
    const note = notes.find(n => n.id === wrapper.dataset.id);
    if (note) {
      note.content = content.innerHTML;
      saveNotes(notes);
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

    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', onDragEnd);
  }

  function onDragMove(e) {
    if (!dragging) return;
    dragging.style.left = (e.clientX - dragStart.x) + 'px';
    dragging.style.top = (e.clientY - dragStart.y) + 'px';
  }

  function onDragEnd(e) {
    if (!dragging) return;
    overlay.classList.remove('dragging');

    const id = dragging.dataset.id;
    const notes = loadNotes();
    const note = notes.find(n => n.id === id);
    if (note) {
      note.x = parseInt(dragging.style.left);
      note.y = parseInt(dragging.style.top);
      saveNotes(notes);
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

  function init() {
    createOverlay();
    renderAll();
    console.log('(o) Postit ready');
  }

  // Wait for store and DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.addEventListener('postit:ready', init);
      // Fallback if no extension
      setTimeout(() => { if (!overlay) init(); }, 500);
    });
  } else {
    window.addEventListener('postit:ready', init);
    setTimeout(() => { if (!overlay) init(); }, 500);
  }
})();
