export const GAME_CONFIG = Object.freeze({
  cols: 10,
  rows: 20,
  fixedDt: 1 / 120,
  maxCatchUpSteps: 6,
  dropSpeed: 8.4,
  playerAimLimit: 1.30,
  das: 0.105,
  arr: 0.028,
  runner: Object.freeze({
    width: 0.58,
    height: 0.86,
    startY: 20 - 0.94,
    wallClimbCapacity: 1.8,
  }),
});
