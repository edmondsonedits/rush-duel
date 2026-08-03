/* Tetris Duel V16 mobile gameplay patch.
   This file is intentionally loaded after the existing application scripts so
   it can refine the compact renderer without disturbing desktop gameplay. */
(function installMobileGameplayV16(){
  const originalGetView=getView;
  const originalDrawRail=drawRail;
  const originalUpdateHud=updateHud;

  /* Slightly shorten the phone board and move it upward. This leaves a visible
     safety margin beneath row twenty, even with the larger controls enabled. */
  getView=function(){
    if(!compactView)return originalGetView();
    return {
      compact:true,
      classic:game.mode==='classic',
      local:game.mode==='classic'?{x:12,y:16,cell:28}:{x:4,y:16,cell:28},
      rival:{x:330,y:116,cell:7.6},
      railX:371
    };
  };

  /* Reorganize the compact right rail around the new Back / Sound / Level
     panel. Desktop and landscape layouts continue using the original rail. */
  drawRail=function(view,local,rival,guest,now,pct,timerDisplay){
    if(!view.compact)return originalDrawRail(view,local,rival,guest,now,pct,timerDisplay);

    const x=view.railX;
    if(game.mode==='classic'){
      text('NEXT',x,114,12,'#ffe36d','center');
      game.queue.slice(0,3).forEach((shape,index)=>miniPiece(shape,x,150+index*55,9.5,.95));
      text('SCORE',x,321,11,'#9aa8c2','center');
      text(local.score.toLocaleString(),x,344,18,'#fff','center');
      text(`${local.lines} LINES`,x,388,12,'#55e7ff','center');
      text(`BEST ${local.bestCombo}`,x,425,9,'#ff9ed2','center');
      text(`TETRIS ${local.tetrises}`,x,452,9,'#ffe36d','center');
      return;
    }

    const rushSide=guest?'rival':'player';
    const rushLeft=game.rushRemaining(rushSide,now);
    text(game.mode==='bot'?'BOT BOARD':'RIVAL',x,103,9,'#ff82bf','center');
    text('NEXT',x,282,12,'#ffe36d','center');
    miniPiece(game.queue[0],x,317,13,1);
    text('AFTER',x,355,9,'#91a0bb','center');
    game.queue.slice(1,3).forEach((shape,index)=>miniPiece(shape,340+index*50,385,7.5,.9));

    const barY=418,barX=312,barW=104;
    ctx.fillStyle='#111827';
    ctx.fillRect(barX,barY,barW,12);
    ctx.fillStyle=pct>.55?'#63f59b':pct>.25?'#ffd45a':'#ff5a6e';
    ctx.fillRect(barX+2,barY+2,(barW-4)*pct,8);
    text(timerDisplay,x,437,15,'#fff','center');
    text(rushLeft?`RUSH ${Math.ceil(rushLeft/1000)}s`:'RUSH READY',x,468,10,rushLeft?'#ff9fbc':'#63f59b','center');
    text(`RUSH ${guest?game.rivalRushes:game.rushWins}-${guest?game.rushWins:game.rivalRushes}`,x,495,11,'#ffd45a','center');
    text(`ROUND ${Math.max(1,game.round)}`,x,522,10,'#aab6ce','center');
    text(`SPEED ${game.speed(now).toFixed(2)}×`,x,548,10,'#55e7ff','center');
  };

  function syncMobileSoundButton(){
    const button=$('mobileSoundButton');
    if(!button)return;
    const icon=button.querySelector('.mobile-tool-icon');
    const label=button.querySelector('.mobile-tool-label');
    if(icon)icon.textContent=soundEnabled?'🔊':'🔇';
    if(label)label.textContent=soundEnabled?'Sound':'Muted';
    button.setAttribute('aria-label',soundEnabled?'Mute game sound':'Turn game sound on');
    button.setAttribute('aria-pressed',String(!soundEnabled));
  }

  updateHud=function(...args){
    originalUpdateHud(...args);
    const level=$('mobileLevel');
    if(level)level.textContent=String(game.level);
    syncMobileSoundButton();
  };

  const mobileSound=$('mobileSoundButton');
  if(mobileSound){
    mobileSound.addEventListener('click',()=>{
      soundEnabled=!soundEnabled;
      syncMobileSoundButton();
      if(soundEnabled)playTone('move');
    });
  }

  const mobileExit=$('mobileExitButton');
  if(mobileExit)mobileExit.addEventListener('click',exitMatch);

  /* Keep the phone icon synchronized when sound is toggled from desktop or a
     wider layout using the original sound button. */
  const desktopSound=$('soundButton');
  if(desktopSound)desktopSound.addEventListener('click',()=>queueMicrotask(syncMobileSoundButton));

  syncMobileSoundButton();
})();
