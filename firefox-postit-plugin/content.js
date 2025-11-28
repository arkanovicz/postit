// (o) Postit Content Script (Firefox)
// Bridge between page context and extension storage

(() => {
  const POSTIT_EVENT = 'postit:storage';
  const POSTIT_RESPONSE = 'postit:storage:response';

  // Inject script into page context
  function injectScript(file) {
    const script = document.createElement('script');
    script.src = browser.runtime.getURL(file);
    script.onload = () => script.remove();
    (document.head || document.documentElement).appendChild(script);
  }

  // Signal extension presence to page
  window.postMessage({ type: 'postit:extension:ready' }, '*');

  // Listen for storage requests from page context
  window.addEventListener('message', async (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== POSTIT_EVENT) return;

    const { id, action, key, value } = event.data;
    const url = window.location.href;

    try {
      const response = await browser.runtime.sendMessage({ action, key, value, url });
      window.postMessage({ type: POSTIT_RESPONSE, id, ...response }, '*');
    } catch (err) {
      window.postMessage({ type: POSTIT_RESPONSE, id, success: false, error: err.message }, '*');
    }
  });

  // Listen for toggle from background
  browser.runtime.onMessage.addListener((request) => {
    if (request.action === 'toggle') {
      window.postMessage({ type: 'postit:toggle' }, '*');
    }
  });

  // Inject store2, bridge, and postit UI into page
  injectScript('store2.js');
  injectScript('postit-bridge.js');
  injectScript('postit.js');
})();
