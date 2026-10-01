// Phone and tablet extras: a "rotate your phone" screen in portrait, and small
// fullscreen and music buttons (there are no F/M keys on a phone). None of it
// shows on the venue PC, which has a mouse rather than a touch screen.
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
  const hint = document.createElement('div');
  hint.className = 'rotate-hint';
  hint.innerHTML = '<div class="phone"></div><div class="title">TURN YOUR PHONE</div><div class="sub">PickleRange is played sideways, like the wall at the arcade.</div>';
  stage.frame.appendChild(hint);

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
