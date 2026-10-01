// Phone and tablet extras: small fullscreen and music buttons (there are no
// F/M keys on a phone). They don't show on the venue PC, which has a mouse
// rather than a touch screen. (Upright phones get the game turned sideways;
// see Stage.rotated.)
import { music } from '../audio/music';
import type { Stage } from '../engine/stage';

/** True on phones and tablets (a finger rather than a mouse). */
export const isTouchDevice = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;

function button(parent: HTMLElement, label: string, title: string, onTap: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.textContent = label;
  b.title = title;
  b.setAttribute('aria-label', title);
  // Taps on these buttons must not also count as ball hits on the wall behind them.
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    onTap();
  });
  parent.appendChild(b);
  return b;
}

async function enterFullscreen(): Promise<void> {
  if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => undefined);
    return;
  }
  await document.documentElement.requestFullscreen().catch(() => undefined);
  // Android can then lock to landscape (not allowed outside fullscreen).
  const orientation = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
  await orientation.lock?.('landscape').catch(() => undefined);
}

export function installTouchUi(stage: Stage): void {
  if (!isTouchDevice) return;
  const bar = document.createElement('div');
  bar.className = 'touch-buttons';
  stage.frame.appendChild(bar);
  // iPhones don't support fullscreen in the browser; there "Add to Home Screen" does it instead.
  if (document.fullscreenEnabled) button(bar, '⛶', 'Fullscreen', () => void enterFullscreen());
  const sound = button(bar, '♪', 'Music on/off', () => {
    sound.classList.toggle('off', music.toggleMute());
  });
  sound.classList.toggle('off', music.isMuted);
}
