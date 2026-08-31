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
