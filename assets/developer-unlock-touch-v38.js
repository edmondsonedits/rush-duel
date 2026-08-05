(()=>{
'use strict';
const id='developer-unlock-touch-v38-style';
if(document.getElementById(id))return;
const style=document.createElement('style');
style.id=id;
style.textContent='.title-screen .build-label{position:relative;z-index:8;pointer-events:auto!important;touch-action:manipulation!important;-webkit-user-select:none!important;user-select:none!important;-webkit-touch-callout:none!important;}';
document.head.appendChild(style);
})();
