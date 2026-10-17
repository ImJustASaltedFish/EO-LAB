// Short warning messages at the bottom of the page (spec §3.6).
export function showToast(message, { root = document.body, duration = 4000 } = {}) {
  let host = root.querySelector(':scope > .toast-host');
  if (!host) {
    host = document.createElement('div');
    host.className = 'toast-host';
    host.setAttribute('role', 'status');
    host.setAttribute('aria-live', 'polite');
    root.appendChild(host);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  host.appendChild(toast);
  setTimeout(() => toast.classList.add('leaving'), Math.max(0, duration - 400));
  setTimeout(() => toast.remove(), duration);
  return toast;
}
