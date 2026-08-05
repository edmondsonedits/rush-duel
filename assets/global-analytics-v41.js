(()=>{
'use strict';

const BUILD='V41';
const DEV_FLAG='rush-duel-developer-mode-v38';
const ACTIVE_CHALLENGE_KEY='rush-duel-challenge-launch-v37';
const API_ROOT='https://api.counterapi.dev/v1';
const NAMESPACE='edmondsonedits-rush-duel-global-v41-9f3c7a2d';
const VISITOR_FLAG='rush-duel-global-visitor-v41';
const SESSION_FLAG='rush-duel-global-session-v41';
const PENDING_KEY='rush-duel-global-pending-v41';
const REMAINDER_KEY='rush-duel-global-time-remainders-v41';
const STYLE_ID='rush-duel-global-analytics-v41-style';
const TIME_UNIT_MS=30000;
const MODES={
  solo:{label:'Solo Play',short:'Solo'},
  bot:{label:'Solo vs Bot',short:'Vs Bot'},
  online:{label:'Online Multiplayer',short:'Multiplayer'},
  challenges:{label:'Challenges Mode',short:'Challenges'},
  custom:{label:'Custom Mode',short:'Custom'}
};

let activeMode=sessionStorage.getItem('rush-duel-active-global-mode-v41')||'';
let lastScreen=document.body.dataset.screen||'title';
let lastTick=performance.now();
let flushing=false;
let flushTimer=0;
let dashboardRequest=0;
let lastResultSignature='';
let lastPlaySignature='';

function trackingAllowed(){return localStorage.getItem(DEV_FLAG)!=='1';}
function readJson(storage,key,fallback){try{return JSON.parse(storage.getItem(key)||'null')??fallback;}catch{return fallback;}}
function writeJson(storage,key,value){try{storage.setItem(key,JSON.stringify(value));return true;}catch{return false;}}
function counterUrl(key,action=''){return `${API_ROOT}/${encodeURIComponent(NAMESPACE)}/${encodeURIComponent(key)}${action?`/${action}`:''}`;}

function extractCount(payload){
  const candidates=[payload?.count,payload?.value,payload?.data?.count,payload?.data?.value,payload?.data,payload?.result?.count,payload?.result?.value];
  for(const value of candidates){
    if(typeof value==='number'&&Number.isFinite(value))return value;
    if(typeof value==='string'&&value.trim()!==''&&Number.isFinite(Number(value)))return Number(value);
  }
  return 0;
}

async function fetchCounter(key){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(counterUrl(key),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
    if(response.status===404)return {ok:true,value:0};
    if(!response.ok)throw new Error(`Counter ${response.status}`);
    return {ok:true,value:extractCount(await response.json())};
  }catch{return {ok:false,value:0};}
  finally{clearTimeout(timeout);}
}

async function incrementRemote(key){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),8000);
  try{
    const response=await fetch(counterUrl(key,'up'),{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',keepalive:true,signal:controller.signal});
    if(!response.ok)throw new Error(`Counter ${response.status}`);
    return true;
  }catch{return false;}
  finally{clearTimeout(timeout);}
}

function queueIncrement(key,amount=1){
  if(!trackingAllowed()||amount<=0)return;
  const pending=readJson(localStorage,PENDING_KEY,{});
  pending[key]=Math.min(5000,(Number(pending[key])||0)+Math.floor(amount));
  writeJson(localStorage,PENDING_KEY,pending);
  scheduleFlush(50);
}

function scheduleFlush(delay=1200){
  clearTimeout(flushTimer);
  flushTimer=setTimeout(flushPending,delay);
}

async function flushPending(){
  if(flushing||!navigator.onLine||!trackingAllowed())return;
  flushing=true;
  try{
    const pending=readJson(localStorage,PENDING_KEY,{});
    let sent=0;
    for(const key of Object.keys(pending)){
      while((Number(pending[key])||0)>0&&sent<12){
        if(!await incrementRemote(key)){writeJson(localStorage,PENDING_KEY,pending);scheduleFlush(15000);return;}
        pending[key]--;sent++;
      }
      if(pending[key]<=0)delete pending[key];
      if(sent>=12)break;
    }
    writeJson(localStorage,PENDING_KEY,pending);
    if(Object.keys(pending).length)scheduleFlush(1800);
  }finally{flushing=false;}
}

function markGameVisitor(){
  if(!trackingAllowed())return;
  if(localStorage.getItem(VISITOR_FLAG)!=='1'){
    localStorage.setItem(VISITOR_FLAG,'1');
    queueIncrement('unique_visitors');
  }
  if(sessionStorage.getItem(SESSION_FLAG)!=='1'){
    sessionStorage.setItem(SESSION_FLAG,'1');
    queueIncrement('sessions');
  }
}

function markUniqueMode(mode){
  const key=`rush-duel-global-mode-${mode}-v41`;
  if(localStorage.getItem(key)==='1')return;
  localStorage.setItem(key,'1');
  queueIncrement(`mode_${mode}_unique`);
}

function beginMode(mode,{countEntry=true}={}){
  if(!MODES[mode]||!trackingAllowed())return;
  markGameVisitor();
  accumulateTime();
  activeMode=mode;
  sessionStorage.setItem('rush-duel-active-global-mode-v41',mode);
  markUniqueMode(mode);
  if(countEntry)queueIncrement(`mode_${mode}_entries`);
}

function endMode(){
  accumulateTime();
  activeMode='';
  sessionStorage.removeItem('rush-duel-active-global-mode-v41');
}

function currentChallengeNumber(){
  const raw=sessionStorage.getItem(ACTIVE_CHALLENGE_KEY)||'';
  return Number(raw.match(/campaign-v33-(\d+)/)?.[1])||0;
}

function currentGameplayMode(){
  const screen=document.body.dataset.screen||'';
  if(screen==='game'){
    const mode=document.body.dataset.mode;
    return mode==='classic'?'solo':mode==='bot'?'bot':mode==='online'?'online':'';
  }
  if(screen==='custom-play')return currentChallengeNumber()?'challenges':'custom';
  return '';
}

function addTimedMs(bucket,delta){
  if(delta<=0)return;
  const remainders=readJson(localStorage,REMAINDER_KEY,{});
  let total=(Number(remainders[bucket])||0)+delta;
  const units=Math.floor(total/TIME_UNIT_MS);
  total-=units*TIME_UNIT_MS;
  remainders[bucket]=total;
  writeJson(localStorage,REMAINDER_KEY,remainders);
  if(units)queueIncrement(bucket,units);
}

function accumulateTime(){
  const now=performance.now();
  const delta=Math.max(0,Math.min(15000,now-lastTick));
  lastTick=now;
  if(document.hidden||!trackingAllowed()||!activeMode)return;
  addTimedMs(`mode_${activeMode}_engaged30`,delta);
  const gameplayMode=currentGameplayMode();
  if(gameplayMode===activeMode){
    addTimedMs(`mode_${activeMode}_play30`,delta);
    if(activeMode==='challenges'){
      const level=currentChallengeNumber();
      if(level)addTimedMs(`challenge_${level}_play30`,delta);
    }
  }
}

function markPlayStart(mode,extra=''){
  if(!MODES[mode]||!trackingAllowed())return;
  if(activeMode!==mode)beginMode(mode,{countEntry:false});
  const signature=`${mode}|${extra}|${Date.now()}`;
  if(signature===lastPlaySignature)return;
  lastPlaySignature=signature;
  queueIncrement(`mode_${mode}_plays`);
}

function markResult(mode){
  if(!MODES[mode]||!trackingAllowed())return;
  const title=(document.body.dataset.screen==='custom-result'?document.getElementById('customResultTitle'):document.getElementById('resultTitle'))?.textContent?.trim()||'';
  const signature=`${mode}|${title}|${document.getElementById('customResultTime')?.textContent||''}|${document.getElementById('resultText')?.textContent||''}`;
  if(!title||signature===lastResultSignature)return;
  lastResultSignature=signature;
  queueIncrement(`mode_${mode}_finishes`);
  if(/victory|cleared|new best/i.test(title))queueIncrement(`mode_${mode}_wins`);
  if(mode==='challenges'&&/cleared/i.test(title)){
    const level=currentChallengeNumber();
    if(level)queueIncrement(`challenge_${level}_clears`);
  }
}

function handleTrustedClick(event){
  const button=event.target instanceof Element?event.target.closest('button'):null;
  if(!button)return;
  if(button.id==='startButton'&&event.isTrusted){markGameVisitor();return;}
  if(!trackingAllowed())return;
  const modeById={classicButton:'solo',botButton:'bot',onlineButton:'online',customButton:'custom',challengeModeButton:'challenges'};
  if(event.isTrusted&&modeById[button.id]){beginMode(modeById[button.id]);return;}
  const challengePlay=button.closest('.challenge-level-play[data-level-id]');
  if(event.isTrusted&&challengePlay&&!challengePlay.disabled&&!challengePlay.closest('.locked')){
    beginMode('challenges',{countEntry:false});
    const level=Number(String(challengePlay.dataset.levelId||'').match(/(\d+)$/)?.[1])||0;
    if(level){
      const uniqueKey=`rush-duel-global-challenge-${level}-v41`;
      if(localStorage.getItem(uniqueKey)!=='1'){
        localStorage.setItem(uniqueKey,'1');
        queueIncrement(`challenge_${level}_unique`);
      }
      queueIncrement(`challenge_${level}_starts`);
    }
    return;
  }
  if(event.isTrusted&&button.matches('#customChallengeList [data-custom-command="play"]')&&!currentChallengeNumber()){
    beginMode('custom',{countEntry:false});
  }
  if(event.isTrusted&&['againButton','customResultReplay','customPlayRestart'].includes(button.id)&&activeMode){
    markPlayStart(activeMode,'replay');
  }
}

function handleScreenChange(){
  const screen=document.body.dataset.screen||'';
  if(screen===lastScreen)return;
  accumulateTime();
  const previous=lastScreen;
  lastScreen=screen;
  lastTick=performance.now();

  const gameplayMode=currentGameplayMode();
  if(gameplayMode&&previous!==screen)markPlayStart(gameplayMode,screen);
  if(screen==='result')markResult(activeMode||currentGameplayMode());
  if(screen==='custom-result')markResult(activeMode||currentGameplayMode());
  if(['title','mode','developer-tools'].includes(screen))endMode();
  if(screen!=='result'&&screen!=='custom-result')lastResultSignature='';
  if(screen!=='game'&&screen!=='custom-play')lastPlaySignature='';

  if(screen==='developer-tools')setTimeout(renderGlobalDashboard,30);
}

function number(value){return Math.max(0,Math.round(Number(value)||0));}
function formatNumber(value){return number(value).toLocaleString();}
function formatMinutes(value){
  const minutes=Math.max(0,Number(value)||0);
  if(minutes<60)return `${minutes.toFixed(minutes<10?1:0)} min`;
  const hours=minutes/60;
  return `${hours.toFixed(hours<10?1:0)} hr`;
}
function percent(part,total){return total>0?Math.min(999,part/total*100):0;}
function escapeHtml(value){const node=document.createElement('span');node.textContent=String(value);return node.innerHTML;}

async function loadCounterMap(keys){
  const entries=await Promise.all(keys.map(async key=>[key,await fetchCounter(key)]));
  const map={};let successes=0;
  for(const [key,result] of entries){map[key]=number(result.value);if(result.ok)successes++;}
  return {map,successes,total:keys.length};
}

function installDashboardStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
.global-analytics-loading{padding:18px;text-align:center;color:#9dc9e8;font-size:10px;letter-spacing:.08em;text-transform:uppercase}.global-mode-list{display:grid;gap:8px}.global-mode-card{display:grid;gap:7px;padding:10px;border:1px solid rgba(96,225,255,.23);border-radius:11px;background:rgba(4,10,24,.78)}.global-mode-head{display:flex;align-items:center;justify-content:space-between;gap:8px}.global-mode-head b{color:#fff;font-size:12px}.global-mode-head span{color:#75efba;font-size:8px;font-weight:900;text-transform:uppercase}.global-reach-bar{height:6px;border-radius:99px;background:#12233a;overflow:hidden}.global-reach-bar i{display:block;height:100%;min-width:0;background:linear-gradient(90deg,#62e8ff,#b77aff);border-radius:inherit}.global-mode-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px}.global-mode-metrics span{display:grid;gap:2px;padding:5px;border-radius:7px;background:rgba(255,255,255,.035);text-align:center;color:#899eb5;font-size:6px;text-transform:uppercase}.global-mode-metrics b{color:#fff;font-size:10px;text-transform:none}.global-level-row{display:grid;grid-template-columns:minmax(90px,1.5fr) repeat(4,minmax(48px,.7fr));gap:5px;align-items:center;padding:7px 4px;border-bottom:1px solid rgba(255,255,255,.07);font-size:7px;color:#99abc0}.global-level-row:last-child{border-bottom:0}.global-level-row strong{color:#fff;font-size:8px}.global-level-row span{text-align:right}.global-insight{padding:9px;border:1px solid rgba(255,203,103,.28);border-radius:9px;background:rgba(58,35,8,.35);color:#d8c8ad;font-size:8px;line-height:1.45}.global-status-good{color:#70ffc0!important}.global-status-bad{color:#ff8fac!important}.global-analytics-footnote{color:#8393a7;font-size:7px;line-height:1.45}.global-refresh-time{color:#7f9db4;font-size:7px;text-align:right}.developer-action#developerResetStats{display:none!important}@media(max-width:520px){.global-mode-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.global-level-row{grid-template-columns:minmax(78px,1.4fr) repeat(2,minmax(45px,.7fr))}.global-level-row span:nth-of-type(3),.global-level-row span:nth-of-type(4){display:none}}
`;
  document.head.appendChild(style);
}

async function renderGlobalDashboard(){
  const request=++dashboardRequest;
  const grid=document.getElementById('developerStatGrid');
  const modeBox=document.getElementById('developerModeStats');
  const challengeBox=document.getElementById('developerChallengeStats');
  const statusBox=document.getElementById('developerDeviceStats');
  if(!grid||!modeBox||!challengeBox||!statusBox)return;

  installDashboardStyles();
  const notice=document.querySelector('#developerToolsScreen .developer-notice');
  if(notice)notice.innerHTML='<b>Anonymous global analytics:</b> aggregate counters from all non-developer players. No player names, emails, locations, room codes, board layouts, or individual activity histories are stored. Collection began with Build V41.';
  const headings=[...document.querySelectorAll('#developerToolsScreen .developer-section h2')];
  headings.forEach(heading=>{
    if(heading.textContent==='Mode activity')heading.textContent='Global mode performance';
    if(heading.textContent==='Challenge progress')heading.textContent='Global challenge engagement';
    if(heading.textContent==='Current device')heading.textContent='Product direction';
  });
  grid.innerHTML='<div class="global-analytics-loading">Loading worldwide totals…</div>';
  modeBox.innerHTML='<div class="global-analytics-loading">Loading mode usage…</div>';
  challengeBox.innerHTML='<div class="global-analytics-loading">Loading challenge usage…</div>';
  statusBox.innerHTML='<div class="global-analytics-loading">Connecting to aggregate counters…</div>';

  const keys=['unique_visitors','sessions'];
  for(const mode of Object.keys(MODES))for(const suffix of ['unique','entries','plays','engaged30','play30','finishes','wins'])keys.push(`mode_${mode}_${suffix}`);
  for(let level=1;level<=10;level++)for(const suffix of ['unique','starts','play30','clears'])keys.push(`challenge_${level}_${suffix}`);
  const loaded=await loadCounterMap(keys);
  if(request!==dashboardRequest)return;
  const data=loaded.map;
  const visitors=data.unique_visitors||0,sessions=data.sessions||0;
  const modes=Object.keys(MODES).map(id=>{
    const unique=data[`mode_${id}_unique`]||0;
    const entries=data[`mode_${id}_entries`]||0;
    const plays=data[`mode_${id}_plays`]||0;
    const engaged=(data[`mode_${id}_engaged30`]||0)/2;
    const play=(data[`mode_${id}_play30`]||0)/2;
    const finishes=data[`mode_${id}_finishes`]||0;
    const wins=data[`mode_${id}_wins`]||0;
    return {id,...MODES[id],unique,entries,plays,engaged,play,finishes,wins,reach:percent(unique,visitors),avg:plays?play/plays:0};
  });
  const totalPlays=modes.reduce((sum,item)=>sum+item.plays,0);
  const totalPlayMinutes=modes.reduce((sum,item)=>sum+item.play,0);
  const returning=Math.max(0,sessions-visitors);

  grid.innerHTML=[
    [formatNumber(visitors),'Est. unique visitors'],
    [formatNumber(sessions),'Total sessions'],
    [formatNumber(totalPlays),'Game starts'],
    [formatMinutes(totalPlayMinutes),'In-game time'],
    [formatMinutes(totalPlays?totalPlayMinutes/totalPlays:0),'Avg. per game'],
    [formatNumber(returning),'Repeat sessions']
  ].map(([value,label])=>`<div class="developer-stat"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`).join('');

  const maxUnique=Math.max(1,...modes.map(item=>item.unique));
  modeBox.innerHTML=`<div class="global-mode-list">${modes.map(item=>`<article class="global-mode-card"><div class="global-mode-head"><b>${escapeHtml(item.label)}</b><span>${item.reach.toFixed(1)}% of visitors</span></div><div class="global-reach-bar"><i style="width:${item.unique/maxUnique*100}%"></i></div><div class="global-mode-metrics"><span><b>${formatNumber(item.unique)}</b>Unique players</span><span><b>${formatNumber(item.plays)}</b>Game starts</span><span><b>${formatMinutes(item.play)}</b>Play time</span><span><b>${formatMinutes(item.avg)}</b>Avg/game</span></div></article>`).join('')}</div>`;

  const levelNames=['Smiley','Heart','Rocket','Crown','Ghost','Lightning','Cat Face','Flame','Star','Saturn'];
  const levels=levelNames.map((name,index)=>{
    const n=index+1,unique=data[`challenge_${n}_unique`]||0,starts=data[`challenge_${n}_starts`]||0,play=(data[`challenge_${n}_play30`]||0)/2,clears=data[`challenge_${n}_clears`]||0;
    return {n,name,unique,starts,play,clears,rate:percent(clears,starts)};
  });
  challengeBox.innerHTML=`<div class="global-level-row"><strong>Level</strong><span>Players</span><span>Starts</span><span>Time</span><span>Clear rate</span></div>${levels.map(item=>`<div class="global-level-row"><strong>${item.n}. ${escapeHtml(item.name)}</strong><span>${formatNumber(item.unique)}</span><span>${formatNumber(item.starts)}</span><span>${formatMinutes(item.play)}</span><span>${item.rate.toFixed(0)}%</span></div>`).join('')}`;

  const withUse=modes.filter(item=>item.unique||item.plays||item.play);
  const mostReach=withUse.slice().sort((a,b)=>b.unique-a.unique)[0];
  const mostTime=withUse.slice().sort((a,b)=>b.play-a.play)[0];
  const bestAvg=withUse.filter(item=>item.plays>=2).sort((a,b)=>b.avg-a.avg)[0]||withUse.slice().sort((a,b)=>b.avg-a.avg)[0];
  const connected=loaded.successes>0;
  statusBox.innerHTML=`
    <div class="developer-row"><span>Global counter status</span><b class="${connected?'global-status-good':'global-status-bad'}">${connected?'Connected':'Unavailable'}</b></div>
    <div class="developer-row"><span>Collection start</span><b>Build ${BUILD}</b></div>
    <div class="developer-row"><span>Largest audience</span><b>${mostReach?`${escapeHtml(mostReach.label)} · ${formatNumber(mostReach.unique)}`:'Waiting for data'}</b></div>
    <div class="developer-row"><span>Most total play time</span><b>${mostTime?`${escapeHtml(mostTime.label)} · ${formatMinutes(mostTime.play)}`:'Waiting for data'}</b></div>
    <div class="developer-row"><span>Longest average game</span><b>${bestAvg?`${escapeHtml(bestAvg.label)} · ${formatMinutes(bestAvg.avg)}`:'Waiting for data'}</b></div>
    <div class="global-insight">${mostReach&&mostTime?`Prioritize <b>${escapeHtml(mostReach.label)}</b> for reach and <b>${escapeHtml(mostTime.label)}</b> for retained attention. Compare these again after each substantial update.`:'The dashboard will generate product-direction guidance as worldwide usage accumulates.'}</div>
    <div class="global-analytics-footnote">“Unique visitors” is an estimate of distinct browser profiles that pressed Start. A person using multiple devices, private browsing, or cleared storage can be counted more than once. Developer-enabled devices stop contributing so testing does not distort the totals. These are anonymous public aggregate counters and should be used as directional product analytics rather than billing-grade measurements.</div>
    <div class="global-refresh-time">Refreshed ${new Date().toLocaleTimeString()} · ${loaded.successes}/${loaded.total} counters reached</div>`;
}

function bindDashboardRefresh(){
  document.addEventListener('click',event=>{
    const button=event.target instanceof Element?event.target.closest('button'):null;
    if(!button)return;
    if(button.id==='developerRefresh'||button.id==='developerModeButton')setTimeout(renderGlobalDashboard,60);
  },true);
}

function init(){
  installDashboardStyles();
  document.addEventListener('click',handleTrustedClick,true);
  bindDashboardRefresh();
  new MutationObserver(handleScreenChange).observe(document.body,{attributes:true,attributeFilter:['data-screen','data-mode']});
  setInterval(accumulateTime,5000);
  addEventListener('online',()=>scheduleFlush(100));
  addEventListener('pagehide',()=>{accumulateTime();flushPending();});
  document.addEventListener('visibilitychange',()=>{accumulateTime();lastTick=performance.now();});
  scheduleFlush(2500);
  if(document.body.dataset.screen==='developer-tools')renderGlobalDashboard();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
