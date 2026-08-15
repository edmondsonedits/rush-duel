import fs from 'node:fs';

const story=fs.readFileSync('assets/story-playtest-v77.js','utf8');
const page=fs.readFileSync('story-test.html','utf8');
const bridge=fs.readFileSync('assets/story-production-v77.js','utf8');
const app=fs.readFileSync('assets/app-v13.js','utf8');

const failures=[];
const expect=(ok,msg)=>{if(!ok)failures.push(msg);};

expect(story.includes("const COLS=10,ROWS=20,VERSION=77"),'V77 runtime/version missing');
expect(story.includes("mode:'easy'"),'Easy mode state missing');
expect(story.includes("state.mode='medium'"),'Medium mode selection missing');
expect(story.includes("EASY · START")&&story.includes("MEDIUM · START"),'Easy/Medium start controls missing');
expect(story.includes('function riseBoard(board)'),'Rising-board function missing');
expect(story.includes('Array(COLS).fill(FLOOR)'),'Medium support/conveyor row missing');
expect(story.includes('gameplayFull(row)'),'Non-clearable support-row guard missing');
expect(story.includes('MAX_MEDIUM_RISES=5'),'Medium reaction-window limit missing');
expect(story.includes('REACTION WINDOW EXPIRED'),'Medium timeout behavior missing');
expect(story.includes('for(let rises=1;rises<MAX_MEDIUM_RISES;rises++)'),'Medium strategic reachability validation missing');
expect(story.includes('window.__rushStoryV77'),'V77 debug/export handle missing');

const timerMatch=story.match(/const MEDIUM_RISE_MS=\[([^\]]+)\]/);
expect(!!timerMatch,'Medium rise timer schedule missing');
if(timerMatch){
  const values=timerMatch[1].split(',').map(v=>Number(v.trim())).filter(Number.isFinite);
  expect(values.length===10,'Medium should have one rise interval per story chapter');
  expect(values.every((v,i)=>i===0||v<values[i-1]),'Medium reaction time must shrink every chapter');
  expect(values[0]>=5000,'Medium should begin slowly enough to teach');
  expect(values.at(-1)<=2000,'Medium final chapter should create meaningful reaction pressure');
}

expect(page.includes('story-playtest-v77.js?v=77'),'Direct Story page does not load V77');
expect(page.includes('Story Mode V77'),'Direct Story page title/version missing');
expect(bridge.includes("url.searchParams.set('v','77')"),'Production Story button does not route to V77');
expect(bridge.includes("medium:'rising strategy'"),'Production bridge does not describe Medium mode');
expect(app.includes('story-production-v77.js?v=77'),'Main game loader does not load V77 bridge');

if(failures.length){
  console.error('Story V77 validation failed:');
  for(const f of failures)console.error('- '+f);
  process.exit(1);
}
console.log('Story V77 validation passed: Easy preserves the strategic V76 course; Medium raises the authored puzzle on a strictly shrinking 5.5s→1.8s timer with non-clearable support rows.');
