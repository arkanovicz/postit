// (o) Postit Popup - URL recovery list

(async () => {
  const list = document.getElementById('list');
  const api = typeof browser !== 'undefined' ? browser : chrome;
  const STORAGE_KEY = 'postit:notes';

  try {
    const result = await api.storage.sync.get(STORAGE_KEY);
    const allNotes = result[STORAGE_KEY] || {};

    const urls = Object.entries(allNotes)
      .filter(([url, notes]) => notes && notes.length > 0)
      .sort((a, b) => b[1].length - a[1].length);

    if (urls.length === 0) {
      list.innerHTML = '<li class="empty">No postits yet</li>';
      return;
    }

    urls.forEach(([url, notes]) => {
      const li = document.createElement('li');
      li.title = url;
      li.innerHTML = `
        <span class="count">${notes.length}</span>
        <span class="url">${new URL(url).hostname}${new URL(url).pathname}</span>
      `;
      li.addEventListener('click', () => {
        api.tabs.create({ url });
        window.close();
      });
      list.appendChild(li);
    });
  } catch (err) {
    list.innerHTML = `<li class="empty">Error: ${err.message}</li>`;
  }
})();
