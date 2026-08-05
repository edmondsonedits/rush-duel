(()=>{
'use strict';

const STYLE_ID='challenge-play-button-v36-style';

// V36 intentionally contains no MutationObserver. The previous observer rewrote
// button text after every DOM mutation, which could keep the browser's main thread
// busy and prevent touch events from reaching the main mode-selection buttons.
document.getElementById('challenge-play-button-v34-style')?.remove();
document.getElementById('challenge-play-button-v35-style')?.remove();

if(document.getElementById(STYLE_ID))return;
const style=document.createElement('style');
style.id=STYLE_ID;
style.textContent=`
/* Keep the original V33 challenge-card layout and reveal its existing button. */
.challenge-level-card{position:relative!important;}
.challenge-level-play{visibility:visible!important;opacity:1!important;z-index:8!important;}

@media(max-width:380px){
  .challenge-level-card:not(.locked){padding-bottom:48px!important;}
  .challenge-level-card:not(.locked) .challenge-level-play{
    position:absolute!important;
    left:104px!important;
    right:9px!important;
    bottom:9px!important;
    width:auto!important;
    min-height:36px!important;
    display:flex!important;
    align-items:center!important;
    justify-content:center!important;
    padding:5px 9px!important;
    border:2px solid #67e7ff!important;
    border-radius:9px!important;
    color:#fff!important;
    background:linear-gradient(180deg,#237eb6,#0b3e68)!important;
    box-shadow:0 3px 0 #020812,0 0 12px rgba(89,223,255,.14)!important;
    font-size:9px!important;
    font-weight:1000!important;
    letter-spacing:.06em!important;
    text-transform:uppercase!important;
    white-space:nowrap!important;
    pointer-events:auto!important;
    touch-action:manipulation!important;
  }
  .challenge-level-card.completed .challenge-level-play{
    border-color:#75ffc0!important;
    background:linear-gradient(180deg,#219b6d,#0b563d)!important;
  }
  .challenge-level-card.locked .challenge-level-play{display:none!important;}
  .challenge-level-card:not(.locked) .challenge-level-stats{padding-bottom:34px;}
}
`;
document.head.appendChild(style);
})();
