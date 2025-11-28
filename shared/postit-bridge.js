// (o) Postit Store2 Bridge
// Extends store2 with extension storage backend, falls back to localStorage

(() => {
  const POSTIT_EVENT = 'postit:storage';
  const POSTIT_RESPONSE = 'postit:storage:response';

  let extensionReady = false;
  let pendingRequests = new Map();
  let requestId = 0;

  // Detect extension presence
  window.addEventListener('message', (event) => {
    if (event.source !== window) return;

    if (event.data?.type === 'postit:extension:ready') {
      extensionReady = true;
      console.log('(o) Postit extension detected');
    }

    if (event.data?.type === POSTIT_RESPONSE) {
      const { id, success, data, error } = event.data;
      const pending = pendingRequests.get(id);
      if (pending) {
        pendingRequests.delete(id);
        if (success) pending.resolve(data);
        else pending.reject(new Error(error));
      }
    }
  });

  // Send request to extension via content script
  function sendToExtension(action, key, value) {
    return new Promise((resolve, reject) => {
      if (!extensionReady) {
        reject(new Error('Extension not available'));
        return;
      }
      const id = ++requestId;
      pendingRequests.set(id, { resolve, reject });
      window.postMessage({ type: POSTIT_EVENT, id, action, key, value }, '*');

      // Timeout after 5s
      setTimeout(() => {
        if (pendingRequests.has(id)) {
          pendingRequests.delete(id);
          reject(new Error('Request timeout'));
        }
      }, 5000);
    });
  }

  // Create extension storage area for store2
  function createExtensionStorage() {
    const cache = {}; // Local cache for sync reads

    return {
      name: 'extension',
      length: 0,
      _keys: [],

      has(k) { return k in cache; },

      key(i) { return this._keys[i]; },

      getItem(k) {
        return cache[k] ?? null;
      },

      setItem(k, v) {
        const isNew = !(k in cache);
        cache[k] = v;
        if (isNew) {
          this._keys.push(k);
          this.length++;
        }
        // Async sync to extension (fire and forget for speed)
        sendToExtension('set', k, v).catch(() => {});
      },

      removeItem(k) {
        if (k in cache) {
          delete cache[k];
          this._keys = this._keys.filter(key => key !== k);
          this.length--;
          sendToExtension('remove', k).catch(() => {});
        }
      },

      clear() {
        for (const k in cache) delete cache[k];
        this._keys = [];
        this.length = 0;
        sendToExtension('clear').catch(() => {});
      },

      // Async load from extension
      async sync() {
        try {
          const data = await sendToExtension('getAll');
          if (data) {
            for (const k in data) {
              cache[k] = typeof data[k] === 'string' ? data[k] : JSON.stringify(data[k]);
              if (!this._keys.includes(k)) {
                this._keys.push(k);
                this.length++;
              }
            }
          }
          return true;
        } catch {
          return false;
        }
      }
    };
  }

  // Initialize when store2 is ready
  function initPostitStore() {
    if (typeof store === 'undefined') {
      setTimeout(initPostitStore, 50);
      return;
    }

    const extStorage = createExtensionStorage();

    // Register extension storage area with store2
    store.area('extension', extStorage);

    // Create postit namespace that auto-selects backend
    const postitStore = store.namespace('postit');

    // Add helper to check extension availability
    postitStore.hasExtension = () => extensionReady;

    // Add async sync method
    postitStore.syncFromExtension = async () => {
      if (!extensionReady) return false;
      return extStorage.sync();
    };

    // Add URL listing for recovery
    postitStore.listUrls = () => sendToExtension('listUrls');

    // Expose globally
    window.postitStore = postitStore;

    // Auto-sync on load if extension available
    setTimeout(() => {
      if (extensionReady) {
        extStorage.sync().then(() => {
          console.log('(o) Postit synced from extension');
          window.dispatchEvent(new Event('postit:ready'));
        });
      } else {
        console.log('(o) Postit using localStorage (no extension)');
        window.dispatchEvent(new Event('postit:ready'));
      }
    }, 100);
  }

  initPostitStore();
})();
