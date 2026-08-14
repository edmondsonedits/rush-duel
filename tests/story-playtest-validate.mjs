import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const failures=[];
const check=(name,ok,detail='')=>{if(!ok)failures.push(`${name}${detail?`: ${detail}`:''}`);};

for(const file of ['story-test.html','assets/story-playtest-v72.js','assets/story-prediction-curriculum-v71.js'])check(`file exists: ${file}`,fs.existsSync(path.join(root,file)));
const html=read('story-test.html');
const play=read('assets/story-playtest-v72.js');
const curriculum=read('assets/story-prediction-curriculum-v71.js');
const targetCount=(curriculum.match(/\bt\('/g)||[]).length;

check('49 solver-authored targets',targetCount===49,String(targetCount));
check('direct page loads V72 playtest',html.includes('story-playtest-v72.js?v=72'));
check('direct page loads V71 curriculum first',html.indexOf('story-prediction-curriculum-v71.js?v=71')>=0&&html.indexOf('story-prediction-curriculum-v71.js?v=71')<html.indexOf('story-playtest-v72.js?v=72'));
check('playtest consumes curriculum targets',play.includes('curriculum.targets'));
check('playtest keeps three hearts',play.includes('MAX_HEARTS=3'));
check('playtest keeps five-placement checkpoints',play.includes('CHECKPOINT_EVERY=5'));
check('playtest exposes exact-placement routine',play.includes('correctPlacement'));
check('mobile controls wired',html.includes('data-story-test-action="left"')&&html.includes('data-story-test-action="drop"')&&html.includes('data-story-test-action="right"'));

if(failures.length){console.error(`Story Playtest validation failed (${failures.length}):\n- ${failures.join('\n- ')}`);process.exit(1);}
console.log(`Story Mode V72 integration passed: ${targetCount} solver-authored placements are wired into the playable page.`);