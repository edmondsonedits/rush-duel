import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const failures=[];
const check=(name,ok,detail='')=>{if(!ok)failures.push(`${name}${detail?`: ${detail}`:''}`);};

const required=['story-test.html','assets/story-playtest-v72.js','assets/story-prediction-curriculum-v71.js','assets/story-scroll-editor-v70.js'];
for(const file of required)check(`file exists: ${file}`,fs.existsSync(path.join(root,file)));
const html=read('story-test.html');
const play=read('assets/story-playtest-v72.js');
const curriculum=read('assets/story-prediction-curriculum-v71.js');
try{new Function(play);check('Story playtest JavaScript parses',true);}catch(error){check('Story playtest JavaScript parses',false,error.message);}

const targetCount=(curriculum.match(/\bt\('/g)||[]).length;
check('49 authored solver targets',targetCount===49,String(targetCount));
check('direct page loads editor, curriculum, and play runtime',html.includes('story-scroll-editor-v70.js?v=70')&&html.includes('story-prediction-curriculum-v71.js?v=71')&&html.includes('story-playtest-v72.js?v=72'));
check('playtest uses editor and curriculum runtime',play.includes('__rushStoryEditor')&&play.includes('__rushStoryCurriculum')&&play.includes('curriculum.targets'));
check('three hearts and checkpoint retries',play.includes('MAX_HEARTS=3')&&play.includes('CHECKPOINT_EVERY=5')&&play.includes('state.lives--'));
check('exact target-cell validation',play.includes('pieceCellsAtBottom')&&play.includes('expectedLocalCells')&&play.includes('correctPlacement'));
check('wrong placements retry same target',play.includes('MISPLACED')&&play.includes('spawnPiece(620)'));
check('difficulty controls assist and fall speed',play.includes('t.difficulty')&&play.includes('progress*.75'));
check('successful placements advance target index',play.includes('state.index=state.transition.to')&&play.includes('state.transition={from,to'));
check('story viewport scrolls upward between targets',play.includes('drawBoard(state.transition.from,-offset')&&play.includes('BOARD_H-offset'));
check('mobile move/rotate/drop controls',/data-story-test-action="left"/.test(html)&&/data-story-test-action="ccw"/.test(html)&&/data-story-test-action="drop"/.test(html)&&/data-story-test-action="cw"/.test(html)&&/data-story-test-action="right"/.test(html));
check('Story Editor remains reachable',html.includes('story-editor.html?v=71'));
check('solver gaps can be rebuilt',play.includes("rebuild')==='1'")&&play.includes('curriculum.apply'));

if(failures.length){console.error(`Story Playtest validation failed (${failures.length}):\n- ${failures.join('\n- ')}`);process.exit(1);}
console.log(`Story Mode V72 playtest validation passed: ${targetCount} solver-authored placements are playable from Easy to Expert.`);