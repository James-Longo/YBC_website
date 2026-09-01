// Hamburger menu for small screens (the full nav is inline on desktop).
const button = document.querySelector('.menu-btn');
const menu = document.getElementById('side-menu');
const backdrop = document.querySelector('.menu-backdrop');

function setOpen(open) {
  if (!button || !menu || !backdrop) return;
  menu.hidden = !open;
  backdrop.hidden = !open;
  button.setAttribute('aria-expanded', String(open));
  button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
  document.body.classList.toggle('menu-open', open);
  if (open) menu.querySelector('a')?.focus();
}

if (button && menu && backdrop) {
  button.addEventListener('click', () => setOpen(menu.hidden));
  backdrop.addEventListener('click', () => setOpen(false));
  menu.querySelector('.menu-close')?.addEventListener('click', () => setOpen(false));
  menu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => setOpen(false)));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) setOpen(false);
  });
}

// "Install as an app" (PWA). The button stays hidden unless the browser can
// actually install: Chrome/Android fire beforeinstallprompt and we trigger the
// native dialog; iOS Safari has no install API, so we show the
// Share -> "Add to Home Screen" steps instead.
const installButton = menu?.querySelector('.install-app');

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

const isStandalone =
  window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;

let deferredPrompt = null;

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredPrompt = event;
  if (installButton) installButton.hidden = false;
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  if (installButton) installButton.hidden = true;
});

if (installButton && isIOS && !isStandalone) {
  installButton.hidden = false;
}

installButton?.addEventListener('click', async () => {
  if (deferredPrompt) {
    const promptEvent = deferredPrompt;
    deferredPrompt = null;
    try {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      if (outcome === 'accepted') installButton.hidden = true;
    } catch {
      // Prompt refused (e.g. already used); nothing else to do.
    }
    setOpen(false);
    return;
  }
  // iOS: toggle the how-to instructions under the button.
  let help = menu.querySelector('.install-help');
  if (!help) {
    help = document.createElement('div');
    help.className = 'install-help';
    help.innerHTML =
      '<p>To add YBC to your home screen:</p>' +
      '<ol><li>Tap the <strong>Share</strong> button <span aria-hidden="true">(&#x2B06;&#xFE0E;)</span> at the bottom of Safari.</li>' +
      '<li>Scroll down and tap <strong>Add to Home Screen</strong>.</li>' +
      '<li>Tap <strong>Add</strong>.</li></ol>';
    installButton.insertAdjacentElement('afterend', help);
  } else {
    help.hidden = !help.hidden;
  }
});
