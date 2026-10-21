const mixNames={drone:'Drone / pad',piano:'Piano',cello:'Cello',organ:'Organ',violin:'Violin'};

function captureRecipe(){PadMix.recipe.globals={fade:opts[0].val,movement:opts[1].val,tone:opts[2].val,volume:opts[3].val,root,stage};return PadMix.clone(PadMix.recipe);}
function recipeChanged(){if(engine)engine.applyMix();draw();PadMix.save();if(document.activeElement!==$('recipeText'))$('recipeText').value=JSON.stringify(captureRecipe(),null,2);$('recipeStatus').textContent=PadMix.storageOK?'Saved in this browser. Copy the recipe or download JSON to send it to me.':'Automatic saving is unavailable. Copy or download your recipe to keep it.';}
function slider(parent,label,value,min,max,step,unit,change,kind="dial"){
 const id='mix-'+Math.random().toString(36).slice(2);const row=document.createElement('div');const l=document.createElement('label');l.className='sliderlabel';l.htmlFor=id;l.append(document.createTextNode(label));const out=document.createElement('output');l.append(out);const input=document.createElement('input');input.type='range';input.id=id;input.min=min;input.max=max;input.step=step;input.value=value;
 let gesture=false;const begin=()=>{if(!gesture){PadMix.checkpoint();gesture=true;}};input.onpointerdown=begin;input.onkeydown=begin;input.onchange=()=>gesture=false;input.onkeyup=()=>gesture=false;
 row.className='parameter '+kind;const face=document.createElement('span');face.className='dialface';face.setAttribute('aria-hidden','true');row.append(face);if(kind==='drawbar')input.setAttribute('aria-orientation','vertical');
 const display=()=>{out.textContent=Number(input.value)+(unit||'');row.style.setProperty('--rotation',(-135+270*(Number(input.value)-min)/(max-min))+'deg');};display();input.oninput=()=>{begin();display();change(Number(input.value));recipeChanged();};row.append(l,input);parent.append(row);if(kind==='dial'){let y=null,initial=0;face.onpointerdown=e=>{begin();y=e.clientY;initial=Number(input.value);face.setPointerCapture(e.pointerId);};face.onpointermove=e=>{if(y===null)return;input.value=Math.max(min,Math.min(max,Math.round((initial+(y-e.clientY)*(max-min)/140)/step)*step));input.oninput();};face.onpointerup=face.onpointercancel=()=>{y=null;gesture=false;};}
}
function renderMixer(){
 $('mixcards').replaceChildren();if($('ensembleMood'))$('ensembleMood').value=PadMix.recipe.ensemble.mood;
 for(const [key,title]of Object.entries(mixNames)){
  const r=PadMix.recipe.instruments[key],card=document.createElement('section');card.className='channel';
  card.innerHTML='<div class="channelhead"><h2>'+title+'</h2><div><button class="solo" aria-pressed="false">Solo</button> <button class="mute" aria-pressed="false">Mute</button></div></div>';
  const meter=document.createElement('output');meter.dataset.channelMeter=key;meter.className='meter';meter.textContent='— dBFS';card.append(meter);
  const solo=card.querySelector('.solo'),mute=card.querySelector('.mute');solo.setAttribute('aria-label','Solo '+title);mute.setAttribute('aria-label','Mute '+title);solo.setAttribute('aria-pressed',String(PadMix.solo===key));mute.setAttribute('aria-pressed',String(r.mute));
  solo.onclick=()=>{PadMix.solo=PadMix.solo===key?null:key;renderMixer();recipeChanged();};mute.onclick=()=>{PadMix.checkpoint();r.mute=!r.mute;mute.setAttribute('aria-pressed',String(r.mute));recipeChanged();};
  for(const [prop,label,min,max,step,unit]of [['level','Level',0,key==='cello'?100:150,1,'%'],['bass','Bass · 180 Hz',-12,12,.5,' dB'],['lowMid','Low mids · 210 Hz',-12,12,.5,' dB'],['treble','Presence · 2.2 kHz',-12,12,.5,' dB'],['cutoff','Brightness cutoff',120,12000,10,' Hz'],['space','Reverb send',0,60,1,'%']])slider(card,label,r[prop],min,max,step,unit,v=>r[prop]=v,prop==='level'?'fader':'dial');
  if(key==='drone')slider(card,'Rounded → saw texture',r.edge,0,100,1,'%',v=>r.edge=v);
  $('mixcards').append(card);
 }
 $('drawbars').replaceChildren();const labels=['16′ · body','8′ · fundamental','5⅓′ · fifth','4′ · octave','2⅔′ · fifth','2′ · brightness','1⅗′ · colour','1⅓′ · bite','1′ · air'];
 [0,2,1,3,4,5,6,7,8].forEach(i=>{const name=labels[i];slider($('drawbars'),name,PadMix.recipe.instruments.organ.drawbars[i],0,8,.01,'',v=>PadMix.recipe.instruments.organ.drawbars[i]=v,'drawbar');$('drawbars').lastElementChild.classList.add([0,2].includes(i)?'brown':[4,6,7].includes(i)?'black':'white');});
 $('recipeName').value=PadMix.recipe.name;$('recipeText').value=JSON.stringify(captureRecipe(),null,2);
}
function applyRecipe(r,remember=true){const valid=PadMix.validate(r);if(remember)PadMix.checkpoint();PadMix.recipe=valid;PadMix.solo=null;
 clearTimeout(stageTimer);clearTimeout(keyTimer);stageTimer=keyTimer=null;stage=target=valid.globals.stage;root=queuedRoot=valid.globals.root;
 ['fade','movement','tone','volume'].forEach((k,i)=>PadMix.knobUpdates[i](valid.globals[k]));
 if(engine){if(engine.root!==root)engine.changeRoot(root);if(engine.stage!==stage)engine.changeStage(stage);engine.changeOpts();engine.applyMix();}
 $('celloLevel').value=valid.instruments.cello.level;drawKeys();draw();renderMixer();recipeChanged();$('undoMix').disabled=!PadMix.history.length;
}
$('recipeName').onfocus=()=>PadMix.checkpoint();
$('recipeName').oninput=()=>{PadMix.recipe.name=$('recipeName').value;recipeChanged();};
$('audition').onchange=()=>{PadMix.auditionAll=$('audition').value==='all';if(engine){engine.auditionAll=PadMix.auditionAll;engine.changeStage(stage);engine.nextNote=engine.ctx.currentTime+.2;engine.orgNextSwell=engine.ctx.currentTime+.2;}recipeChanged();};
$('organLift').onclick=()=>{const r=captureRecipe();r.name='Organ lift';Object.assign(r.instruments.organ,{level:115,bass:-2,lowMid:-6,treble:4,cutoff:6500,drawbars:[.32,5.76,.5,4,2.4,4.2,2.8,2.2,1.6]});applyRecipe(r);$('recipeStatus').textContent='Organ lift applied: less low-mid weight, more upper harmonics. Undo restores your previous mix.';};
$('originalMix').onclick=()=>{applyRecipe(PadMix.clone(PadMix.defaults));};
$('undoMix').onclick=()=>{const r=PadMix.undo();if(r)applyRecipe(r,false);};
document.addEventListener('mixhistory',()=>{$('undoMix').disabled=!PadMix.history.length;});
$('copyRecipe').onclick=async()=>{const text=JSON.stringify(captureRecipe(),null,2);$('recipeText').value=text;try{await navigator.clipboard.writeText(text);$('recipeStatus').textContent='Recipe copied. Paste it into our chat.';}catch(e){$('recipeText').closest('details').open=true;$('recipeText').focus();$('recipeText').select();$('recipeStatus').textContent='Select and copy the recipe below, or use Download JSON.';}};
$('downloadRecipe').onclick=()=>{const r=captureRecipe(),blob=new Blob([JSON.stringify(r,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='Pad-in-a-Box-'+(r.name.replace(/[^a-z0-9]+/gi,'-').slice(0,60)||'mix')+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);$('recipeStatus').textContent='Recipe downloaded. Attach the JSON file in our chat.';};
function importText(text){try{if(text.length>100000)throw Error('Recipe is too large');applyRecipe(JSON.parse(text));$('recipeStatus').textContent='Recipe applied.';}catch(e){$('recipeStatus').textContent='Could not apply recipe: '+e.message;}}
$('importRecipe').onclick=()=>importText($('recipeText').value);
$('importFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;if(f.size>100000){$('recipeStatus').textContent='Recipe is too large.';return;}try{importText(await f.text());}catch(err){$('recipeStatus').textContent='Could not read recipe file.';}e.target.value='';};
renderMixer();recipeChanged();

$('audition').value='stage';
setInterval(()=>{if(!engine||!playing)return;for(const el of document.querySelectorAll('[data-channel-meter]')){const level=engine.readMeter(engine.tracks[el.dataset.channelMeter].meter);el.textContent=level.text;el.style.color=level.peak>=.95?'#a42e2e':'';}},100);
