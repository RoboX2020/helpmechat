(function () {
  if (globalThis.__hmcContentLoaded) return;
  globalThis.__hmcContentLoaded = true;
  'use strict';

  const injectTime = performance.now();
  (async () => {
    const { onExecute } = await import(
      /* @vite-ignore */
      chrome.runtime.getURL("assets/whatsapp.ts-DgvijBRI.js")
    );
    onExecute?.({ perf: { injectTime, loadTime: performance.now() - injectTime } });
  })().catch(console.error);

})();
