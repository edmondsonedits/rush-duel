(()=>{
'use strict';

const DEV_FLAG='rush-duel-developer-mode-v38';
const DEV_OVERRIDE_KEY='rush-duel-developer-challenges-v38';
const DEV_EDIT_KEY='rush-duel-developer-edit-v38';
const CUSTOM_STORAGE_KEY='rush-duel-custom-challenges-v23';
const ROWS=20;
const COLS=10;
const pack=window.__TETRIS_DUEL_CHALLENGE_PACK;
if(!pack?.levels?.length)return;

let activeNumber=Number(sessionStorage.getItem(DEV_EDIT_KEY))||0;
let stagedId=activeNumber?`developer-campaign-v38-${activeNumber}`:'';
let launching=false;
let savedDuringEdit=false;

function readJson(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function writeJson(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function cloneGrid(grid){return Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>typeof grid?.[y]?.[x]==='string'&&grid[y][x]?grid[y][x]:null));}
function baseLevel(number){const level=pack.levels.find(item=>Number(item.number)===Number(number));return level?{...level,grid:cloneGrid(level.grid)}:null;}
function effectiveLevel(number){
  const original=baseLevel(number);if(!original)return null;
  const overrides=readJson(localStorage,DEV_OVERRIDE_KEY,[]);
  const saved=Array.isArray(overrides)?overrides.find(item=>Number(item?.number)===number):null;
  if(!saved)return original;
  return {...original,name:String(saved.name||original.name).slice(0,28),difficulty:String(saved.difficulty||original.difficulty).slice(0,28),description:String(saved.description||original.description).slice(0,180),seed:String(saved.seed||original.seed),grid:cloneGrid(saved.grid||original.grid)};
}
function stageEditorChallenge(number){
  const level=effectiveLevel(number);if(!level)return false;
  const stamp=new Date().toISOString();stagedId=`developer-campaign-v38-${number}`;
  const challenge={version:1,id:stagedId,name:`Level ${number} — ${level.name}`,grid:cloneGrid(level.grid),seed:level.seed,verified:false,bestMs:null,bestPieces:null,completions:0,createdAt:stamp,updatedAt:stamp};
  const existing=readJson(localStorage,CUSTOM_STORAGE_KEY,[]);
  const clean=Array.isArray(existing)?existing.filter(item=>!String(item?.id||'').startsWith('developer-campaign-v38-')):[];
  return writeJson(localStorage,CUSTOM_STORAGE_KEY,[challenge,...clean]);
}
function waitForEditButton(attempt=0){
  if(!launching||!activeNumber)return;
  const button=document.querySelector(`#customChallengeList button[data-custom-command="edit"][data-custom-id="${CSS.escape(stagedId)}"]`);
  if(button){launching=false;button.click();requestAnimationFrame(styleEditor);return;}
  if(attempt<45){requestAnimationFrame(()=>waitForEditButton(attempt+1));return;}
  launching=false;clearEditState();alert('The developer challenge editor could not open. Reload the page and try again.');
}
function startDeveloperEdit(number){
  if(localStorage.getItem(DEV_FLAG)!=='1')return;
  if(!stageEditorChallenge(number)){alert('This browser could not prepare the challenge editor.');return;}
  activeNumber=number;savedDuringEdit=false;sessionStorage.setItem(DEV_EDIT_KEY,String(number));launching=true;
  const customButton=document.getElementById('customButton');
  if(!customButton){launching=false;clearEditState();alert('Custom Mode is still loading. Please try again.');return;}
  customButton.click();requestAnimationFrame(()=>waitForEditButton());
}
function captureEditClick(event){
  const button=event.target instanceof Element?event.target.closest('.developer-level-edit[data-developer-edit]'):null;
  if(!button)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  const number=Number(button.dataset.developerEdit);if(number>=1&&number<=pack.levels.length)startDeveloperEdit(number);
}
function readStagedChallenge(){const items=readJson(localStorage,CUSTOM_STORAGE_KEY,[]);return Array.isArray(items)?items.find(item=>String(item?.id||'')===stagedId)||null:null;}
function saveOverrideFromStage(){
  const challenge=readStagedChallenge();const original=baseLevel(activeNumber);if(!challenge||!original)return false;
  const overrides=readJson(localStorage,DEV_OVERRIDE_KEY,[]);
  const clean=Array.isArray(overrides)?overrides.filter(item=>Number(item?.number)!==activeNumber):[];
  const rawName=String(challenge.name||original.name).replace(new RegExp(`^Level\\s+${activeNumber}\\s*[—-]\\s*`,'i'),'').trim();
  clean.push({number:activeNumber,name:(rawName||original.name).slice(0,28),difficulty:original.difficulty,description:original.description,seed:String(challenge.seed||original.seed),grid:cloneGrid(challenge.grid),updatedAt:new Date().toISOString()});
  clean.sort((a,b)=>a.number-b.number);savedDuringEdit=writeJson(localStorage,DEV_OVERRIDE_KEY,clean);cleanupStaged();return savedDuringEdit;
}
function cleanupStaged(){const items=readJson(localStorage,CUSTOM_STORAGE_KEY,[]);if(!Array.isArray(items))return;const clean=items.filter(item=>!String(item?.id||'').startsWith('developer-campaign-v38-'));if(clean.length!==items.length)writeJson(localStorage,CUSTOM_STORAGE_KEY,clean);}
function styleEditor(){const label=document.querySelector('#customEditorScreen .custom-topbar span');if(label)label.textContent='DEVELOPER CHALLENGE EDITOR';const title=document.getElementById('customEditorTitle');if(title&&activeNumber)title.textContent=`Edit Level ${activeNumber}`;}
function styleTestPlay(){const label=document.querySelector('#customPlayScreen .custom-play-header span');if(label)label.textContent='DEVELOPER TEST';const level=effectiveLevel(activeNumber);const name=document.getElementById('customPlayName');if(name&&level)name.textContent=`Level ${activeNumber} — ${level.name}`;}
function returnToChallengeSelect(){cleanupStaged();const editorLabel=document.querySelector('#customEditorScreen .custom-topbar span');if(editorLabel)editorLabel.textContent='CUSTOM MODE';const playLabel=document.querySelector('#customPlayScreen .custom-play-header span');if(playLabel)playLabel.textContent='CUSTOM MODE';clearEditState();document.getElementById('challengeModeButton')?.click();}
function clearEditState(){activeNumber=0;stagedId='';launching=false;savedDuringEdit=false;sessionStorage.removeItem(DEV_EDIT_KEY);}
function handleScreenChange(){
  if(!activeNumber)return;const screen=document.body.dataset.screen;
  if(screen==='custom-editor'){styleEditor();return;}
  if(screen==='custom-play'){if(!savedDuringEdit)saveOverrideFromStage();styleTestPlay();return;}
  if(screen==='custom-result'){if(!savedDuringEdit)saveOverrideFromStage();return;}
  if(screen==='custom-hub'&&!launching){if(!savedDuringEdit)saveOverrideFromStage();requestAnimationFrame(returnToChallengeSelect);}
}
function restoreInterruptedEdit(){if(!activeNumber)return;cleanupStaged();clearEditState();}

restoreInterruptedEdit();
document.addEventListener('click',captureEditClick,true);
new MutationObserver(handleScreenChange).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
})();
