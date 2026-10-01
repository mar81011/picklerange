// Switches between screens. Each screen gets a fresh Scope, and the previous
// screen's scope is disposed, so nothing leaks between screens.
import { music } from './audio/music';
import { scoreStore } from './services';
import type { Vec3 } from './core/geometry';
import { Scope } from './engine/scope';
import type { World } from './engine/env/world';
import type { Stage } from './engine/stage';
import type { GameId, RoundResult } from './games';
import { bricksScreen } from './screens/bricks';
import { bullseyeScreen } from './screens/bullseye';
import { dartsScreen } from './screens/darts';
import { galleryScreen } from './screens/gallery';
import { gameOverScreen } from './screens/gameover';
import { memoryScreen } from './screens/memory';
import { menuScreen } from './screens/menu';
import { openCourtScreen } from './screens/opencourt';
import { popUpScreen } from './screens/popup';
import { rallyScreen } from './screens/rally';
import { ticTacToeScreen } from './screens/tictactoe';
import { zombiesScreen } from './screens/zombies';

const SCREENS: Record<GameId, (app: App, scope: Scope) => void> = {
  bullseye: bullseyeScreen,
  popup: popUpScreen,
  opencourt: openCourtScreen,
  bricks: bricksScreen,
  zombies: zombiesScreen,
  gallery: galleryScreen,
  rally: rallyScreen,
  tictactoe: ticTacToeScreen,
  darts: (app, scope) => void dartsScreen(app, scope),
  memory: memoryScreen,
};

export class App {
  private scope: Scope | null = null;
  /**
   * Set by the current screen: a world point worth hitting (optionally for a
   * named thing, like a menu board). Used only by dev tooling to automate play.
   */
  debugAim: ((key?: string) => Vec3 | null) | null = null;
  /** Same, for screens made of HTML: a normalized screen point (0..1). Checked before debugAim. */
  debugAimScreen: ((key?: string) => { x: number; y: number } | null) | null = null;

  constructor(
    readonly stage: Stage,
    readonly world: World,
  ) {}

  private show(render: (scope: Scope) => void): void {
    this.scope?.dispose();
    this.debugAim = null;
    this.debugAimScreen = null;
    this.scope = new Scope(this.stage);
    render(this.scope);
  }

  menu(): void {
    music.play('menu');
    this.show((scope) => menuScreen(this, scope));
  }

  play(id: GameId): void {
    music.play(id);
    // Pick up new or staff-deleted scores while the game plays.
    void scoreStore.refresh();
    this.show((scope) => SCREENS[id](this, scope));
  }

  gameOver(result: RoundResult): void {
    this.show((scope) => gameOverScreen(this, scope, result));
  }
}
