// (o) Postit Background Script (Firefox)
// Handles browser.storage operations and cross-tab sync

const STORAGE_KEY = 'postit:notes';

// Listen for messages from content scripts
browser.runtime.onMessage.addListener((request, sender) => {
  const { action, key, value, url } = request;

  switch (action) {
    case 'get':
      return browser.storage.sync.get(key || STORAGE_KEY).then(result => ({
        success: true,
        data: result[key || STORAGE_KEY]
      }));

    case 'set':
      return browser.storage.sync.set({ [key || STORAGE_KEY]: value }).then(() => ({
        success: true
      }));

    case 'getAll':
      return browser.storage.sync.get(null).then(result => ({
        success: true,
        data: result
      }));

    case 'remove':
      return browser.storage.sync.remove(key).then(() => ({
        success: true
      }));

    case 'clear':
      return browser.storage.sync.clear().then(() => ({
        success: true
      }));

    case 'getByUrl':
      return browser.storage.sync.get(STORAGE_KEY).then(result => {
        const allNotes = result[STORAGE_KEY] || {};
        const urlNotes = allNotes[url] || [];
        return { success: true, data: urlNotes };
      });

    case 'listUrls':
      return browser.storage.sync.get(STORAGE_KEY).then(result => {
        const allNotes = result[STORAGE_KEY] || {};
        const urls = Object.keys(allNotes).filter(u => allNotes[u].length > 0);
        return { success: true, data: urls };
      });
  }
});

// Note: popup replaces action click - toggle via FAB or keyboard shortcut
