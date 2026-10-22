(()=> {
 const controls=document.getElementById('controls'),device=document.querySelector('.device'),footer=document.querySelector('.performance-footer');
 if(!controls||!device||!footer)return;
 let frame;
 function fit(){
  const view=window.visualViewport;
  // Pinch zoom should not change which controls are available.
  if(view&&view.scale!==1)return;
  controls.hidden=false;
  const height=view?view.height:window.innerHeight;
  const bodyStyle=getComputedStyle(document.body),style=getComputedStyle(footer);
  const top=parseFloat(bodyStyle.paddingTop)||0;
  const fixed=style.position==='fixed';
  const needed=device.getBoundingClientRect().height+top+(fixed?footer.getBoundingClientRect().height+12:(parseFloat(bodyStyle.paddingBottom)||0));
  controls.hidden=needed>height;
 }
 function schedule(){cancelAnimationFrame(frame);frame=requestAnimationFrame(fit);}
 window.addEventListener('resize',schedule);
 window.visualViewport?.addEventListener('resize',schedule);
 document.fonts?.ready.then(schedule);
 schedule();
})();