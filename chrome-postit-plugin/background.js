// (o) Postit Background Service Worker
// Handles chrome.storage operations and cross-tab sync

const STORAGE_KEY = 'postit:notes';

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const { action, key, value, url } = request;

  switch (action) {
    case 'get':
      chrome.storage.sync.get(key || STORAGE_KEY, (result) => {
        sendResponse({ success: true, data: result[key || STORAGE_KEY] });
      });
      return true; // async response

    case 'set':
      chrome.storage.sync.set({ [key || STORAGE_KEY]: value }, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'getAll':
      chrome.storage.sync.get(null, (result) => {
        sendResponse({ success: true, data: result });
      });
      return true;

    case 'remove':
      chrome.storage.sync.remove(key, () => {
        sendResponse({ success: true });
      });
      return true;

    case 'clear':
      chrome.storage.sync.clear(() => {
        sendResponse({ success: true });
      });
      return true;

    case 'getByUrl':
      // Get all notes for a specific URL
      chrome.storage.sync.get(STORAGE_KEY, (result) => {
        const allNotes = result[STORAGE_KEY] || {};
        const urlNotes = allNotes[url] || [];
        sendResponse({ success: true, data: urlNotes });
      });
      return true;

    case 'listUrls':
      // List all URLs that have postits (for recovery feature)
      chrome.storage.sync.get(STORAGE_KEY, (result) => {
        const allNotes = result[STORAGE_KEY] || {};
        const urls = Object.keys(allNotes).filter(u => allNotes[u].length > 0);
        sendResponse({ success: true, data: urls });
      });
      return true;
  }
});

// Note: popup replaces action click - toggle via FAB or keyboard shortcut
