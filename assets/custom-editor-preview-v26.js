(()=>{
'use strict';

const STYLE_ID='custom-editor-preview-v26-style';

function installStyle(){
  if(document.getElementById(STYLE_ID))return;
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
#customEditorScreen .custom-piece-picker{
  display:grid!important;
  grid-template-columns:repeat(2,minmax(0,1fr))!important;
  grid-template-areas:
    "preview preview"
    "previous next"!important;
  align-items:stretch!important;
  gap:9px!important;
  padding:10px!important;
  overflow:visible!important;
  border:2px solid rgba(92,236,255,.34)!important;
  border-radius:14px!important;
  background:
    radial-gradient(circle at 50% 30%,rgba(92,236,255,.10),transparent 58%),
    linear-gradient(180deg,#091827,#050d18)!important;
  box-shadow:inset 0 0 24px rgba(92,236,255,.045),0 0 15px rgba(92,236,255,.035)!important;
}
#customEditorScreen .custom-piece-picker .custom-piece-preview-card{
  grid-area:preview!important;
  width:100%!important;
  min-width:0!important;
  min-height:126px!important;
  display:grid!important;
  grid-template-columns:minmax(0,1fr) auto!important;
  grid-template-rows:auto minmax(88px,1fr)!important;
  align-items:center!important;
  justify-items:center!important;
  gap:3px 8px!important;
  padding:8px 10px 7px!important;
  overflow:visible!important;
  border:1px solid rgba(92,236,255,.28)!important;
  border-radius:11px!important;
  background:
    linear-gradient(180deg,rgba(18,45,66,.78),rgba(5,14,25,.92)),
    #07111e!important;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.05),inset 0 0 20px rgba(92,236,255,.04)!important;
}
#customEditorScreen .custom-piece-picker .custom-piece-preview-card>span{
  grid-column:1!important;
  grid-row:1!important;
  justify-self:start!important;
  color:#9fb5cb!important;
  font-size:8px!important;
  font-weight:900!important;
  letter-spacing:.16em!important;
  text-transform:uppercase!important;
}
#customEditorScreen .custom-piece-picker .custom-piece-preview-card>b{
  grid-column:2!important;
  grid-row:1!important;
  justify-self:end!important;
  min-width:28px!important;
  padding:3px 8px!important;
  border:1px solid rgba(255,227,109,.48)!important;
  border-radius:999px!important;
  color:#ffe36d!important;
  background:rgba(255,227,109,.07)!important;
  font-size:14px!important;
  line-height:1!important;
  text-align:center!important;
  text-shadow:0 0 9px rgba(255,227,109,.28)!important;
}
#customEditorScreen #customPieceCanvas{
  grid-column:1/-1!important;
  grid-row:2!important;
  display:block!important;
  width:min(176px,100%)!important;
  height:auto!important;
  max-height:none!important;
  margin:0 auto!important;
  image-rendering:pixelated!important;
  transform:translateZ(0)!important;
  filter:drop-shadow(0 0 7px rgba(92,236,255,.42)) drop-shadow(0 5px 8px rgba(0,0,0,.55))!important;
}
#customEditorScreen #customPrevPiece,
#customEditorScreen #customNextPiece{
  width:100%!important;
  min-width:0!important;
  height:50px!important;
  min-height:50px!important;
  display:flex!important;
  align-items:center!important;
  justify-content:center!important;
  gap:8px!important;
  padding:5px 8px!important;
  border:2px solid #477995!important;
  border-radius:10px!important;
  color:#effcff!important;
  background:linear-gradient(180deg,#173a54,#0b2234)!important;
  font-size:22px!important;
  font-weight:1000!important;
  line-height:1!important;
  box-shadow:0 3px 0 rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.09)!important;
}
#customEditorScreen #customPrevPiece{grid-area:previous!important;}
#customEditorScreen #customNextPiece{grid-area:next!important;}
#customEditorScreen #customPrevPiece small,
#customEditorScreen #customNextPiece small{
  display:block!important;
  color:#a9bdd1!important;
  font-size:7px!important;
  font-weight:900!important;
  letter-spacing:.06em!important;
  text-transform:uppercase!important;
}
#customEditorScreen #customPrevPiece:active,
#customEditorScreen #customNextPiece:active{
  transform:translateY(2px)!important;
  filter:brightness(1.18)!important;
  box-shadow:0 1px 0 rgba(0,0,0,.75)!important;
}
@media (max-width:520px) and (orientation:portrait){
  #customEditorScreen .custom-piece-picker{padding:8px!important;gap:7px!important;}
  #customEditorScreen .custom-piece-picker .custom-piece-preview-card{min-height:116px!important;padding:7px 8px 5px!important;}
  #customEditorScreen #customPieceCanvas{width:min(164px,100%)!important;}
  #customEditorScreen #customPrevPiece,
  #customEditorScreen #customNextPiece{height:46px!important;min-height:46px!important;font-size:20px!important;}
}
`;
  document.head.appendChild(style);
}

function upgradePicker(){
  const picker=document.querySelector('#customEditorScreen .custom-piece-picker');
  if(!picker||picker.dataset.previewV26==='1')return false;
  const preview=picker.querySelector(':scope > div');
  const previous=document.getElementById('customPrevPiece');
  const next=document.getElementById('customNextPiece');
  const label=preview?.querySelector('span');
  if(!preview||!previous||!next)return false;

  preview.classList.add('custom-piece-preview-card');
  picker.prepend(preview);
  if(label)label.textContent='Current Block';
  previous.innerHTML='<span aria-hidden="true">◀</span><small>Previous</small>';
  next.innerHTML='<span aria-hidden="true">▶</span><small>Next</small>';
  previous.type='button';
  next.type='button';
  picker.dataset.previewV26='1';
  return true;
}

installStyle();
if(!upgradePicker()){
  const observer=new MutationObserver(()=>{if(upgradePicker())observer.disconnect();});
  observer.observe(document.documentElement,{childList:true,subtree:true});
}
})();
