(()=>{
'use strict';

const DEV_FLAG='rush-duel-developer-mode-v38';
const SESSION_AUTH='rush-duel-developer-auth-v46';
const STYLE_ID='developer-access-guard-v46-style';

function authenticated(){
  return sessionStorage.getItem(SESSION_AUTH)==='1'&&localStorage.getItem(DEV_FLAG)==='1';
}

// Developer access from an older browser session must never carry into a fresh
// tab. The title-screen password flow sets both values before reloading.
if(sessionStorage.getItem(SESSION_AUTH)!=='1'){
  localStorage.removeItem(DEV_FLAG);
}

if(!document.getElementById(STYLE_ID)){
  const style=document.createElement('style');
  style.id=STYLE_ID;
  style.textContent=`
body:not(.dev-mode-enabled) #developerModeButton,
body:not(.dev-mode-enabled) #developerToolsScreen,
body:not(.dev-mode-enabled) .developer-level-edit{
  display:none!important;
  visibility:hidden!important;
  pointer-events:none!important;
}
`;
  document.head.appendChild(style);
}

function removeUnauthorizedDeveloperUI(){
  if(authenticated())return;
  document.body.classList.remove('dev-mode-enabled');
  document.getElementById('developerModeButton')?.remove();
  document.getElementById('developerToolsScreen')?.remove();
  document.querySelectorAll('.developer-level-edit').forEach(button=>button.remove());
  document.querySelectorAll('.challenge-level-card.developer-unlocked').forEach(card=>card.classList.remove('developer-unlocked'));
  if(document.body.dataset.screen==='developer-tools'){
    document.body.dataset.screen='mode';
    document.querySelectorAll('[data-screen-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.screenPanel==='mode'));
  }
}

const observer=new MutationObserver(removeUnauthorizedDeveloperUI);
observer.observe(document.documentElement,{childList:true,subtree:true,attributes:true,attributeFilter:['class','data-screen']});

window.__RUSH_DEVELOPER_AUTH={
  sessionKey:SESSION_AUTH,
  isAuthenticated:authenticated,
  revoke(){
    sessionStorage.removeItem(SESSION_AUTH);
    localStorage.removeItem(DEV_FLAG);
    removeUnauthorizedDeveloperUI();
  }
};

// The existing Disable Developer Mode control removes the old local flag. Also
// revoke the session credential so a reload cannot restore access.
document.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('#developerDisable'):null;
  if(!button)return;
  sessionStorage.removeItem(SESSION_AUTH);
},true);

removeUnauthorizedDeveloperUI();
})();
