(() => {
const $=id=>document.getElementById(id);
let orbDelayTimer=null,lastSkyStage=null;
const MOON_POSES={hiddenRight:{transform:'translate(96px,170px) scale(.8)',opacity:'0'},visible:{transform:'translate(-3px,-11px) scale(.96)',opacity:'1'},hiddenUp:{transform:'translate(-92px,-108px) scale(.82)',opacity:'0'}};
function setMoonPose(name,immediate=false){const moon=$('skyMoon'); if(!moon)return; if(immediate){const prev=moon.style.transition; moon.style.transition='none'; moon.style.transform=MOON_POSES[name].transform; moon.style.opacity=MOON_POSES[name].opacity; moon.getBoundingClientRect(); moon.style.transition=prev||'';} else {moon.style.transform=MOON_POSES[name].transform; moon.style.opacity=MOON_POSES[name].opacity;}}
/* One continuously interpolated sky: no stacked rectangles, hard edges or
   snapped CSS gradients. Every new transition starts at the CURRENT displayed
   colours, including rapid reversals and skipped stages. */
const SKY_PALETTES=[
 [[98,63,88],[126,79,95],[157,101,102]],
 [[18,37,61],[28,55,84],[41,69,102]],
 [[37,52,76],[66,83,107],[90,101,128]],
 [[86,154,166],[119,175,164],[161,191,163]]
];
let skyCurrent=SKY_PALETTES[1].map(c=>c.slice()),skyAnimation=null,skyFrame=0;
const skyCanvas=$('skyCanvas');
function paintSky(){
 if(!skyCanvas)return;
 const bounds=skyCanvas.getBoundingClientRect();
 if(!bounds.width||!bounds.height)return;
 const scale=Math.min(window.devicePixelRatio||1,2);
 const w=Math.max(1,Math.round(bounds.width*scale)),h=Math.max(1,Math.round(bounds.height*scale));
 if(skyCanvas.width!==w||skyCanvas.height!==h){skyCanvas.width=w;skyCanvas.height=h;}
 const ctx=skyCanvas.getContext('2d');if(!ctx)return;
 const gradient=ctx.createLinearGradient(0,0,0,h);
 skyCurrent.forEach((rgb,i)=>gradient.addColorStop(i/2,`rgb(${rgb.map(Math.round).join(',')})`));
 ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
}
function transitionSky(to,initial=false){
 if(skyFrame){cancelAnimationFrame(skyFrame);skyFrame=0;}
 if(initial){skyAnimation=null;skyCurrent=SKY_PALETTES[to].map(c=>c.slice());paintSky();return;}
 const from=skyCurrent.map(c=>c.slice());const dest=SKY_PALETTES[to],duration=5200;
 const start=performance.now();
 const reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 if(reduce){skyCurrent=dest.map(c=>c.slice());paintSky();return;}
 function frame(now){
  const t=Math.min(1,(now-start)/duration);const eased=t*t*(3-2*t);
  skyCurrent=from.map((rgb,i)=>rgb.map((v,j)=>v+(dest[i][j]-v)*eased));
  paintSky();
  if(t<1)skyFrame=requestAnimationFrame(frame);else skyFrame=0;
 }
 skyFrame=requestAnimationFrame(frame);
}
window.addEventListener('resize',paintSky);
/* Begin the sky movement immediately; let the orbs follow after a short beat.
   Cancel stale delayed actions on repeated/multi-stage jumps. */
function applySkyVisuals(from,to,initial=false){
 const device=document.querySelector('.device');
 if(orbDelayTimer!==null){clearTimeout(orbDelayTimer);orbDelayTimer=null;}
 transitionSky(to,initial);
 if(device)device.dataset.sky=String(to);
 if(initial||from===null||from===undefined){
   if(device)device.dataset.orbs=String(to);
   setMoonPose(to===2?'visible':to===3?'hiddenUp':'hiddenRight',true);
   return;
 }
 if(from===to)return;
 orbDelayTimer=setTimeout(()=>{
   orbDelayTimer=null;
   if(device)device.dataset.orbs=String(to);
   // A moon that is currently visible always continues upwards on its way out.
   // Entry from Dawn comes from above, all other entries arc from lower right.
   if(to===2){
     if(from!==2){
       const moon=$('skyMoon');
       if(moon && getComputedStyle(moon).opacity < .025)
         setMoonPose(from===3?'hiddenUp':'hiddenRight',true);
     }
     requestAnimationFrame(()=>setMoonPose('visible'));
   }else if(from===2){
     setMoonPose('hiddenUp');
   }else{
     setMoonPose(to===3?'hiddenUp':'hiddenRight');
   }
 },650);
}

window.updatePadSky=to=>{if(to!==lastSkyStage){applySkyVisuals(lastSkyStage,to,lastSkyStage===null);lastSkyStage=to;}};
window.updatePadSky(stage);
})();
