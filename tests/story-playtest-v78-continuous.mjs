import fs from 'node:fs';
import vm from 'node:vm';
import * as Core from '../assets/core-v13.js';

globalThis.window={__RUSH_MODULES:{...Core}};
const src=fs.readFileSync(new URL('../assets/story-playtest-v78.js',import.meta.url),'utf8');
const marker='validateCurriculum();';
const cut=src.indexOf(marker);
if(cut<0)throw new Error('V78 validateCurriculum marker missing.');
let head=src.slice(0,cut+marker.length);
head=head.replace(marker,`globalThis.__STORY_V78_TEST={STAGES,MEDIUM_RISE_MS,MEDIUM_START_BASE,MEDIUM_DEADLINE_BASE,STAGE_SPACING_ROWS,validateCurriculum,buildStageBoard,landingFor,applyCellsAndClear,boardFeatures};${marker}`);
vm.runInThisContext(`${head}\n})();`,{filename:'story-playtest-v78-test.js'});

const api=globalThis.__STORY_V78_TEST;
const failures=[];
const expect=(ok,msg)=>{if(!ok)failures.push(msg);};
expect(!!api,'V78 test API missing');
if(api){
  const {STAGES,MEDIUM_RISE_MS,MEDIUM_START_BASE,MEDIUM_DEADLINE_BASE,STAGE_SPACING_ROWS}=api;
  expect(STAGES.length===10,'expected 10 continuous story lessons');
  expect(MEDIUM_START_BASE===15,'Medium active lesson should start at row 15');
  expect(MEDIUM_DEADLINE_BASE===10,'V78 compatibility deadline should remain row 10 for V79 guard');
  expect(STAGE_SPACING_ROWS===4,'next lesson should sit four rows underneath current lesson');
  expect(MEDIUM_START_BASE+STAGE_SPACING_ROWS===19,'next lesson must begin at the visible bottom row');
  expect(MEDIUM_RISE_MS.length===10,'expected one Medium reaction interval per lesson');
  for(let i=1;i<MEDIUM_RISE_MS.length;i++)expect(MEDIUM_RISE_MS[i]<MEDIUM_RISE_MS[i-1],`reaction time must decrease at lesson ${i+1}`);
  for(let stage=0;stage<STAGES.length;stage++){
    for(const base of [15,14,13,12,11,10]){
      let board=api.buildStageBoard(stage,base);
      for(const move of STAGES[stage].moves){
        const land=api.landingFor(board,move,base+1);
        expect(!!land,`${STAGES[stage].title}: unreachable at continuous base ${base}`);
        if(!land)break;
        const result=api.applyCellsAndClear(board,land);
        expect(result.lines===move.clear,`${STAGES[stage].title}: wrong clear at continuous base ${base}`);
        board=result.board;
      }
    }
  }
}
expect(src.includes('function drawUpcoming()'),'next-level preview renderer missing');
expect(src.includes('function beginHandoff()'),'continuous handoff missing');
expect(src.includes('function handoffStep()'),'row-by-row handoff animation missing');
expect(src.includes('function promoteUpcoming()'),'preview promotion missing');
expect(src.includes('NEXT LEVEL BELOW'),'Medium HUD does not explain next level below');
expect(!src.includes('BREATHER · WATCH THE STORY SCROLL'),'Medium still contains old blank breather transition');

if(failures.length){console.error('Story V78 continuous foundation validation failed:\n- '+failures.join('\n- '));process.exit(1);}
console.log('Story V78 continuous foundation passed: next lesson starts underneath the current lesson, rises with it, and promotes without a blank transition.');
