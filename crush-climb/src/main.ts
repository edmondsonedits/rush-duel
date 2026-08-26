import { GAME_CONFIG } from './core/config';
import { createGameState } from './core/GameCore';

const state = createGameState(0x43525553, 'runner', 'easy');
const app = document.querySelector<HTMLElement>('#app');

if (!app) throw new Error('Missing #app mount point');

app.innerHTML = `
  <section style="font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:24px;line-height:1.5">
    <h1>Crush Climb — deterministic core diagnostic</h1>
    <p>This is a development harness, not the migrated game presentation.</p>
    <dl>
      <dt>Simulation</dt><dd>${Math.round(1 / GAME_CONFIG.fixedDt)} Hz fixed step</dd>
      <dt>Board</dt><dd>${GAME_CONFIG.cols} × ${GAME_CONFIG.rows}</dd>
      <dt>Seeded state</dt><dd>${state.seed}</dd>
      <dt>Current piece</dt><dd>${state.current?.type ?? 'none'}</dd>
      <dt>Queue length</dt><dd>${state.nextQueue.length}</dd>
    </dl>
  </section>
`;
