(()=>{
'use strict';

const STAR_STORAGE_KEY='rush-duel-challenge-stars-v48';
const CAMPAIGN_PROGRESS_KEY='rush-duel-challenge-campaign-v33';
const CAMPAIGN_PREFIX='campaign-v33-';
const ACTIVE_KEYS=['rush-duel-challenge-launch-v37','rush-duel-active-campaign-v33'];
const LEVEL_COUNT=10;
const MAX_STARS=LEVEL_COUNT*3;
const THREE_STAR_LIMIT_MS=10*60*1000;
const STYLE_ID='challenge-stars-v48-style';
const TRACK=Symbol('challengeStarsV48Track');
const Board=window.__RUSH_MODULES?.Board;

let currentCampaignId='';
let resultAttempt=0;
let resultProcessedAttempt=-1;
let renderScheduled=false;

function validLevelId(value){
  const id=String(value||'');
  const number=Number(id.match(/(\d+)$/)?.[1]);
  return id.startsWith(CAMPAIGN_PREFIX)&&number>=1&&number<=LEVEL_COUNT?id:'';
}
function levelNumber(id){return Number(String(id||'').match(/(\d+)$/)?.[1])||0;}
function activeCampaignId(){
  for(const key of ACTIVE_KEYS){
    try{const id=validLevelId(sessionStorage.getItem(key));if(id)return id;}catch{}
  }
  return validLevelId(currentCampaignId);
}
function readJson(key,fallback){try{return JSON.parse(localStorage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function writeJson(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function parseTime(value){
  const match=String(value||'').trim().match(/^(\d+):(\d{1,2})(?:\.(\d))?$/);
  if(!match)return null;
  return Number(match[1])*60000+Number(match[2])*1000+Number(match[3]||0)*100;
}
function loadStarData(){
  const raw=readJson(STAR_STORAGE_KEY,null);
  const data={
    version:1,
    migrated:!!raw?.migrated,
    stars:raw?.stars&&typeof raw.stars==='object'?{...raw.stars}:{},
    bestMs:raw?.bestMs&&typeof raw.bestMs==='object'?{...raw.bestMs}:{},
    startingClearedMs:raw?.startingClearedMs&&typeof raw.startingClearedMs==='object'?{...raw.startingClearedMs}:{},
    updatedAt:String(raw?.updatedAt||new Date().toISOString())
  };
  for(const id of Object.keys(data.stars)){
    if(!validLevelId(id))delete data.stars[id];
    else data.stars[id]=Math.max(0,Math.min(3,Number(data.stars[id])||0));
  }
  if(!data.migrated){
    const progress=readJson(CAMPAIGN_PROGRESS_KEY,{});
    const completed=Array.isArray(progress?.completed)?progress.completed:[];
    for(const candidate of completed){
      const id=validLevelId(candidate);if(!id)continue;
      const recordedMs=parseTime(progress?.records?.[id]?.time);
      data.stars[id]=Math.max(Number(data.stars[id])||0,recordedMs!==null&&recordedMs<THREE_STAR_LIMIT_MS?3:2);
      if(recordedMs!==null)data.bestMs[id]=recordedMs;
    }
    data.migrated=true;
    data.updatedAt=new Date().toISOString();
    writeJson(STAR_STORAGE_KEY,data);
  }
  return data;
}
function saveStarData(data){data.version=1;data.migrated=true;data.updatedAt=new Date().toISOString();writeJson(STAR_STORAGE_KEY,data);}
function ensureUnlock(id){
  const progress=readJson(CAMPAIGN_PROGRESS_KEY,{});
  const completed=Array.isArray(progress.completed)?progress.completed.slice():[];
  if(completed.includes(id))return;
  completed.push(id);
  writeJson(CAMPAIGN_PROGRESS_KEY,{...progress,completed,records:progress.records&&typeof progress.records==='object'?progress.records:{}});
}
function awardStars(id,stars,{elapsedMs=null,startingElapsedMs=null}={}){
  id=validLevelId(id);if(!id)return false;
  const data=loadStarData(),before=Number(data.stars[id])||0,next=Math.max(before,Math.max(0,Math.min(3,Number(stars)||0)));
  if(next>=1)ensureUnlock(id);
  if(Number.isFinite(elapsedMs))data.bestMs[id]=Number.isFinite(Number(data.bestMs[id]))?Math.min(Number(data.bestMs[id]),elapsedMs):elapsedMs;
  if(Number.isFinite(startingElapsedMs))data.startingClearedMs[id]=Number.isFinite(Number(data.startingClearedMs[id]))?Math.min(Number(data.startingClearedMs[id]),startingElapsedMs):startingElapsedMs;
  if(next===before&&!Number.isFinite(elapsedMs)&&!Number.isFinite(startingElapsedMs))return false;
  data.stars[id]=next;saveStarData(data);scheduleRender();return next>before;
}

function installBoardTracking(){
  if(!Board||Board.prototype.__challengeStarsV48Patched)return;
  const originalSpawn=Board.prototype.spawn;
  const originalLock=Board.prototype.lock;
  Object.defineProperty(Board.prototype,'__challengeStarsV48Patched',{value:true,configurable:false});

  Board.prototype.spawn=function(...args){
    if(this.name==='CUSTOM'&&!this[TRACK]){
      const id=activeCampaignId();
      if(id){
        currentCampaignId=id;
        this[TRACK]={
          id,
          mask:this.grid.map(row=>row.map(Boolean)),
          initialCount:this.grid.reduce((sum,row)=>sum+row.filter(Boolean).length,0),
          startedAt:performance.now(),
          awarded:false
        };
      }
    }
    return originalSpawn.apply(this,args);
  };

  Board.prototype.lock=function(...args){
    const tracking=this[TRACK];
    let nextMask=null;
    if(tracking&&this.active){
      nextMask=tracking.mask.map(row=>row.slice());
      const occupancy=this.grid.map(row=>row.map(Boolean));
      const landing=this.ghostY();
      for(let py=0;py<4;py++)for(let px=0;px<4;px++)if(this.active.m[py][px]){
        const gx=this.active.x+px,gy=landing+py;
        if(gy>=0&&gy<occupancy.length&&gx>=0&&gx<occupancy[gy].length)occupancy[gy][gx]=true;
      }
      const fullRows=[];
      for(let y=0;y<occupancy.length;y++)if(occupancy[y].every(Boolean))fullRows.push(y);
      for(const row of fullRows.sort((a,b)=>b-a))nextMask.splice(row,1);
      while(nextMask.length<20)nextMask.unshift(Array(10).fill(false));
    }

    const result=originalLock.apply(this,args);
    if(tracking&&nextMask){
      tracking.mask=nextMask;
      const remaining=nextMask.reduce((sum,row)=>sum+row.filter(Boolean).length,0);
      if(!tracking.awarded&&tracking.initialCount>0&&remaining===0){
        tracking.awarded=true;
        const elapsedMs=Math.max(0,performance.now()-tracking.startedAt);
        awardStars(tracking.id,1,{startingElapsedMs:elapsedMs});
        document.dispatchEvent(new CustomEvent('tetris-duel:challenge-starting-blocks-cleared',{detail:{challengeId:tracking.id,elapsedMs,startingBlocks:tracking.initialCount}}));
      }
    }
    return result;
  };
}

function ensureStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');style.id=STYLE_ID;style.textContent=`
.challenge-campaign-header{grid-template-columns:58px minmax(0,1fr) auto!important;}
.challenge-star-tools{display:flex;align-items:center;justify-content:flex-end;gap:7px;min-width:0;}
.challenge-star-total{display:flex;align-items:center;gap:5px;min-height:44px;padding:0 10px;border:1px solid rgba(255,216,91,.45);border-radius:12px;background:linear-gradient(180deg,rgba(66,51,12,.82),rgba(24,18,5,.92));box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 0 13px rgba(255,205,72,.08);color:#ffe26b;font:900 12px/1 ui-monospace,monospace;white-space:nowrap;}
.challenge-star-total span{font-size:16px;filter:drop-shadow(0 0 5px rgba(255,220,88,.35));}
#challengeCampaignHelp.challenge-star-help{width:44px;min-width:44px;min-height:44px!important;opacity:.56;border-color:rgba(103,166,205,.55)!important;color:#b8d8ec!important;background:linear-gradient(180deg,rgba(23,59,96,.7),rgba(8,24,44,.72))!important;box-shadow:none!important;}
#challengeCampaignHelp.challenge-star-help:focus-visible,#challengeCampaignHelp.challenge-star-help:hover{opacity:.9;}
.challenge-card-stars{display:flex;align-items:center;gap:3px;margin-top:5px;color:#ffe36a;font-size:16px;line-height:1;letter-spacing:.01em;}
.challenge-card-star{display:inline-block;width:16px;text-align:center;}
.challenge-card-star.empty{color:rgba(255,229,117,.27);text-shadow:0 0 5px rgba(255,219,75,.07);}
.challenge-card-star.filled{color:#ffe45d;text-shadow:0 0 7px rgba(255,215,65,.5);filter:drop-shadow(0 1px 0 #6e4c00);}
.challenge-level-card.one-star{border-color:#6d86a1;}
.challenge-level-card.two-star,.challenge-level-card.three-star{border-color:#68f0af;}
.challenge-level-card.three-star{box-shadow:0 4px 0 #01050c,0 0 18px rgba(255,221,78,.16),inset 0 0 20px rgba(104,240,175,.05);}
.challenge-star-help-dialog{width:min(360px,calc(100vw - 28px));padding:0;border:2px solid #5cecff;border-radius:17px;color:#eaf8ff;background:linear-gradient(180deg,#10223c,#050b16);box-shadow:0 0 0 5px #030710,0 0 32px rgba(92,236,255,.27);}
.challenge-star-help-dialog::backdrop{background:rgba(0,3,9,.76);backdrop-filter:blur(3px);}
.challenge-star-help-dialog form{display:grid;gap:11px;padding:17px;}
.challenge-star-help-dialog h2{margin:0;text-align:center;font-size:21px;}
.challenge-star-help-dialog p{margin:0;color:#9fb7c9;font-size:11px;line-height:1.45;text-align:center;}
.challenge-star-rule{display:grid;grid-template-columns:54px 1fr;align-items:center;gap:10px;padding:9px;border:1px solid rgba(92,236,255,.18);border-radius:11px;background:rgba(2,10,22,.62);}
.challenge-star-rule-stars{color:#ffe45d;font-size:17px;letter-spacing:1px;white-space:nowrap;text-shadow:0 0 7px rgba(255,215,65,.35);}
.challenge-star-rule div:last-child{color:#b8ccda;font-size:10px;line-height:1.35;}.challenge-star-rule b{display:block;margin-bottom:2px;color:#fff;font-size:11px;}
.challenge-star-help-close{min-height:42px;border:2px solid #62dfff;border-radius:11px;color:#fff;background:linear-gradient(180deg,#17649a,#0a3156);font-weight:900;}
@media(max-width:520px) and (orientation:portrait){.challenge-campaign-header{grid-template-columns:44px minmax(0,1fr) auto!important;gap:6px!important;}.challenge-star-tools{gap:4px}.challenge-star-total{min-height:40px;padding:0 7px;font-size:10px}.challenge-star-total span{font-size:14px}#challengeCampaignHelp.challenge-star-help{width:40px;min-width:40px;min-height:40px!important}.challenge-card-stars{font-size:14px;margin-top:3px}.challenge-card-star{width:14px}.challenge-level-meta span{font-size:6.5px!important}}
`;
  document.head.appendChild(style);
}
function ensureHelpDialog(){
  if(document.getElementById('challengeStarHelpDialog'))return;
  const dialog=document.createElement('dialog');dialog.id='challengeStarHelpDialog';dialog.className='challenge-star-help-dialog';dialog.setAttribute('aria-labelledby','challengeStarHelpTitle');
  dialog.innerHTML=`<form method="dialog"><h2 id="challengeStarHelpTitle">How Challenge Stars Work</h2><p>Each challenge has three stars. Your best result is saved on this device.</p><section class="challenge-star-rule"><div class="challenge-star-rule-stars">★☆☆</div><div><b>1 Star</b>Remove every block that was on the board when the challenge began. This unlocks the next challenge.</div></section><section class="challenge-star-rule"><div class="challenge-star-rule-stars">★★☆</div><div><b>2 Stars</b>Clear the remaining blocks, remove the final line, and beat the challenge.</div></section><section class="challenge-star-rule"><div class="challenge-star-rule-stars">★★★</div><div><b>3 Stars</b>Beat the challenge in under 10 minutes. The star timer runs quietly in the background.</div></section><button class="challenge-star-help-close" value="close">Got It</button></form>`;
  document.body.appendChild(dialog);
}
function ensureHeaderTools(){
  const header=document.querySelector('.challenge-campaign-header'),help=document.getElementById('challengeCampaignHelp');if(!header||!help)return;
  let tools=header.querySelector('.challenge-star-tools');
  if(!tools){tools=document.createElement('div');tools.className='challenge-star-tools';header.appendChild(tools);}
  let total=tools.querySelector('.challenge-star-total');
  if(!total){total=document.createElement('div');total.className='challenge-star-total';total.setAttribute('aria-label','Total challenge stars earned');total.innerHTML='<span aria-hidden="true">★</span><b id="challengeStarTotalText">0/30</b>';tools.appendChild(total);}
  help.classList.add('challenge-star-help');tools.appendChild(help);
}
function starsFor(data,id){return Math.max(0,Math.min(3,Number(data.stars[id])||0));}
function renderStarUi(){
  renderScheduled=false;ensureStyles();ensureHelpDialog();ensureHeaderTools();
  const data=loadStarData();let total=0;
  document.querySelectorAll('.challenge-level-card').forEach(card=>{
    const button=card.querySelector('.challenge-level-play[data-level-id]');
    const id=validLevelId(button?.dataset.levelId);if(!id)return;
    const number=levelNumber(id),stars=starsFor(data,id);total+=stars;
    let row=card.querySelector('.challenge-card-stars');
    if(!row){row=document.createElement('div');row.className='challenge-card-stars';card.querySelector('.challenge-level-meta')?.appendChild(row);}
    const markup=Array.from({length:3},(_,index)=>`<span class="challenge-card-star ${index<stars?'filled':'empty'}" aria-hidden="true">${index<stars?'★':'☆'}</span>`).join('');
    if(row.innerHTML!==markup)row.innerHTML=markup;
    row.setAttribute('aria-label',`${stars} of 3 stars earned`);row.setAttribute('role','img');
    card.classList.toggle('one-star',stars===1);card.classList.toggle('two-star',stars===2);card.classList.toggle('three-star',stars===3);card.classList.toggle('completed',stars>=2);
    const numberBadge=card.querySelector('.challenge-level-number');if(numberBadge&&numberBadge.textContent!==String(number))numberBadge.textContent=String(number);
    if(button&&!button.disabled){const label=stars>=2?'Replay':stars===1?'Continue Challenge':'Play Challenge';if(button.textContent!==label)button.textContent=label;}
    const status=card.querySelector('.challenge-level-stats span:first-child');if(status){const text=`${stars}/3 stars`;if(status.textContent!==text)status.textContent=text;}
  });
  const totalText=document.getElementById('challengeStarTotalText');if(totalText)totalText.textContent=`${total}/${MAX_STARS}`;
}
function scheduleRender(){if(renderScheduled)return;renderScheduled=true;requestAnimationFrame(renderStarUi);}

function processResultScreen(){
  if(document.body.dataset.screen!=='custom-result'||resultProcessedAttempt===resultAttempt)return;
  const id=validLevelId(currentCampaignId)||activeCampaignId();if(!id)return;
  const won=document.getElementById('customResultTitle')?.textContent?.trim()==='Challenge Cleared';if(!won)return;
  const elapsedMs=parseTime(document.getElementById('customResultTime')?.textContent);
  if(elapsedMs===null)return;
  resultProcessedAttempt=resultAttempt;
  awardStars(id,elapsedMs<THREE_STAR_LIMIT_MS?3:2,{elapsedMs});
}
function handleScreenChange(){
  const screen=document.body.dataset.screen;
  if(screen==='custom-play'){
    const id=activeCampaignId();if(id){currentCampaignId=id;resultAttempt++;resultProcessedAttempt=-1;}
  }else if(screen==='custom-result')requestAnimationFrame(processResultScreen);
  else if(screen==='challenge-campaign')scheduleRender();
}
function bindUiInterception(){
  document.addEventListener('click',event=>{
    const target=event.target instanceof Element?event.target.closest('button'):null;if(!target)return;
    if(target.id==='challengeCampaignHelp'){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      ensureHelpDialog();const dialog=document.getElementById('challengeStarHelpDialog');if(dialog&&!dialog.open)dialog.showModal();return;
    }
    if(target.id==='challengeResetProgress'){
      event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();
      if(!confirm('Reset all Challenge Mode stars, unlocks, and best records?'))return;
      try{localStorage.removeItem(STAR_STORAGE_KEY);localStorage.removeItem(CAMPAIGN_PROGRESS_KEY);}catch{}
      currentCampaignId='';
      document.getElementById('challengeModeButton')?.click();
      scheduleRender();
    }
  },true);
}
function attachObservers(){
  new MutationObserver(handleScreenChange).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
  const attachGrid=()=>{
    const grid=document.getElementById('challengeLevelGrid');if(!grid||grid.dataset.starObserverV48)return;
    grid.dataset.starObserverV48='1';new MutationObserver(scheduleRender).observe(grid,{childList:true,subtree:true});scheduleRender();
  };
  const bodyObserver=new MutationObserver(()=>{attachGrid();if(document.body.dataset.screen==='challenge-campaign')scheduleRender();});
  bodyObserver.observe(document.body,{childList:true,subtree:true});attachGrid();
}
function init(){installBoardTracking();ensureStyles();ensureHelpDialog();bindUiInterception();attachObservers();handleScreenChange();scheduleRender();}

window.__TETRIS_DUEL_CHALLENGE_STARS={
  version:48,
  getProgress:()=>loadStarData(),
  parseTime,
  runSelfTests(){
    const parsePass=parseTime('9:59.9')===599900&&parseTime('10:00.0')===600000&&parseTime('bad')===null;
    const idPass=validLevelId('campaign-v33-1')==='campaign-v33-1'&&!validLevelId('campaign-v33-11');
    return {pass:parsePass&&idPass,tests:[{name:'time parsing and ten-minute boundary',pass:parsePass},{name:'campaign level validation',pass:idPass}]};
  }
};

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
