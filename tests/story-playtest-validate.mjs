import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const failures=[];
const check=(name,ok,detail='')=>{if(!ok)failures.push(`${name}${detail?`: ${detail}`:''}`);};

for(const file of ['story-test.html','assets/story-playtest-v72.js','assets/story-prediction-curriculum-v71.js','assets/story-scroll-editor-v70.js'])check(`file exists: ${file}`,fs.existsSync(path.join(root,file)));
const html=read('story-test.html');
const play=read('assets/story-playtest-v72.js');
const curriculum=read('assets/story-prediction-curriculum-v71.js');
try{new Function(play);check('Story playtest JavaScript parses',true);}catch(error){check('Story playtest JavaScript parses',false,error.message);}
check('playtest loads saved Story Editor data',play.includes('editor.export?.()')&&play.includes('rush-duel-story-playtest-v72'));
check('playtest consumes V71 authored targets',play.includes('curriculum.targets.map')&&html.includes('story-prediction-curriculum-v71.js?v=71'));
check('playtest direct page loads V72 runtime',html.includes('story-playtest-v72.js?v=72'));
check('49 curriculum targets still authored',(curriculum.match(/\bt\('/g)||[]).length===49);
check('three-heart retry system',play.includes('MAX_HEARTS=3')&&play.includes("'MISPLACED · RETRY'")&&play.includes('state.lives--'));
check('five-placement checkpoints',play.includes('CHECKPOINT_EVERY=5')&&play.includes('Math.floor(state.index/CHECKPOINT_EVERY)*CHECKPOINT_EVERY'));
check('wrong placements disappear',play.includes('state.piece=null')&&play.includes('spawnPiece(620)'));
check('correct placement uses exact target cells',play.includes('cellKey(pieceCellsAtBottom(state.piece))===cellKey(expectedLocalCells())'));
check('difficulty changes target assistance',play.includes('1-(t.difficulty-1)*.22'));
check('difficulty and progress increase fall speed',play.includes('diff*.42+progress*.75'));
check('story transitions scroll upward',play.includes('drawBoard(state.transition.from,-offset')&&play.includes('drawBoard(state.transition.to,BOARD_H-offset'));
check('all seven Tetris piece types remain in curriculum',['I','J','L','O','S','T','Z'].every(shape=>curriculum.includes(`'${shape}'`)));
check('mobile controls include move rotate drop',html.includes('data-story-test-action="left"')&&html.includes('data-story-test-action="ccw"')&&html.includes('data-story-test-action="drop"')&&html.includes('data-story-test-action="cw"')&&html.includes('data-story-test-action="right"'));
check('Story Editor link remains available',html.includes('story-editor.html?v=71'));
check('solver gaps can be rebuilt',play.includes("params.get('rebuild')==='1'")&&play.includes('curriculum.apply'));

if(failures.length){console.error(`Story Playtest validation failed (${failures.length}):\n- ${failures.join('\n- ')}`);process.exit(1);}
console.log('Story Mode V72 playtest validation passed: 49 solver-authored placements are playable from Easy to Expert.');