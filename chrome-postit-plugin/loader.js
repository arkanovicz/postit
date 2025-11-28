// (o) Postit Loader - inject postit into any page via bookmarklet or script tag
// Usage: <script src="https://your-host/postit/loader.js"></script>
// Or bookmarklet: javascript:(function(){...})()

(() => {
  const BASE = document.currentScript?.src.replace(/loader\.js$/, '') || '';

  function loadCSS(href) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function loadJS(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  async function init() {
    if (window.__postitLoaded) {
      console.log('(o) Postit already loaded');
      return;
    }
    window.__postitLoaded = true;

    loadCSS(BASE + 'postit.css');
    await loadJS(BASE + 'store2.js');
    await loadJS(BASE + 'postit-bridge.js');
    await loadJS(BASE + 'postit.js');
    console.log('(o) Postit loaded via loader');
  }

  init();
})();
