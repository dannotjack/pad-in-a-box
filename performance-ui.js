(()=>{
 const $=id=>document.getElementById(id),dialog=$('helpDialog'),opener=$('openHelp'),home=$('helpHome'),back=$('helpBack'),guide=$('controlGuide');let exploring=false,selected=null;
 const sections=[...document.querySelectorAll('.help-section')];
 function showHome(){sections.forEach(s=>s.hidden=true);home.hidden=false;back.hidden=true;$('helpTitle').textContent='Help';dialog.scrollTop=0;}
 opener.onclick=()=>{showHome();dialog.showModal();};
 $('closeHelp').onclick=()=>dialog.close();back.onclick=()=>{showHome();home.querySelector('button').focus();};
 dialog.addEventListener('close',()=>{if(!exploring)opener.focus();});
 dialog.querySelectorAll('[data-section]').forEach(b=>b.onclick=()=>{home.hidden=true;back.hidden=false;sections.forEach((s,i)=>s.hidden=i!==Number(b.dataset.section));const s=sections[Number(b.dataset.section)];$('helpTitle').textContent=b.textContent;dialog.scrollTop=0;s.querySelector('h2').focus();});
 $('helpVersion').textContent=document.querySelector('.meta')?.textContent.split('/')[0].trim()||'Current release';
 const hints=new Map();function add(selector,text){document.querySelectorAll(selector).forEach(el=>hints.set(el,text));}
 add('#play','Start or stop audio. Your key and atmosphere stay selected.');add('#keyboard','Choose the root note for your song. This keyboard transposes the music.');add('#stagebar','Choose Dusk, Midnight, Moonlight or Dawn. The last selection takes effect after a brief pause.');add('.stepper','Move backwards or forwards through the four atmospheres.');
 ['Fade controls how gradually outgoing sounds fade.','Movement adds drift and variation to the pad.','Tone shapes the brightness of the whole mix.','Volume sets the overall output level.'].forEach((t,i)=>{const el=document.querySelectorAll('.knob')[i];if(el)hints.set(el,t);});
 add('#stageTitle','Your current atmosphere.');add('#rootText','Your selected root note.');add('.status-strip','Playback status, queued changes and audio messages appear here.');add('.wave','The waveform follows the sound.');
 function exit(){exploring=false;guide.hidden=true;document.body.classList.remove('exploring');hints.forEach((_,el)=>{el.classList.remove('guide-target','guide-selected');if(el.dataset.guideTab==='added'){el.removeAttribute('tabindex');delete el.dataset.guideTab;}});selected=null;opener.focus();window.dispatchEvent(new Event('resize'));}
 $('exitGuide').onclick=exit;
 $('exploreControls').onclick=()=>{exploring=true;dialog.close();guide.hidden=false;document.body.classList.add('exploring');hints.forEach((_,el)=>{el.classList.add('guide-target');if(!el.matches('button,[tabindex]')){el.tabIndex=0;el.dataset.guideTab='added';}});$('exitGuide').focus();};
 function explain(el){if(selected)selected.classList.remove('guide-selected');selected=el;el.classList.add('guide-selected');$('guideHint').textContent=hints.get(el);guide.classList.toggle('guide-top',el.getBoundingClientRect().top>innerHeight/2);}
 function intercept(e){if(!exploring)return;if(e.type==='keydown'&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();exit();return;}if(guide.contains(e.target))return;const el=[...hints.keys()].find(el=>el===e.target||el.contains(e.target));if(e.type==='keydown'&&e.key==='Tab')return;
 if(el||e.type==='keydown'){e.preventDefault();e.stopImmediatePropagation();if(el&&(e.type==='click'||e.type==='pointerdown'||(e.type==='keydown'&&['Enter',' '].includes(e.key))))explain(el);}}
 ['pointerdown','pointermove','pointerup','click','dblclick','wheel','keydown'].forEach(type=>document.addEventListener(type,intercept,{capture:true,passive:false}));
 const play=$('play'),display=$('display');
 function sync(){const text=play.textContent;const active=text.includes('STOP');display.classList.toggle('audio-active',active);display.classList.toggle('audio-loading',play.disabled);play.setAttribute('aria-label',play.disabled?'Loading audio':active?'Stop audio':'Start audio');play.setAttribute('aria-pressed',String(active));$('displayStatus').textContent=$('alert').textContent||$('pending').textContent||$('status').textContent;}
 const observer=new MutationObserver(sync);[play,$('status'),$('pending'),$('alert')].forEach(el=>observer.observe(el,{childList:true,characterData:true,subtree:true,attributes:el===play,attributeFilter:el===play?['disabled']:undefined}));sync();
})();
