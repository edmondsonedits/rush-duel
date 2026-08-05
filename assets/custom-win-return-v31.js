(()=>{
'use strict';

const POPUP_ID='customWinPopupV31';
const STYLE_ID='custom-win-popup-v31-style';
const RETURN_DELAY_MS=3200;
let returnTimer=0;
let showing=false;

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#${POPUP_ID}{
  position:fixed;
  inset:0;
  z-index:100000;
  display:grid;
  place-items:center;
  padding:max(18px,env(safe-area-inset-top)) max(16px,env(safe-area-inset-right)) max(18px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));
  background:radial-gradient(circle at 50% 45%,rgba(24,93,95,.28),rgba(1,5,13,.84) 62%,rgba(1,3,9,.94));
  backdrop-filter:blur(7px);
  -webkit-backdrop-filter:blur(7px);
}
#${POPUP_ID}[hidden]{display:none!important;}
#${POPUP_ID} .custom-win-card{
  position:relative;
  width:min(430px,92vw);
  overflow:hidden;
  padding:28px 20px 19px;
  border:3px solid #62ecff;
  border-radius:20px;
  background:
    radial-gradient(circle at 50% 5%,rgba(91,255,211,.18),transparent 38%),
    linear-gradient(180deg,#10243c,#06101f 58%,#030914);
  box-shadow:0 22px 70px rgba(0,0,0,.66),0 0 32px rgba(91,231,255,.22),inset 0 0 30px rgba(91,231,255,.07);
  text-align:center;
}
#${POPUP_ID} .custom-win-burst{
  width:72px;
  height:72px;
  display:grid;
  place-items:center;
  margin:0 auto 13px;
  border:3px solid #79ffbd;
  border-radius:50%;
  color:#07151a;
  background:radial-gradient(circle,#e8fff3 0 20%,#79ffbd 22% 58%,#29ae79 60% 100%);
  box-shadow:0 0 25px rgba(121,255,189,.55),inset 0 0 14px rgba(255,255,255,.62);
  font-size:38px;
  font-weight:1000;
}
#${POPUP_ID} .custom-win-kicker{
  margin:0 0 5px;
  color:#79ffbd;
  font-size:10px;
  font-weight:900;
  letter-spacing:.22em;
  text-transform:uppercase;
}
#${POPUP_ID} h2{
  margin:0;
  color:#fff;
  font-size:clamp(30px,9vw,48px);
  line-height:.98;
  letter-spacing:.02em;
  text-shadow:0 0 14px rgba(98,236,255,.38);
}
#${POPUP_ID} .custom-win-message{
  margin:10px auto 15px;
  max-width:310px;
  color:#c8e5ed;
  font-size:12px;
  line-height:1.45;
}
#${POPUP_ID} .custom-win-stats{
  display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));
  gap:7px;
  margin:0 0 16px;
}
#${POPUP_ID} .custom-win-stats span{
  min-width:0;
  padding:9px 4px 7px;
  border:1px solid rgba(98,236,255,.3);
  border-radius:10px;
  color:#8da8b9;
  background:rgba(2,10,21,.62);
  font-size:7px;
  letter-spacing:.08em;
  text-transform:uppercase;
}
#${POPUP_ID} .custom-win-stats b{
  display:block;
  overflow:hidden;
  margin-bottom:4px;
  color:#fff;
  font-size:15px;
  line-height:1.1;
  text-overflow:ellipsis;
}
#${POPUP_ID} .custom-win-continue{
  width:100%;
  min-height:52px;
  border:2px solid #8affbe;
  border-radius:13px;
  color:#fff;
  background:linear-gradient(180deg,#27bf7d,#087044);
  box-shadow:0 4px 0 #023620,inset 0 1px 0 rgba(255,255,255,.22),0 0 18px rgba(91,255,179,.17);
  font-size:15px;
  font-weight:1000;
  letter-spacing:.1em;
  text-transform:uppercase;
}
#${POPUP_ID} .custom-win-continue:active{transform:translateY(3px);box-shadow:0 1px 0 #023620;}
#${POPUP_ID} .custom-win-returning{
  margin:11px 0 0;
  color:#829bab;
  font-size:7px;
  letter-spacing:.09em;
  text-transform:uppercase;
}
#${POPUP_ID} .custom-win-progress{
  height:3px;
  margin-top:7px;
  overflow:hidden;
  border-radius:99px;
  background:#102539;
}
#${POPUP_ID} .custom-win-progress i{
  display:block;
  width:100%;
  height:100%;
  background:linear-gradient(90deg,#55e9ff,#79ffbd);
  transform-origin:left;
  animation:customWinReturnV31 ${RETURN_DELAY_MS}ms linear forwards;
}
#${POPUP_ID} .custom-win-confetti{
  position:absolute;
  inset:0;
  pointer-events:none;
}
#${POPUP_ID} .custom-win-confetti i{
  position:absolute;
  top:-18px;
  width:7px;
  height:13px;
  border-radius:2px;
  background:var(--confetti,#62ecff);
  animation:customWinConfettiV31 2.4s ease-in infinite;
  animation-delay:var(--delay,0s);
  transform:translate3d(0,-20px,0) rotate(0deg);
}
#${POPUP_ID} .custom-win-confetti i:nth-child(1){left:9%;--delay:.05s;--confetti:#62ecff}
#${POPUP_ID} .custom-win-confetti i:nth-child(2){left:20%;--delay:.62s;--confetti:#ff5fad}
#${POPUP_ID} .custom-win-confetti i:nth-child(3){left:33%;--delay:.24s;--confetti:#ffe36d}
#${POPUP_ID} .custom-win-confetti i:nth-child(4){left:47%;--delay:.88s;--confetti:#79ffbd}
#${POPUP_ID} .custom-win-confetti i:nth-child(5){left:59%;--delay:.39s;--confetti:#b878ff}
#${POPUP_ID} .custom-win-confetti i:nth-child(6){left:72%;--delay:.77s;--confetti:#62ecff}
#${POPUP_ID} .custom-win-confetti i:nth-child(7){left:84%;--delay:.15s;--confetti:#ff755d}
#${POPUP_ID} .custom-win-confetti i:nth-child(8){left:93%;--delay:1.02s;--confetti:#ffe36d}
@keyframes customWinConfettiV31{
  0%{transform:translate3d(0,-22px,0) rotate(0deg);opacity:0}
  10%{opacity:1}
  100%{transform:translate3d(var(--drift,18px),480px,0) rotate(520deg);opacity:0}
}
@keyframes customWinReturnV31{from{transform:scaleX(1)}to{transform:scaleX(0)}}
@media (prefers-reduced-motion:reduce){
  #${POPUP_ID} .custom-win-confetti{display:none}
  #${POPUP_ID} .custom-win-progress i{animation:none;transform:scaleX(.35)}
}
`;
  document.head.appendChild(style);
}

function ensurePopup(){
  let popup=document.getElementById(POPUP_ID);
  if(popup)return popup;
  popup=document.createElement('div');
  popup.id=POPUP_ID;
  popup.hidden=true;
  popup.setAttribute('role','dialog');
  popup.setAttribute('aria-modal','true');
  popup.setAttribute('aria-labelledby','customWinTitleV31');
  popup.innerHTML=`
    <section class="custom-win-card">
      <div class="custom-win-confetti" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="custom-win-burst" aria-hidden="true">✓</div>
      <p class="custom-win-kicker">Custom Mode Complete</p>
      <h2 id="customWinTitleV31">Congratulations!</h2>
      <p class="custom-win-message">You cleared every block and beat this custom challenge.</p>
      <div class="custom-win-stats">
        <span><b data-win-stat="time">0:00.0</b>Time</span>
        <span><b data-win-stat="pieces">0</b>Pieces</span>
        <span><b data-win-stat="lines">0</b>Lines</span>
      </div>
      <button class="custom-win-continue" type="button">Continue</button>
      <p class="custom-win-returning">Returning to My Challenges</p>
      <div class="custom-win-progress" aria-hidden="true"><i></i></div>
    </section>`;
  document.body.appendChild(popup);
  popup.querySelector('.custom-win-continue')?.addEventListener('click',returnToCustomHub);
  return popup;
}

function setStat(name,value){
  const target=document.querySelector(`#${POPUP_ID} [data-win-stat="${name}"]`);
  if(target)target.textContent=value||'0';
}

