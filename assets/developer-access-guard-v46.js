(()=>{
'use strict';

const DEV_FLAG='rush-duel-developer-mode-v38';
const SESSION_AUTH='rush-duel-developer-auth-v46';
const STYLE_ID='developer-access-guard-v47-style';
let cleanupObserver=null;
let cleanupScheduled=false;

function authenticated(){
  return sessionStorage.getItem(SESSION_AUTH)==='1'&&localStorage.getItem(DEV_FLAG)==='1';
}

// Developer access from an older browser session must not carry into a fresh
// tab. The title-screen password flow sets both values before reloading.
if(sessionStorage.getItem(SESSION_AUTH)!=='1')localStorage.removeItem(DEV_FLAG);

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
  cleanupScheduled=false;
  if(authenticated())return;
  if(document.body.classList.contains('dev-mode-enabled'))document.body.classList.remove('dev-mode-enabled');
  document.getElementById('developerModeButton')?.remove();
  document.getElementById('developerToolsScreen')?.remove();
  document.querySelectorAll('.developer-level-edit').forEach(button=>button.remove());
  document.querySelectorAll('.challenge-level-card.developer-unlocked').forEach(card=>card.classList.remove('developer-unlocked'));

  if(document.body.dataset.screen==='developer-tools'){
    document.body.dataset.screen='mode';
    document.querySelectorAll('[data-screen-panel]').forEach(panel=>{
      const shouldBeActive=panel.dataset.screenPanel==='mode';
      if(panel.classList.contains('active')!==shouldBeActive)panel.classList.toggle('active',shouldBeActive);
    });
  }
}

function scheduleCleanup(){
  if(cleanupScheduled)return;
  cleanupScheduled=true;
  requestAnimationFrame(removeUnauthorizedDeveloperUI);
}

removeUnauthorizedDeveloperUI();

// Developer modules load immediately after this guard. Watch only the app's
// startup insertions long enough to remove unauthorized developer elements,
// then disconnect permanently. The old guard watched the entire document for
// the whole session, adding unnecessary work to every UI update.
if(!authenticated()){
  const app=document.getElementById('app');
  if(app){
    cleanupObserver=new MutationObserver(scheduleCleanup);
    cleanupObserver.observe(app,{childList:true,subtree:true});
    setTimeout(()=>{
      removeUnauthorizedDeveloperUI();
      cleanupObserver?.disconnect();
      cleanupObserver=null;
    },4000);
  }
}

window.__RUSH_DEVELOPER_AUTH={
  sessionKey:SESSION_AUTH,
  isAuthenticated:authenticated,
  revoke(){
    sessionStorage.removeItem(SESSION_AUTH);
    localStorage.removeItem(DEV_FLAG);
    removeUnauthorizedDeveloperUI();
  }
};

document.addEventListener('click',event=>{
  const button=event.target instanceof Element?event.target.closest('#developerDisable'):null;
  if(button)sessionStorage.removeItem(SESSION_AUTH);
},true);
})();
