import fs from 'node:fs';
import vm from 'node:vm';
import * as Core from '../assets/core-v13.js';

const src=fs.readFileSync('assets/story-playtest-v80.js','utf8');
const page=fs.readFileSync('story-test.html','utf8');
const bridge=fs.readFileSync('assets/story-production-v80.js','utf8');
const app=fs.readFileSync('assets/app-v13.js','utf8');
const failures=[];
const expect=(ok,msg)=>{if(!ok)failures.push(msg);};

globalThis.window={__RUSH_MODULES:{...Core}};
const marker='validateCurriculum();';
const cut=src.indexOf(marker);
if(cut<0)throw new Error('V80 curriculum validation marker missing.');
let head=src.slice(0,cut+marker.length);
head=head.replace(marker,`globalThis.__STORY_V80_TEST={STAGES,MEDIUM_RISE_MS,MEDIUM_START_BASE,MEDIUM_HOLD_BASE,STAGE_SPACING_ROWS,validateCurriculum,buildStageBoard,landingFor,applyCellsAndClear,boardFeatures};${marker}`);
vm.runInThisContext(`${head}\n})();`,{filename:'story-playtest-v80-test.js'});

const api=globalThis.__STORY_V80_TEST;
expect(!!api,'V80 test API missing');
if(api){
  expect(api.STAGES.length===10,'expected ten strategy lessons');
  expect(api.MEDIUM_RISE_MS===1000,'Medium must rise exactly one row per second');
  expect(api.MEDIUM_START_BASE===15,'Medium start row changed');
  expect(api.MEDIUM_HOLD_BASE===10,'safe decision hold row changed');
  expect(api.MEDIUM_START_BASE+api.STAGE_SPACING_ROWS===19,'next lesson must begin visibly underneath');
  for(let stage=0;stage<api.STAGES.length;stage++){
    for(const base of [19,15,14,13,12,11,10]){
      let board=api.buildStageBoard(stage,base);
      for(const move of api.STAGES[stage].moves){
        const land=api.landingFor(board,move,base+1);
        expect(!!land,`${api.STAGES[stage].title}: unreachable at base ${base}`);
        if(!land)break;
        const result=api.applyCellsAndClear(board,land);
        expect(result.lines===move.clear,`${api.STAGES[stage].title}: expected ${move.clear} clears, got ${result.lines}`);
        expect(api.boardFeatures(result.board,base+1).holes===0,`${api.STAGES[stage].title}: prescribed play creates a hole`);
        board=result.board;
      }
    }
  }
}

expect(!src.includes('REACTION WINDOW EXPIRED'),'timer-based loss still exists');
expect(!src.includes('THE BOARD CAUGHT THE PIECE · RETRY'),'board movement can still cost a heart');
expect((src.match(/loseHeart\(/g)||[]).length===2,'heart loss must exist only in loseHeart itself and the wrong-placement branch');
expect(src.includes("state.baseY<=MEDIUM_HOLD_BASE"),'safe conveyor hold missing');
expect(src.includes('state.riseAcc+=elapsed'),'conveyor timing must use real elapsed time');
expect(src.includes('while(state.riseAcc>=interval&&state.baseY>MEDIUM_HOLD_BASE)'),'conveyor must catch up safely after a slow frame');
expect(src.includes("$('storyTestScene').textContent='STORY MODE V80'"),'mode-selection header still shows a legacy version');
expect(src.includes("setInterval(()=>input(action),65)"),'touch movement auto-repeat missing');
expect(src.includes('window.__rushStoryV80'),'V80 diagnostics export missing');
expect(page.includes('Story Mode V80'),'V80 page identity missing');
expect(page.includes('story-playtest-v80.js?v=80.2'),'V80 runtime is not loaded with the current cache key');
expect(!page.includes('story-placement-only-loss-v79'),'legacy V79 runtime patch still loaded');
expect(app.includes('story-production-v80.js?v=80'),'production app does not load V80 bridge');
expect(bridge.includes("url.searchParams.set('v','80.2')"),'Story button does not route to the current V80 build');
expect(bridge.includes("lossRule:'wrong placement only'"),'production loss rule missing');

if(failures.length){console.error('Story V80 runtime validation failed:\n- '+failures.join('\n- '));process.exit(1);}
console.log('Story V80 passed: all ten lessons solve at every supported height, Medium rises once per second and holds safely, and only wrong placements cost hearts.');