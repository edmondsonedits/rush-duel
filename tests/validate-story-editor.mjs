import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const failures=[];
const check=(name,condition,detail='')=>{if(!condition)failures.push(`${name}${detail?`: ${detail}`:''}`);};
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

for(const file of ['assets/story-scroll-editor-v70.js','assets/story-scroll-editor-v70.css','story-editor.html'])check(`file exists: ${file}`,fs.existsSync(path.join(root,file)));
const story=read('assets/story-scroll-editor-v70.js');
const css=read('assets/story-scroll-editor-v70.css');
const html=read('story-editor.html');
const loader=read('assets/app-v13.js');
try{new Function(story);check('Story Editor JavaScript parses',true);}catch(error){check('Story Editor JavaScript parses',false,error.message);}
check('Story Editor is 10 columns wide',story.includes('const COLS=10,STORY_ROWS=2000'));
check('Story Editor is 2000 rows tall',story.includes('STORY_ROWS=2000'));
check('Story Editor virtualizes visible rows',story.includes('first=clamp(Math.floor(scroll.scrollTop/cell)')&&story.includes('visible=Math.ceil(cssH/cell)+2'));
check('Story Editor supports all planned scenes',['Castle','Crown','Rocket','Ghost','Heart','Cat','Flame','Smiley','Saturn','Turtles','Lightning','Ending'].every(label=>story.includes(`label:'${label}'`)));
check('Story Editor has editable tetromino stamps',story.includes("tool==='stamp'")&&story.includes('stampPiece(x,row)')&&story.includes('Rush.rotatePieceMatrix'));
check('Story Editor autosaves',story.includes('saveGrid(false)')&&story.includes("rush-duel-story-scroll-v70"));
check('Story Editor import/export exists',story.includes('copyStory')&&story.includes('importStory'));
check('Story Editor main loader active',loader.includes("./story-scroll-editor-v70.js?v=70"));
check('Direct Story Editor entry loads module',html.includes('story-scroll-editor-v70.js?v=70')&&html.includes('window.__rushStoryEditor?.open?.()'));
check('Mobile editor uses internal scrolling',css.includes('.story-scroll{')&&css.includes('overflow-y:auto')&&css.includes('@media(max-width:700px)'));

if(failures.length){console.error(`Story Editor validation failed (${failures.length}):\n- ${failures.join('\n- ')}`);process.exit(1);}
console.log('Story Editor V70 validation passed: 10 × 2000 virtualized editable story board is wired into Custom Mode and direct entry.');
