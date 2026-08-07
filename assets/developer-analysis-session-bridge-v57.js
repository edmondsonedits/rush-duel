(()=>{
'use strict';
if(window.__TETRIS_DUEL_ANALYSIS_SESSION_BRIDGE_V57)return;

let session=null;
let pollTimer=0;
let serial=0;
const lab=()=>window.__TETRIS_DUEL_ANALYSIS_LAB;
const clone=v=>{try{return JSON.parse(JSON.stringify(v));}catch{return null;}};

function begin(levelId=''){
  clearTimeout(pollTimer);
  session={id:++serial,levelId,startedAt:Date.now(),enteredPlay:false,resultSeen:false,delivered:false};
  document.body.dataset.analysisSessionV57=String(session.id);
}

function isFresh(data){
  if(!session||!data||data.recording!==false)return false;
  const created=Date.parse(data.createdAt||'');
  if(!Number.isFinite(created)||created<session.startedAt-1500)return false;
  const pieces=Number(data.summary?.pieces||0);
  const placements=(data.attempts||[]).reduce((n,a)=>n+(a.placements?.length||0),0);
  return pieces>0||placements>0;
}

function deliver(data){
  if(!session||session.delivered||!isFresh(data))return false;
  session.delivered=true;
  clearTimeout(pollTimer);
  window.dispatchEvent(new CustomEvent('tetris-duel-analysis-fresh-complete',{detail:clone(data)}));
  return true;
}

function poll(tries=0){
  if(!session||session.delivered||!session.resultSeen)return;
  const data=clone(lab()?.last?.());
  if(deliver(data))return;
  if(tries>=240){
    window.dispatchEvent(new CustomEvent('tetris-duel-analysis-fresh-error',{detail:{reason:'fresh-recording-timeout',sessionId:session.id}}));
    return;
  }
  pollTimer=setTimeout(()=>poll(tries+1),25);
}

function handleScreen(){
  if(!session)return;
  const screen=document.body.dataset.screen;
  if(screen==='custom-play')session.enteredPlay=true;
  if(screen==='custom-result'&&session.enteredPlay){
    session.resultSeen=true;
    poll(0);
  }
  if(screen==='developer-analysis-result'&&session.resultSeen){
    const area=document.getElementById('alCode');
    const text=area?.value||'';
    const match=text.match(/^const\s+TETRIS_DUEL_ANALYSIS\s*=\s*([\s\S]*);\s*$/);
    if(match){try{if(deliver(JSON.parse(match[1])))return;}catch{}}
    poll(0);
  }
}

document.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('[data-al-level]'):null;
  if(button)begin(button.dataset.alLevel||'');
},true);
new MutationObserver(handleScreen).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
handleScreen();

window.__TETRIS_DUEL_ANALYSIS_SESSION_BRIDGE_V57={
  version:57,
  current:()=>clone(session),
  fresh:data=>isFresh(data),
  begin
};
})();