function hidePopup(){
  clearTimeout(returnTimer);
  returnTimer=0;
  showing=false;
  const popup=document.getElementById(POPUP_ID);
  if(popup)popup.hidden=true;
}

function returnToCustomHub(){
  clearTimeout(returnTimer);
  returnTimer=0;
  const hubButton=document.getElementById('customResultHub');
  hidePopup();
  hubButton?.click();
}

function showWinPopup(){
  if(showing)return;
  const title=document.getElementById('customResultTitle');
  if(document.body.dataset.screen!=='custom-result'||title?.textContent?.trim()!=='Challenge Cleared')return;

  installStyles();
  const popup=ensurePopup();
  setStat('time',document.getElementById('customResultTime')?.textContent);
  setStat('pieces',document.getElementById('customResultPieces')?.textContent);
  setStat('lines',document.getElementById('customResultLines')?.textContent);

  // Restart the progress animation for repeat completions in the same session.
  const progress=popup.querySelector('.custom-win-progress i');
  if(progress){
    progress.style.animation='none';
    void progress.offsetWidth;
    progress.style.animation='';
  }

  showing=true;
  popup.hidden=false;
  popup.querySelector('.custom-win-continue')?.focus({preventScroll:true});
  returnTimer=window.setTimeout(returnToCustomHub,RETURN_DELAY_MS);
}

function handleScreenChange(){
  if(document.body.dataset.screen==='custom-result'){
    requestAnimationFrame(showWinPopup);
  }else if(showing){
    hidePopup();
  }
}

installStyles();
ensurePopup();
new MutationObserver(handleScreenChange).observe(document.body,{attributes:true,attributeFilter:['data-screen']});
handleScreenChange();
})();
