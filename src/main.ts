import '@fontsource/bebas-neue/400.css';
import '@fontsource/barlow-condensed/700.css';
import './ui/styles.css';
import { App } from './app';
import { World } from './engine/env/world';
import { Stage } from './engine/stage';
import { loadModel } from './engine/character';
import { preloadOpponent } from './engine/opponent';
import { ZOMBIE_MODEL } from './screens/zombies';
import { attachPointerSimulator } from './input/hitEvents';
import { music } from './audio/music';
import { scoreStore } from './services';
import { installPickleballIcon } from './ui/pickleballIcon';

/** Small message in the corner, e.g. after toggling music. */
function toast(parent: HTMLElement, text: string): void {
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  parent.appendChild(el);
  setTimeout(() => el.remove(), 1400);
}

function start(): void {
  installPickleballIcon();
  const stage = new Stage(document.getElementById('game')!);
  const app = new App(stage, new World(stage));

  // Until the Kinect bridge exists, mouse clicks and taps stand in for ball hits.
  attachPointerSimulator(stage.frame);
  if (new URLSearchParams(location.search).has('fps')) stage.showFps();
  // F toggles fullscreen, M mutes the music. (Not double-click: every click counts as a ball hit.)
  window.addEventListener('keydown', (e) => {
    if (e.target instanceof HTMLInputElement) return;
    if (e.key === 'f' || e.key === 'F') stage.toggleFullscreen();
    if (e.key === 'm' || e.key === 'M') toast(stage.frame, music.toggleMute() ? 'MUSIC OFF' : 'MUSIC ON');
  });
  void preloadOpponent().catch((err) => console.error('Opponent model failed to load', err));
  void loadModel(ZOMBIE_MODEL).catch((err) => console.error('Zombie model failed to load', err));
  app.menu();

  // Dev builds only: lets automated playthroughs find something to hit.
  if (import.meta.env.DEV) {
    Object.assign(window, {
      __app: app,
      __aim: (key?: string) => {
        if (app.debugAimScreen) return app.debugAimScreen(key);
        const p = app.debugAim?.(key);
        if (!p) return null;
        return stage.toScreen(p);
      },
    });
  }
}

// Canvas textures bake text in once, so fonts must load first; the menu shows best
// scores, so load those from the lane server too (refresh never throws or hangs).
Promise.all([document.fonts.load('64px "Bebas Neue"'), document.fonts.load('bold 24px "Barlow Condensed"'), scoreStore.refresh()])
  .catch(() => undefined)
  .finally(start);
