(()=>{
'use strict';

const DEV_FLAG='rush-duel-developer-mode-v38';
const DEV_OVERRIDE_KEY='rush-duel-developer-challenges-v38';
const DEV_EDIT_KEY='rush-duel-developer-edit-v38';
const CUSTOM_STORAGE_KEY='rush-duel-custom-challenges-v23';
const ROWS=20;
const COLS=10;
const TYPE_COLORS={I:'#54e8ff',J:'#587cff',L:'#ff9d32',O:'#ffe25b',S:'#66ed87',T:'#bd72ff',Z:'#ff5c72'};

const BASE_LEVELS=[
  base(1,'Smiley','Easy','A friendly first clear with a simple face.',[
    '..OOOOOO..','.OOOOOOOO.','OO.OOOO.OO','OOOOOOOOOO','OOO....OOO','.OOOOOOOO.'
  ]),
  base(2,'Heart','Easy+','A wider shape that rewards clean row planning.',[
    '..ZZ..ZZ..','.ZZZZZZZZ.','ZZZZZZZZZZ','ZZZZZZZZZZ','.ZZZZZZZZ.','..ZZZZZZ..','...ZZZZ...','....ZZ....'
  ]),
  base(3,'Rocket','Rookie','Work around fins, a window, and a narrow exhaust.',[
    '....Z.....','...ZZZ....','...ZZZZ...','...IIII...','...IJI....','...IIII...','..IIIIII..','.JJLLLLJJ.'
  ]),
  base(4,'Crown','Intermediate','Three peaks and jewel gaps create uneven surfaces.',[
    '....T.....','.I..O..S..','.IO.OO.SO.','.IOOOOOOS.','OOOOOOOOOO','OJOOTOJOOO','OOOOOOOOOO'
  ]),
  base(5,'Ghost','Intermediate+','A broad body with eye holes and uneven feet.',[
    '....II....','...IIII...','..IIIIII..','.IIIIIIII.','II.JII.JII','IITIIIITII','IIIIIIIIII','II.II.II.I'
  ]),
  base(6,'Lightning','Advanced','A tall connected zigzag demands careful downstacking.',[
    '......OO..','.....OOL..','....OOL...','...OOL....','..OOOOO...','....LO....','...LO.....','..LO......','.OOOOOOO..'
  ]),
  base(7,'Cat Face','Advanced+','A wide face, pointed ears, and deep eye pockets.',[
    '.L......L.','.LL....LL.','.LLLLLLLL.','LLLLLLLLLL','LLL.LL.LLL','LLLLTLLLLL','LLLLLLLLLL','L.LLLLLL.L'
  ]),
  base(8,'Flame','Expert','Layered colours hide a dense, tapered core.',[
    '....Z.....','...ZLZ....','..ZLLLZ...','.ZLLOLLZ..','ZLLOOOLZZ.','LLLOOOOLLL','LLOOOOOLLL','LOOIOOOOLL','OOIIIIIOOO'
  ]),
  base(9,'Star','Master','Long arms and separated lower points punish mistakes.',[
    '....O.....','...OOO....','..OOOOO...','OOOOOOOOOO','.OOO..OOO.','..OOOOOO..','...OOOO...','..OO..OO..','.OO....OO.','OO......OO'
  ]),
  base(10,'Saturn','Grandmaster','The largest image combines a dense planet and ring.',[
    '...LLLL...','..LLLLLL..','.LLLLLLLL.','OOOLLLLOOO','O..LLLL..O','OOOOOOOOOO','.LLLLLLLL.','..LLLLLL..','...LLLL...','..LL..LL..'
  ])
];

let activeNumber=Number(sessionStorage.getItem(DEV_EDIT_KEY))||0;
let stagedId=activeNumber?`developer-campaign-v38-${activeNumber}`:'';
let launching=false;
let savedDuringEdit=false;
let screenObserver=null;

function base(number,name,difficulty,description,rows){
  const grid=Array.from({length:ROWS},()=>Array(COLS).fill(null));
  const start=ROWS-rows.length;
  rows.forEach((row,rowIndex)=>[...row].forEach((cell,column)=>{
    grid[start+rowIndex][column]=cell==='.'?null:(TYPE_COLORS[cell]||cell);
  }));
  return {number,name,difficulty,description,seed:`challenge-campaign-${number}-2026`,grid};
}

function readJson(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function writeJson(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function cloneGrid(grid){return Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>{const value=grid?.[y]?.[x];return typeof value==='string'&&value?(TYPE_COLORS[value]||value):null;}));}

function effectiveLevel(number){
  const original=BASE_LEVELS[number-1];if(!original)return null;
  const overrides=readJson(localStorage,DEV_OVERRIDE_KEY,[]);
  const saved=Array.isArray(overrides)?overrides.find(item=>Number(item?.number)===number):null;
  if(!saved)return {...original,grid:cloneGrid(original.grid)};
  return {...original,name:String(saved.name||original.name).slice(0,28),seed:String(saved.seed||original.seed),grid:cloneGrid(saved.grid)};
}

function stageEditorChallenge(number){
  const level=effectiveLevel(number);if(!level)return false;
  const stamp=new Date().toISOString();
  stagedId=`developer-campaign-v38-${number}`;
  const challenge={version:1,id:stagedId,name:`Level ${number} — ${level.name}`,grid:cloneGrid(level.grid),seed:level.seed,verified:false,bestMs:null,bestPieces:null,completions:0,createdAt:stamp,updatedAt:stamp};
  const existing=readJson(localStorage,CUSTOM_STORAGE_KEY,[]);
  const clean=Array.isArray(existing)?existing.filter(item=>!String(item?.id||'').startsWith('developer-campaign-v38-')):[];
  return writeJson(localStorage,CUSTOM_STORAGE_KEY,[challenge,...clean]);
}

function waitForEditButton(attempt=0){
  if(!launching||!activeNumber)return;
  const selector=`#customChallengeList button[data-custom-command="edit"][data-custom-id="${CSS.escape(stagedId)}"]`;
  const button=document.querySelector(selector);
  if(button){
    launching=false;
    button.click();
    requestAnimationFrame(styleEditor);
    return;
  }
  if(attempt<45){requestAnimationFrame(()=>waitForEditButton(attempt+1));return;}
  launching=false;
  clearEditState();
  alert('The developer challenge editor could not open. Reload the page and try again.');
}

function startDeveloperEdit(number){
  if(localStorage.getItem(DEV_FLAG)!=='1')return;
  if(!stageEditorChallenge(number)){alert('This browser could not prepare the challenge editor.');return;}
  activeNumber=number;
  savedDuringEdit=false;
  sessionStorage.setItem(DEV_EDIT_KEY,String(number));
  launching=true;
  const customButton=document.getElementById('customButton');
  if(!customButton){launching=false;clearEditState();alert('Custom Mode is still loading. Please try again.');return;}
  customButton.click();
  requestAnimationFrame(()=>waitForEditButton());
}

function captureEditClick(event){
  const button=event.target instanceof Element?event.target.closest('.developer-level-edit[data-developer-edit]'):null;
  if(!button)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  const number=Number(button.dataset.developerEdit);
  if(number>=1&&number<=10)startDeveloperEdit(number);
}

function readStagedChallenge(){
  const items=readJson(localStorage,CUSTOM_STORAGE_KEY,[]);
  return Array.isArray(items)?items.find(item=>String(item?.id||'')===stagedId)||null:null;
}

function saveOverrideFromStage(){
  const challenge=readStagedChallenge();
  const original=BASE_LEVELS[activeNumber-1];
  if(!challenge||!original)return false;
  const overrides=readJson(localStorage,DEV_OVERRIDE_KEY,[]);
  const clean=Array.isArray(overrides)?overrides.filter(item=>Number(item?.number)!==activeNumber):[];
  const rawName=String(challenge.name||original.name).replace(new RegExp(`^Level\\s+${activeNumber}\\s*[—-]\\s*`,'i'),'').trim();
  clean.push({number:activeNumber,name:(rawName||original.name).slice(0,28),difficulty:original.difficulty,description:original.description,seed:String(challenge.seed||original.seed),grid:cloneGrid(challenge.grid),updatedAt:new Date().toISOString()});
  clean.sort((a,b)=>a.number-b.number);
  savedDuringEdit=writeJson(localStorage,DEV_OVERRIDE_KEY,clean);
  cleanupStaged();
  return savedDuringEdit;
}

function cleanupStaged(){
  const items=readJson(localStorage,CUSTOM_STORAGE_KEY,[]);
  if(!Array.isArray(items))return;
  const clean=items.filter(item=>!String(item?.id||'').startsWith('developer-campaign-v38-'));
  if(clean.length!==items.length)writeJson(localStorage,CUSTOM_STORAGE_KEY,clean);
}

function styleEditor(){
  const label=document.querySelector('#customEditorScreen .custom-topbar span');if(label)label.textContent='DEVELOPER CHALLENGE EDITOR';
  const title=document.getElementById('customEditorTitle');if(title&&activeNumber)title.textContent=`Edit Level ${activeNumber}`;
}

function styleTestPlay(){
  const label=document.querySelector('#customPlayScreen .custom-play-header span');if(label)label.textContent='DEVELOPER TEST';
  const level=effectiveLevel(activeNumber);const name=document.getElementById('customPlayName');if(name&&level)name.textContent=`Level ${activeNumber} — ${level.name}`;
}

function returnToChallengeSelect(){
  cleanupStaged();
  const editorLabel=document.querySelector('#customEditorScreen .custom-topbar span');if(editorLabel)editorLabel.textContent='CUSTOM MODE';
  const playLabel=document.querySelector('#customPlayScreen .custom-play-header span');if(playLabel)playLabel.textContent='CUSTOM MODE';
  clearEditState();
  document.getElementById('challengeModeButton')?.click();
}

function clearEditState(){
  activeNumber=0;stagedId='';launching=false;savedDuringEdit=false;
  sessionStorage.removeItem(DEV_EDIT_KEY);
}

function handleScreenChange(){
  if(!activeNumber)return;
  const screen=document.body.dataset.screen;
  if(screen==='custom-editor'){styleEditor();return;}
  if(screen==='custom-play'){
    if(!savedDuringEdit)saveOverrideFromStage();
    styleTestPlay();
    return;
  }
  if(screen==='custom-result'){
    if(!savedDuringEdit)saveOverrideFromStage();
    return;
  }
  if(screen==='custom-hub'&&!launching){
    if(!savedDuringEdit)saveOverrideFromStage();
    requestAnimationFrame(returnToChallengeSelect);
  }
}

function restoreInterruptedEdit(){
  if(!activeNumber)return;
  cleanupStaged();
  clearEditState();
}

restoreInterruptedEdit();
document.addEventListener('click',captureEditClick,true);
screenObserver=new MutationObserver(handleScreenChange);
screenObserver.observe(document.body,{attributes:true,attributeFilter:['data-screen']});
})();
