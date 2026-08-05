(()=>{
'use strict';

const CUSTOM_STORAGE_KEY='rush-duel-custom-challenges-v23';
const PROGRESS_KEY='rush-duel-challenge-campaign-v33';
const DEV_OVERRIDE_KEY='rush-duel-developer-challenges-v38';
const DEV_FLAG='rush-duel-developer-mode-v38';
const ACTIVE_KEY='rush-duel-challenge-launch-v37';
const CAMPAIGN_PREFIX='campaign-v33-';
const ROWS=20;
const COLS=10;
const pack=window.__TETRIS_DUEL_CHALLENGE_PACK;
if(!pack?.levels?.length)return;

let activeLevel=null;
let launching=false;
let resultHandled=false;
let launchToken=0;

function readJson(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function cloneGrid(grid){return Array.from({length:ROWS},(_,y)=>Array.from({length:COLS},(_,x)=>typeof grid?.[y]?.[x]==='string'&&grid[y][x]?grid[y][x]:null));}
function levelId(number){return `${CAMPAIGN_PREFIX}${number}`;}
function baseLevel(number){
  const item=pack.levels.find(level=>Number(level.number)===Number(number));
  return item?{...item,id:levelId(item.number),grid:cloneGrid(item.grid)}:null;
}
function allLevels(){return pack.levels.map(item=>baseLevel(item.number)).filter(Boolean);}
function readCustomChallenges(){const value=readJson(localStorage,CUSTOM_STORAGE_KEY,[]);return Array.isArray(value)?value:[];}
function writeCustomChallenges(items){try{localStorage.setItem(CUSTOM_STORAGE_KEY,JSON.stringify(items));return true;}catch{return false;}}
function cleanupCampaignEntries(){const existing=readCustomChallenges(),clean=existing.filter(item=>!String(item?.id||'').startsWith(CAMPAIGN_PREFIX));if(clean.length!==existing.length)writeCustomChallenges(clean);}

function effectiveLevel(id){
  const number=Number(String(id||'').match(/(\d+)$/)?.[1]);
  const original=baseLevel(number);
  if(!original)return null;
  const overrides=readJson(localStorage,DEV_OVERRIDE_KEY,[]);
  const saved=Array.isArray(overrides)?overrides.find(item=>Number(item?.number)===number):null;
  if(!saved)return original;
  return {
    ...original,
    name:String(saved.name||original.name).slice(0,28),
    difficulty:String(saved.difficulty||original.difficulty).slice(0,28),
    description:String(saved.description||original.description).slice(0,180),
    seed:String(saved.seed||original.seed),
    grid:cloneGrid(saved.grid||original.grid)
  };
}

function challengeObject(item){
  const stamp=new Date().toISOString();
  return {version:1,id:item.id,name:`Level ${item.number} — ${item.name}`,grid:cloneGrid(item.grid),seed:item.seed,verified:false,bestMs:null,bestPieces:null,completions:0,createdAt:stamp,updatedAt:stamp};
}
function stageLevel(item){cleanupCampaignEntries();return writeCustomChallenges([challengeObject(item),...readCustomChallenges()]);}
function loadProgress(){const raw=readJson(localStorage,PROGRESS_KEY,{});return {completed:Array.isArray(raw.completed)?raw.completed:[],records:raw.records&&typeof raw.records==='object'?raw.records:{}};}
function saveProgress(progress){try{localStorage.setItem(PROGRESS_KEY,JSON.stringify(progress));}catch{}}
function isUnlocked(item){if(localStorage.getItem(DEV_FLAG)==='1')return true;const progress=loadProgress();return item.number===1||progress.completed.includes(levelId(item.number-1));}
function setActiveLevel(item){activeLevel=item;resultHandled=false;try{sessionStorage.setItem(ACTIVE_KEY,item.id);}catch{}}
function clearActiveLevel(){activeLevel=null;resultHandled=false;launching=false;try{sessionStorage.removeItem(ACTIVE_KEY);}catch{}}

function stylePlayScreen(item){
  const label=document.querySelector('#customPlayScreen .custom-play-header span');if(label)label.textContent='CHALLENGE MODE';
  const name=document.getElementById('customPlayName');if(name)name.textContent=`Level ${item.number} — ${item.name}`;
  document.getElementById('customPlayScreen')?.setAttribute('aria-label',`Challenge Mode level ${item.number}: ${item.name}`);
}
function restoreCustomLabels(){
  const label=document.querySelector('#customPlayScreen .custom-play-header span');if(label)label.textContent='CUSTOM MODE';
  const edit=document.getElementById('customResultEdit');if(edit)edit.hidden=false;
  const hub=document.getElementById('customResultHub');if(hub)hub.textContent='Challenges';
  const kicker=document.querySelector('#customResultScreen .custom-result-card .kicker');if(kicker)kicker.textContent='Custom Mode';
}

function waitForStagedPlayButton(item,token,attempt=0){
  if(token!==launchToken||!launching)return;
  const selector=`#customChallengeList button[data-custom-command="play"][data-custom-id="${CSS.escape(item.id)}"]`;
  const playButton=document.querySelector(selector);
  if(playButton){playButton.click();launching=false;cleanupCampaignEntries();stylePlayScreen(item);return;}
  if(attempt<40){requestAnimationFrame(()=>waitForStagedPlayButton(item,token,attempt+1));return;}
  launching=false;cleanupCampaignEntries();clearActiveLevel();
  alert('This challenge could not open. Please reload the page and try again.');
  document.getElementById('challengeModeButton')?.click();
}
function launchLevel(item){
  if(!item||!isUnlocked(item)||launching)return;
  if(!stageLevel(item)){alert('This browser could not prepare the challenge level.');return;}
  setActiveLevel(item);launching=true;const token=++launchToken;
  const customButton=document.getElementById('customButton');
  if(!customButton){launching=false;cleanupCampaignEntries();clearActiveLevel();alert('Custom Mode is still loading. Please try again.');return;}
  customButton.click();requestAnimationFrame(()=>waitForStagedPlayButton(item,token));
}
function captureChallengePlay(event){
  const button=event.target instanceof Element?event.target.closest('.challenge-level-play[data-level-id]'):null;
  if(!button)return;
  event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
  if(button.disabled||button.closest('.challenge-level-card')?.classList.contains('locked'))return;
  launchLevel(effectiveLevel(button.dataset.levelId));
}

function recordResult(item){
  if(resultHandled)return;resultHandled=true;
  const title=document.getElementById('customResultTitle');
  const won=title?.textContent?.trim()==='Challenge Cleared';
  cleanupCampaignEntries();
  const kicker=document.querySelector('#customResultScreen .custom-result-card .kicker');if(kicker)kicker.textContent='Challenge Mode';
  const edit=document.getElementById('customResultEdit');if(edit)edit.hidden=true;
  const hub=document.getElementById('customResultHub');if(hub)hub.textContent='Challenge Select';
  if(won){
    const progress=loadProgress();if(!progress.completed.includes(item.id))progress.completed.push(item.id);
    const pieces=Number(document.getElementById('customResultPieces')?.textContent)||0;
    const time=document.getElementById('customResultTime')?.textContent||'—';
    const prior=progress.records[item.id]||{};
    progress.records[item.id]={time,pieces:prior.pieces?Math.min(prior.pieces,pieces):pieces,completedAt:new Date().toISOString()};
    saveProgress(progress);
    const text=document.getElementById('customResultText');if(text)text.textContent=item.number<pack.levels.length?`Level ${item.number} cleared. Level ${item.number+1} is now unlocked.`:`You cleared all ${pack.levels.length} Challenge Mode levels!`;
    customizeWinPopup(item);
  }
}
function customizeWinPopup(item){
  const apply=()=>{
    const popup=document.getElementById('customWinPopupV31');if(!popup)return;
    const kicker=popup.querySelector('.custom-win-kicker');if(kicker)kicker.textContent=`Challenge ${item.number} Complete`;
    const heading=popup.querySelector('h2');if(heading)heading.textContent=item.number===pack.levels.length?'Campaign Complete!':'Challenge Cleared!';
    const message=popup.querySelector('.custom-win-message');if(message)message.textContent=item.number===pack.levels.length?`You cleared all ${pack.levels.length} block-art challenges.`:`You cleared ${item.name}. Level ${item.number+1} is now unlocked.`;
    const returning=popup.querySelector('.custom-win-returning');if(returning)returning.textContent='Returning to Challenge Select';
  };
  apply();requestAnimationFrame(apply);setTimeout(apply,80);
}
function returnToChallengeSelect(){cleanupCampaignEntries();restoreCustomLabels();clearActiveLevel();document.getElementById('challengeModeButton')?.click();}
function handleScreenChange(){
  if(!activeLevel)return;
  const screen=document.body.dataset.screen;
  if(screen==='custom-play'){launching=false;resultHandled=false;stylePlayScreen(activeLevel);return;}
  if(screen==='custom-result'){requestAnimationFrame(()=>recordResult(activeLevel));return;}
  if(screen==='custom-hub'&&!launching)requestAnimationFrame(returnToChallengeSelect);
}
function restoreInterruptedState(){const saved=readJson(sessionStorage,ACTIVE_KEY,'');if(saved){cleanupCampaignEntries();try{sessionStorage.removeItem(ACTIVE_KEY);}catch{}}}

restoreInterruptedState();
document.addEventListener('click',captureChallengePlay,true);
new MutationObserver(handleScreenChange).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
window.__TETRIS_DUEL_ACTIVE_CHALLENGE_LEVELS=allLevels;
})();
