(()=>{
'use strict';

const STYLE_ID='challenge-play-button-v34-style';

function installStyles(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
.challenge-level-play{
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  visibility:visible!important;
  opacity:1!important;
  position:relative!important;
  z-index:8!important;
  gap:5px;
  white-space:nowrap;
}
.challenge-level-play:not(:disabled){
  box-shadow:0 3px 0 #020812,0 0 13px rgba(89,223,255,.15),inset 0 1px 0 rgba(255,255,255,.2)!important;
}
.challenge-level-play:not(:disabled):active{
  transform:translateY(2px);
  box-shadow:0 1px 0 #020812!important;
}
@media(max-width:520px) and (orientation:portrait){
  .challenge-level-grid{
    grid-template-columns:1fr!important;
    gap:8px!important;
  }
  .challenge-level-card{
    display:grid!important;
    grid-template-columns:clamp(88px,29vw,116px) minmax(0,1fr)!important;
    grid-template-rows:auto minmax(28px,1fr) 38px!important;
    grid-template-areas:
      "preview heading"
      "preview details"
      "preview play"!important;
    min-height:142px!important;
    height:auto!important;
    padding:8px!important;
    gap:6px 9px!important;
    overflow:hidden!important;
  }
  .challenge-level-top{
    grid-area:heading!important;
    grid-column:auto!important;
    min-width:0;
  }
  .challenge-preview-wrap{
    grid-area:preview!important;
    grid-column:auto!important;
    grid-row:auto!important;
    width:100%!important;
    height:100%!important;
    min-height:124px!important;
  }
  .challenge-preview-wrap canvas{
    width:auto!important;
    height:min(122px,100%)!important;
    max-width:100%!important;
  }
  .challenge-level-details{
    grid-area:details!important;
    grid-column:auto!important;
    min-width:0;
    align-content:center;
  }
  .challenge-level-details p{display:none!important;}
  .challenge-level-play{
    grid-area:play!important;
    grid-column:auto!important;
    grid-row:auto!important;
    width:100%!important;
    min-height:36px!important;
    padding:4px 9px!important;
    border-radius:9px!important;
    font-size:10px!important;
    letter-spacing:.07em!important;
  }
  .challenge-level-play:not(:disabled){
    border-color:#72ebff!important;
    background:linear-gradient(180deg,#2380ba,#0b426e)!important;
  }
  .challenge-level-card.completed .challenge-level-play:not(:disabled){
    border-color:#75ffc0!important;
    background:linear-gradient(180deg,#219b6d,#0b563d)!important;
  }
  .challenge-level-play:disabled{
    border-color:#3d4e62!important;
    color:#718195!important;
    background:#101827!important;
  }
}
`;
  document.head.appendChild(style);
}

function labelFor(card,button){
  if(button.disabled||card.classList.contains('locked')){
    const number=Number(card.querySelector('.challenge-level-number')?.textContent)||1;
    return `🔒 Beat Level ${Math.max(1,number-1)}`;
  }
  return card.classList.contains('completed')?'↻ Replay Challenge':'▶ Play Challenge';
}

function ensurePlayButtons(){
  const grid=document.getElementById('challengeLevelGrid');
  if(!grid)return;
  grid.querySelectorAll('.challenge-level-card').forEach(card=>{
    const preview=card.querySelector('[data-challenge-preview]');
    const levelId=preview?.dataset.challengePreview;
    if(!levelId)return;
    let button=card.querySelector('.challenge-level-play');
    if(!button){
      button=document.createElement('button');
      button.type='button';
      button.className='challenge-level-play';
      button.dataset.levelId=levelId;
      button.disabled=card.classList.contains('locked');
      card.appendChild(button);
    }
    button.dataset.levelId=levelId;
    button.innerHTML=labelFor(card,button);
    button.setAttribute('aria-label',button.disabled?'Challenge locked':`${button.textContent.trim()}: ${card.querySelector('h2')?.textContent||'Challenge'}`);
  });
}

installStyles();
ensurePlayButtons();
new MutationObserver(ensurePlayButtons).observe(document.documentElement,{childList:true,subtree:true});
})();
