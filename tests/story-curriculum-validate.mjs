import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const addon=read('assets/story-prediction-curriculum-v71.js');
const worker=read('assets/custom-final-assist-worker-v51.js');
const assist=read('assets/custom-final-assist-v51.js');
const loader=read('assets/app-v13.js');
const direct=read('story-editor.html');
const failures=[];
const check=(name,ok,detail='')=>{if(!ok)failures.push(`${name}${detail?`: ${detail}`:''}`);};

try{new Function(addon);check('Story curriculum parses',true);}catch(error){check('Story curriculum parses',false,error.message);}
const targetCount=(addon.match(/\bt\('/g)||[]).length-1; // subtract function t declaration
check('49 authored placement targets',targetCount===49,String(targetCount));
for(const scene of ['castle','crown','rocket','ghost','heart','cat','flame','smiley','saturn','turtles','lightning','ending'])check(`scene curriculum: ${scene}`,addon.includes(`t('${scene}'`));
for(const shape of ['I','J','L','O','S','T','Z'])check(`tetromino taught: ${shape}`,addon.includes(`'${shape}'`));
for(const level of [1,2,3,4,5])check(`difficulty ${level} present`,new RegExp(`,[^,]+,${level},'`).test(addon));
check('early obvious O double',addon.includes("t('castle',1932,'O',0,4,'double',1"));
check('early flat I clear',addon.includes("t('castle',1912,'I',0,3,'single',1"));
check('late vertical I wells',addon.includes("'I',1,8,'tetris',5")&&addon.includes("'I',1,1,'tetris',5"));
check('linked lookahead sequences',addon.includes("'saturn-chain'")&&addon.includes("'turtle-chain'")&&addon.includes("'storm-chain'")&&addon.includes("'ending-chain'"));
check('straight-drop approach corridors documented',addon.includes('straight hard-drop simulation')&&addon.includes('approach corridor'));
check('curriculum remains editable through Story Editor import',addon.includes("document.getElementById('storyImport')")&&addon.includes('button.click()'));
check('rebuild control present',addon.includes('Rebuild Solver Gaps'));

for(const feature of ['holes*420','holeDepth*52','blocksAboveHoles*95','aggregateHeight*8.5','maxHeight*34','bumpiness*11','rowTransitions*2.3','columnTransitions*3.4','cumulativeWells*6.2','rowConcentration*1.15','nearComplete*22'])check(`V51 heuristic retained: ${feature}`,worker.includes(feature));
check('V51 scores line clears',worker.includes('candidate.lines*1250'));
check('V51 enumerates rotations and x placements',worker.includes('for(const profile of PROFILES[shape])')&&worker.includes('for(let x=profile.x0;x<=profile.x1;x++)'));
check('V51 protects active plus three visible next pieces',assist.includes('VISIBLE_NEXT_COUNT=3')&&assist.includes('PROTECTED_PIECES=1+VISIBLE_NEXT_COUNT'));
check('V51 lookahead remains 12',assist.includes('TOTAL_LOOKAHEAD=12'));

check('main loader includes V71 curriculum',loader.includes("./story-prediction-curriculum-v71.js?v=71"));
check('main loader orders curriculum after editor',loader.indexOf('story-prediction-curriculum-v71.js')>loader.indexOf('story-scroll-editor-v70.js'));
check('direct Story Editor includes V71 curriculum',direct.includes("./assets/story-prediction-curriculum-v71.js?v=71"));
check('direct Story Editor loads curriculum after editor',direct.indexOf('story-prediction-curriculum-v71.js')>direct.indexOf('story-scroll-editor-v70.js'));

if(failures.length){console.error(`Story curriculum validation failed (${failures.length}):\n- ${failures.join('\n- ')}`);process.exit(1);}
console.log(`Story curriculum V71 validation passed: ${targetCount} authored solver-based placements, 12 scenes, Easy→Expert.`);