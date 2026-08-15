import fs from 'node:fs';
import vm from 'node:vm';
import * as Core from '../assets/core-v13.js';

globalThis.window={__RUSH_MODULES:{...Core}};
const src=fs.readFileSync(new URL('../assets/story-playtest-v76.js',import.meta.url),'utf8');
const marker='validateCurriculum();';
const cut=src.indexOf(marker);
if(cut<0)throw new Error('V76 validateCurriculum marker missing.');
let head=src.slice(0,cut+marker.length);
head=head.replace(marker,`globalThis.__STORY_V76_TEST={STAGES,validateCurriculum,boardFromHeights,features,landingFor,applyCellsAndClear};${marker}`);
vm.runInThisContext(`${head}\n})();`,{filename:'story-playtest-v76-test.js'});

const api=globalThis.__STORY_V76_TEST;
if(!api)throw new Error('V76 curriculum test API was not exposed.');
const {STAGES,boardFromHeights,features,landingFor,applyCellsAndClear}=api;
const failures=[];
const expect=(condition,message)=>{if(!condition)failures.push(message);};

expect(STAGES.length===10,'expected 10 strategic lessons');
expect(JSON.stringify(STAGES.map(s=>s.moves.length))===JSON.stringify([1,1,1,2,2,2,3,4,5,6]),'lesson move progression must be 1,1,1,2,2,2,3,4,5,6');
expect(STAGES.some(s=>s.moves.some(m=>m.shape==='S')),'curriculum must teach S placement');
expect(STAGES.some(s=>s.moves.some(m=>m.shape==='Z')),'curriculum must teach Z placement');
expect(STAGES.some(s=>s.moves.some(m=>m.shape==='T')),'curriculum must teach T placement');
expect(STAGES.filter(s=>s.well===9).length===5,'last five lessons must teach the right-side Tetris well');

for(let si=0;si<STAGES.length;si++){
  const stage=STAGES[si];
  let board=boardFromHeights(stage.heights,si);
  let before=features(board);
  expect(before.holes===0,`${stage.title}: starting board has holes`);
  for(let mi=0;mi<stage.moves.length;mi++){
    const move=stage.moves[mi];
    const landing=landingFor(board,move);
    expect(!!landing,`${stage.title} step ${mi+1}: unreachable target`);
    if(!landing)continue;
    const result=applyCellsAndClear(board,landing);
    const after=features(result.board);
    expect(result.lines===move.clear,`${stage.title} step ${mi+1}: expected ${move.clear} lines, got ${result.lines}`);
    expect(after.holes===0,`${stage.title} step ${mi+1}: creates a buried hole`);
    expect(after.bumpiness<=before.bumpiness,`${stage.title} step ${mi+1}: bumpiness worsens ${before.bumpiness}->${after.bumpiness}`);
    if(stage.well===9&&mi<stage.moves.length-1){
      const occupied=result.board.some(row=>row[9]);
      expect(!occupied,`${stage.title} step ${mi+1}: closes column 10 well`);
      expect(after.maxHeight<=4,`${stage.title} step ${mi+1}: strategic well stack exceeds height 4`);
    }
    board=result.board;before=after;
  }
  if(stage.well===9){
    const final=stage.moves.at(-1);
    expect(final.shape==='I'&&final.rot===1&&final.x===9&&final.clear===4,`${stage.title}: must finish with vertical I in column 10 for a Tetris`);
  }
}

expect(src.includes('Flat surfaces leave more future placements'),'flat-stacking coaching missing');
expect(src.includes('Keep the right well open'),'well-preservation coaching missing');
expect(src.includes('SURFACE ${before.bumpiness}→${after.bumpiness} · WELL OPEN'),'surface-quality feedback missing');
expect(src.includes('state.scrollAcc>=1000'),'fixed one-second story scroll missing');
expect(src.includes('MICRO=5'),'small background story pixels missing');

if(failures.length){console.error('Story V76 strategy validation failed:\n- '+failures.join('\n- '));process.exit(1);}
console.log('Story V76 strategy foundation passed: clean-stack fundamentals -> S/Z/T surface repair -> 2/3/4/5/6-piece well-preserving Tetris sequences.');
