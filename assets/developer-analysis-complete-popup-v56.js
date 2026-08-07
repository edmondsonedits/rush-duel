(()=>{
'use strict';

const STORAGE='rush-duel-analysis-last-v56';
const POPUP_ID='analysisCompletePopupV56';
let pending=false;
let pollTimer=0;
let lastShownExportedAt='';

const lab=()=>window.__TETRIS_DUEL_ANALYSIS_LAB;
const clone=value=>{try{return JSON.parse(JSON.stringify(value));}catch{return null;}};
const code=data=>`const TETRIS_DUEL_ANALYSIS = ${JSON.stringify(data,null,2)};`;

function persist(data){
  if(!data)return;
  try{localStorage.setItem(STORAGE,JSON.stringify(data));}catch{}
}

function installStyle(){
  if(document.getElementById('analysisCompletePopupV56Style'))return;
  const style=document.createElement('style');
  style.id='analysisCompletePopupV56Style';
  style.textContent=`
body[data-analysis-complete-v56="1"] #customWinPopupV31{display:none!important;visibility:hidden!important;pointer-events:none!important}
#${POPUP_ID}{position:fixed;inset:0;z-index:500000;display:none;align-items:center;justify-content:center;padding:max(12px,env(safe-area-inset-top)) 12px max(12px,env(safe-area-inset-bottom));background:rgba(1,4,10,.92);backdrop-filter:blur(5px)}
#${POPUP_ID}.open{display:flex}
.analysis-complete-card-v56{width:min(860px,100%);height:min(92dvh,900px);min-height:0;display:grid;grid-template-rows:auto auto minmax(140px,1fr) auto;gap:10px;padding:12px;border:3px solid #6de7ff;border-radius:18px;background:#07101d;color:#fff;box-shadow:0 0 0 5px #02060d,0 24px 80px rgba(0,0,0,.75)}
.analysis-complete-head-v56{text-align:center}.analysis-complete-head-v56 small{color:#c99cff;font:900 8px/1.2 monospace;letter-spacing:.15em}.analysis-complete-head-v56 h2{margin:4px 0 2px;font-size:22px}.analysis-complete-head-v56 p{margin:0;color:#a9bdcc;font-size:9px;line-height:1.35}
.analysis-complete-summary-v56{display:grid;grid-template-columns:repeat(4,1fr);gap:6px}.analysis-complete-stat-v56{padding:7px 5px;border:1px solid #294657;border-radius:9px;background:#091726;text-align:center}.analysis-complete-stat-v56 b{display:block;font-size:16px}.analysis-complete-stat-v56 span{display:block;color:#8fa6b9;font-size:7px;text-transform:uppercase}
.analysis-complete-code-v56{width:100%;height:100%;min-height:0;resize:none;border:1px solid #40586b;border-radius:10px;background:#020711;color:#dff6ff;padding:9px;font:8px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre;overflow:auto;-webkit-user-select:text;user-select:text}
.analysis-complete-actions-v56{display:grid;grid-template-columns:2fr 1fr;gap:8px}.analysis-complete-actions-v56 button{min-height:54px;border:2px solid #6de7ff;border-radius:11px;color:#fff;background:#164f70;font-weight:950;font-size:11px}.analysis-complete-actions-v56 .copy{min-height:62px;border-color:#75ffc0;background:linear-gradient(180deg,#21a56d,#08724a);box-shadow:0 5px 0 #033b26;font-size:14px;letter-spacing:.06em}.analysis-complete-actions-v56 .copy.copied{background:linear-gradient(180deg,#37bf85,#0c8559)}
#analysisCompleteToastV56{position:fixed;z-index:500100;left:50%;bottom:max(22px,env(safe-area-inset-bottom));transform:translateX(-50%);max-width:90vw;padding:10px 14px;border:2px solid #75ffc0;border-radius:11px;background:#062017;color:#fff;font:900 10px/1.3 system-ui;text-align:center;box-shadow:0 10px 35px rgba(0,0,0,.55)}
@media(max-width:520px){.analysis-complete-card-v56{height:min(94dvh,860px);padding:10px}.analysis-complete-summary-v56{grid-template-columns:repeat(2,1fr)}.analysis-complete-actions-v56{grid-template-columns:1fr}.analysis-complete-actions-v56 .copy{order:-1}}
`;
  document.head.appendChild(style);
}

function toast(message){
  let node=document.getElementById('analysisCompleteToastV56');
  if(!node){node=document.createElement('div');node.id='analysisCompleteToastV56';document.body.appendChild(node);}
  node.textContent=message;
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>node.remove(),2200);
}

function ensurePopup(){
  let popup=document.getElementById(POPUP_ID);
  if(popup)return popup;
  popup=document.createElement('div');
  popup.id=POPUP_ID;
  popup.setAttribute('role','dialog');
  popup.setAttribute('aria-modal','true');
  popup.setAttribute('aria-labelledby','analysisCompleteTitleV56');
  popup.innerHTML=`<section class="analysis-complete-card-v56">
    <header class="analysis-complete-head-v56">
      <small>ANALYSIS LAB</small>
      <h2 id="analysisCompleteTitleV56">Recording Complete</h2>
      <p id="analysisCompleteSubtitleV56">Your entire game has been recorded. Copy the code and paste it into ChatGPT.</p>
    </header>
    <div id="analysisCompleteSummaryV56" class="analysis-complete-summary-v56"></div>
    <textarea id="analysisCompleteCodeV56" class="analysis-complete-code-v56" readonly spellcheck="false" aria-label="Complete Analysis Lab recording code"></textarea>
    <div class="analysis-complete-actions-v56">
      <button id="analysisCompleteCopyV56" class="copy" type="button">📋 COPY RECORDING</button>
      <button id="analysisCompleteDoneV56" type="button">Done</button>
    </div>
  </section>`;
  document.body.appendChild(popup);
  popup.querySelector('#analysisCompleteCopyV56').addEventListener('click',copyCurrent);
  popup.querySelector('#analysisCompleteDoneV56').addEventListener('click',done);
  return popup;
}

function summary(data){
  const s=data?.summary||{};
  return [
    [s.pieces||0,'Pieces'],
    [s.playerActions||0,'Actions'],
    [s.lines||0,'Lines'],
    [data?.boards?.length||0,'Boards']
  ];
}

function show(data){
  if(!data)return;
  persist(data);
  pending=false;
  clearTimeout(pollTimer);
  lastShownExportedAt=String(data.exportedAt||Date.now());
  document.body.dataset.analysisCompleteV56='1';
  const normal=document.getElementById('customWinPopupV31');
  if(normal){normal.hidden=true;normal.style.pointerEvents='none';}
  const popup=ensurePopup();
  const challenge=data.challenge?.name||'Challenge';
  popup.querySelector('#analysisCompleteTitleV56').textContent=`${challenge} — Recording Complete`;
  popup.querySelector('#analysisCompleteSubtitleV56').textContent='Your entire game is below. Tap COPY RECORDING once, then paste it into ChatGPT.';
  popup.querySelector('#analysisCompleteSummaryV56').innerHTML=summary(data).map(([value,label])=>`<div class="analysis-complete-stat-v56"><b>${value}</b><span>${label}</span></div>`).join('');
  popup.querySelector('#analysisCompleteCodeV56').value=code(data);
  const copyButton=popup.querySelector('#analysisCompleteCopyV56');
  copyButton.textContent='📋 COPY RECORDING';
  copyButton.classList.remove('copied');
  popup.classList.add('open');
  setTimeout(()=>popup.querySelector('#analysisCompleteCodeV56')?.scrollTo?.(0,0),0);
}

async function copyCurrent(){
  const area=document.getElementById('analysisCompleteCodeV56');
  if(!area||!area.value)return toast('No recording code is available.');
  let copied=false;
  try{await navigator.clipboard.writeText(area.value);copied=true;}catch{}
  if(!copied){
    area.focus();
    area.select();
    try{copied=document.execCommand('copy');}catch{}
  }
  if(copied){
    const button=document.getElementById('analysisCompleteCopyV56');
    if(button){button.textContent='✓ COPIED — PASTE INTO CHATGPT';button.classList.add('copied');}
    toast('Full game recording copied.');
  }else{
    area.focus();
    area.select();
    toast('Copy permission was blocked. The code is selected for manual copy.');
  }
}

function done(){
  const popup=document.getElementById(POPUP_ID);
  popup?.classList.remove('open');
  delete document.body.dataset.analysisCompleteV56;
  const challengeButton=document.getElementById('challengeModeButton');
  if(challengeButton){challengeButton.click();return;}
  const labApi=lab();
  labApi?.open?.();
}

function pollForFinishedRecording(){
  clearTimeout(pollTimer);
  const data=clone(lab()?.last?.());
  if(data&&data.recording===false&&String(data.exportedAt||'')!==lastShownExportedAt){
    show(data);
    return;
  }
  if(!pending)return;
  pollTimer=setTimeout(pollForFinishedRecording,25);
}

function handleScreen(){
  const screen=document.body.dataset.screen;
  const api=lab();
  if(screen==='custom-result'&&api?.isRecording?.()){
    pending=true;
    document.body.dataset.analysisCompleteV56='1';
    const normal=document.getElementById('customWinPopupV31');
    if(normal){normal.hidden=true;normal.style.pointerEvents='none';}
    pollForFinishedRecording();
    return;
  }
  if(screen==='developer-analysis-result'){
    const data=clone(api?.last?.());
    if(data&&String(data.exportedAt||'')!==lastShownExportedAt)show(data);
  }
}

function interceptNormalContinue(event){
  if(!pending&&document.body.dataset.analysisCompleteV56!=='1')return;
  const button=event.target instanceof Element?event.target.closest('#customWinPopupV31 button'):null;
  if(!button)return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function init(){
  installStyle();
  ensurePopup();
  document.addEventListener('click',interceptNormalContinue,true);
  new MutationObserver(handleScreen).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
  const app=document.getElementById('app');
  if(app)new MutationObserver(()=>{
    if(pending||document.body.dataset.analysisCompleteV56==='1'){
      const normal=document.getElementById('customWinPopupV31');
      if(normal){normal.hidden=true;normal.style.pointerEvents='none';}
    }
  }).observe(app,{childList:true,subtree:true});
  handleScreen();
  window.__TETRIS_DUEL_ANALYSIS_POPUP_V56={version:56,show:data=>show(clone(data)),copy:copyCurrent};
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();