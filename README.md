# PickleRange Arcade

Projected pickleball arcade games for a single lane: a projector shows the
game on a wall, players hit real pickleballs at it, and a sensor (Kinect, to
be added) reports where each ball hit. Until the sensor is connected, a mouse
click or tap counts as a ball hit.

## Games

1–7 are solo games with 5 levels each; 8–10 are turn-based party games.

1. Bullseye · 2. Pop-Up · 3. Open Court · 4. Brick Breaker · 5. Zombie Court ·
6. Firing Range · 7. Rally Survival · 8. Tic-Tac-Toe · 9. Pickle Darts 301 ·
10. Memory Match

## Running it

```sh
npm install
npm run dev        # game on http://localhost:5173 + lane server on :8787
```

- **F** – fullscreen, **M** – music on/off, number keys – start a game from the menu.
- `?camera=max` – bigger court (tall objects near the back may be cut off).
- `?fps` – frame-rate readout. `?level=N` (dev only) – jump to level N.
- For the venue PC, use Chrome or Edge with graphics acceleration on, e.g.
  `--kiosk --autoplay-policy=no-user-gesture-required http://localhost:5173`.

## Scripts

- `npm test` – unit tests for the game rules, leaderboard and name entry.
- `npm run build` – type-check and build.
- `node tools/playtest.mjs menu bullseye:1:20` – headless playthrough with
  screenshots in `.shots/` (needs `npm run dev`).

## How it fits together

- `src/input/hitEvents.ts` – the one contract between sensors and games: a hit
  at a normalized (x, y) on the wall.
- `src/games/` – pure, tested game rules and the per-game level tables
  (`levels.ts`, where difficulty is tuned).
- `src/screens/` – each game's 3D/HTML presentation; `src/engine/` – Three.js
  stage, environments and props; `src/audio/` – generated music and sound effects.
- `server/` – lane server: phone QR name entry for the high-score table.
- High scores are stored in the browser on the lane PC (`localStorage`).

3D models in `public/models` are CC0 by Quaternius (see `CREDITS.md`).
