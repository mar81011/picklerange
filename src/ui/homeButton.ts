// A small HOME button in the top-left corner, on every screen except the menu.
// Esc does the same on a keyboard (except while typing a name, which keeps Esc).
import type { App } from '../app';

export function installHomeButton(app: App): void {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'home-button label';
  b.textContent = '⌂ Home';
  b.title = 'Back to the menu (Esc)';
  b.setAttribute('aria-label', 'Back to the menu');
  // Taps on the button must not also count as ball hits on the wall behind it.
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    app.menu();
  });
  app.stage.frame.appendChild(b);

  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || e.target instanceof HTMLInputElement) return;
    if (!app.stage.frame.classList.contains('on-menu')) app.menu();
  });
}
