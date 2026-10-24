// Load a page in a hidden iframe and wait until its script reports ready (window.eolab.ready).
export function loadPage(src) {
  return new Promise((resolve, reject) => {
    const frame = document.createElement('iframe');
    frame.style.cssText = 'width:1200px;height:800px;position:absolute;left:-9999px;top:0;border:0';
    frame.src = src;
    document.body.appendChild(frame);
    const started = Date.now();
    const poll = () => {
      const app = frame.contentWindow && frame.contentWindow.eolab;
      if (app && app.ready) {
        resolve({ frame, app, doc: frame.contentDocument });
      } else if (app && app.errors.length) {
        reject(new Error(`page errors: ${app.errors.join(' | ')}`));
      } else if (Date.now() - started > 30000) {
        reject(new Error('page did not become ready'));
      } else {
        setTimeout(poll, 50);
      }
    };
    poll();
  });
}
