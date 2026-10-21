
'use strict';
const NAMES=['DUSK','MIDNIGHT','MOONLIGHT','DAWN'],COLORS=['#d96e68','#658ac7','#e5bd56','#78a781'],DESCS=['PAD + GENERATIVE PIANO','QUIET DRONE · PAD ONLY','PAD + EXPRESSIVE STRINGS','PAD + STRINGS + ROTARY ORGAN'];
const REGISTER = n => n >= 6 ? n - 12 : n; // F♯–B fold into the lower octave
// Track gain envelopes so interrupted fades also work without cancelAndHoldAtTime.
const envelopes=new WeakMap();
function fadeParam(p,to,now,duration,shape='linear'){
 const old=envelopes.get(p);let from=p.value;
 if(old){if(old.retune&&now>=old.retune){from=Math.max(0,Math.min(1,(now-old.retune)/(old.end-old.retune)));}else{const f=Math.max(0,Math.min(1,(now-old.at)/old.duration)),progress=old.shape==='release'?1-Math.cos(f*Math.PI/2):f;from=old.from+(old.to-old.from)*progress;}}
 // Explicit anchors keep interrupted ramps continuous, including Safari's fallback.
 p.cancelScheduledValues(now);p.setValueAtTime(from,now);
 duration=Math.max(.02,duration);
 if(shape==='release'){for(let i=1;i<=32;i++){const f=i/32;p.linearRampToValueAtTime(to+(from-to)*Math.cos(f*Math.PI/2),now+duration*f);}p.setValueAtTime(to,now+duration);}
 else p.linearRampToValueAtTime(to,now+duration);
 envelopes.set(p,{from,to,at:now,duration,shape});
}
const NOTES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
let stage=1,target=1,stageTimer=null,root=2,queuedRoot=2,keyTimer=null,playing=false,engine=null;
const $=id=>document.getElementById(id);
const opts=[{name:'FADE',min:1,max:20,val:8,unit:' s',color:COLORS[0]},{name:'MOVEMENT',min:0,max:100,val:35,unit:'%',color:COLORS[1]},{name:'TONE',min:0,max:100,val:50,unit:'%',color:COLORS[2]},{name:'VOLUME',min:0,max:100,val:55,unit:'%',color:COLORS[3]}];
if(window.PadMix){const g=PadMix.recipe.globals;stage=target=g.stage;root=queuedRoot=g.root;opts.forEach((o,i)=>o.val=g[['fade','movement','tone','volume'][i]]);}
function hz(midi){return 440*Math.pow(2,(midi-69)/12)}
function toneHz(value){return 180*Math.pow(20000/180,value/100)}
function rng(a,b){return a+Math.random()*(b-a)}
class Sound{
 constructor(){
  const c=this.ctx=new (window.AudioContext||window.webkitAudioContext)();
  this.out=c.createGain();this.out.gain.value=0;
  this.limiter=c.createDynamicsCompressor();Object.assign(this.limiter.threshold,{value:-24});this.limiter.knee.value=12;this.limiter.ratio.value=6;this.limiter.attack.value=.012;this.limiter.release.value=.33;
  this.masterLP=c.createBiquadFilter();this.masterLP.type='lowpass';this.masterLP.Q.value=.707;this.masterLP.frequency.value=toneHz(opts[2].val);this.out.connect(this.masterLP).connect(this.limiter).connect(c.destination);this.outputMeter=this.makeMeter(this.limiter);this.pianoVoices=new Set();this.keyChange=null;this.audioRoot=root;
  this.padBus=c.createGain();this.padBus.gain.value=.75;
  this.organBus=c.createGain();this.organBus.gain.value=0;
  this.pianoBus=c.createGain();this.pianoBus.gain.value=0;
  this.convolver=c.createConvolver();this.convolver.buffer=this.makeImpulse(4.2,1.1);this.convolver.connect(this.out);
  this.makeMixer();
  this.planes=[[0,7,12,19]]; // Tonic and fifth, in open octaves. No automatic chord changes.
  this.airports=[[5,7,4,2,0,12,7,5,7,4,2,0],[5,7,4,2,0,12,4,7,5,0],[-5,2,0,4,7,12,5,2,7,4,0,7,2,5,5,2,4,0],[7,7,2,4,4,4,2,0,7,0,0]];
  this.pianoSeq=this.airports;this.lastPhrase=-1;this.lastPlane=-1;this.sequence=this.airports[0];this.seqIdx=0;
  this.nextChord=0;this.chordTransitionUntil=0;this.nextChordApply=0;this.pendingChord=null;this.nextPhrase=0;this.nextRate=0;this.nextNote=0;this.rate=.125;
  this.movement=opts[1].val/100;this.voices=[];this.ringing=[];this.subs=[];this.timer=null;this.soundStart=c.currentTime;
  this.makePad();this.makeOrgan();this.changeRoot(root,true);this.changeStage(stage,true);this.changeOpts();
 }
 makeMeter(source){
  const c=this.ctx,split=c.createChannelSplitter(2),channels=[c.createAnalyser(),c.createAnalyser()];source.connect(split);channels.forEach((a,i)=>{a.fftSize=2048;split.connect(a,i);});return {channels,buffers:[new Float32Array(2048),new Float32Array(2048)]};
 }
 readMeter(m){let peak=0;for(let i=0;i<2;i++){m.channels[i].getFloatTimeDomainData(m.buffers[i]);for(const v of m.buffers[i])peak=Math.max(peak,Math.abs(v));}return {peak,text:peak>0.00001?(20*Math.log10(peak)).toFixed(1)+' dBFS':'— dBFS'};}
 makeMixer(){
  const c=this.ctx;this.auditionAll=PadMix.auditionAll;this.tracks={};
  for(const k of ['drone','piano','cello','organ','violin']){
   const input=c.createGain(),keyGate=c.createGain(),level=c.createGain(),hp=c.createBiquadFilter(),bass=c.createBiquadFilter(),mid=c.createBiquadFilter(),treble=c.createBiquadFilter(),lp=c.createBiquadFilter(),dry=c.createGain(),wet=c.createGain();
   hp.type='highpass';hp.frequency.value=k==='cello'?35:k==='violin'?200:100;hp.Q.value=.5;
   bass.type='lowshelf';bass.frequency.value=180;mid.type='peaking';mid.frequency.value=210;mid.Q.value=.8;treble.type='highshelf';treble.frequency.value=2200;lp.type='lowpass';lp.Q.value=.5;
   dry.gain.value=k==='cello'?.85:.57;
   input.connect(keyGate).connect(level).connect(hp).connect(bass).connect(mid).connect(treble).connect(lp);const lp2=(k==='cello'||k==='violin')?c.createBiquadFilter():null;if(lp2){lp.Q.value=.5411961;lp2.type='lowpass';lp2.Q.value=1.306563;lp.connect(lp2);}const end=lp2||lp,meter=this.makeMeter(end);end.connect(dry).connect(this.out);end.connect(wet).connect(this.convolver);
   this.tracks[k]={input,keyGate,meter,level,hp,bass,mid,treble,lp,lp2,wet};
  }
  this.padBus.connect(this.tracks.drone.input);this.pianoBus.connect(this.tracks.piano.input);this.organBus.connect(this.tracks.organ.input);
 }
 applyMix(){
  if(!this.tracks)return;const t=this.ctx.currentTime,r=PadMix.recipe.instruments;
  for(const k of Object.keys(this.tracks)){const a=this.tracks[k],v=r[k],audible=!v.mute&&(!PadMix.solo||PadMix.solo===k);
   a.level.gain.setTargetAtTime(audible?(k==='cello'?1:k==='violin'?v.level/100*.5:v.level/100):0,t,.08);
   a.bass.gain.setTargetAtTime(v.bass,t,.12);a.mid.gain.setTargetAtTime(v.lowMid,t,.12);a.treble.gain.setTargetAtTime(v.treble,t,.12);
   a.hp.frequency.setTargetAtTime(v.highpass,t,.15);a.lp.frequency.setTargetAtTime(v.cutoff,t,.15);if(a.lp2)a.lp2.frequency.setTargetAtTime(v.cutoff,t,.15);a.wet.gain.setTargetAtTime(v.space/100,t,.12);
  }
  if(this.celloMix)this.celloMix.gain.setTargetAtTime(r.cello.level/100*.22,t,.08);
  if(this.orgCabinet)this.orgCabinet.frequency.setTargetAtTime(Math.max(3600,r.organ.cutoff),t,.12);
  if(this.drawbarAmps)this.drawbarAmps.forEach((group,i)=>group.forEach(a=>a.setTargetAtTime(r.organ.drawbars[i]/8,t,.12)));
  if(this.voices)this.voices.forEach(v=>{if(v.rounded){v.rounded.gain.setTargetAtTime(1-r.drone.edge/100,t,.15);v.edgy.gain.setTargetAtTime(r.drone.edge/100,t,.15);}});
 }
 makeImpulse(seconds,decay){let c=this.ctx,n=Math.floor(c.sampleRate*seconds),b=c.createBuffer(2,n,c.sampleRate);
  for(let channel=0;channel<2;channel++){let a=b.getChannelData(channel),smooth=0;for(let i=0;i<n;i++){smooth=.43*smooth+.57*(Math.random()*2-1);let envelope=Math.pow(1-i/n,2.5)*Math.exp(-i/(c.sampleRate*decay));a[i]=smooth*envelope*.38;}b.copyToChannel(a,channel);}return b;}
 async makeCello(){
  if(this.celloNode)return;
  if(!window.isSecureContext||!window.AudioWorkletNode)throw Error('The cello needs a modern HTTPS browser.');
  const c=this.ctx;
  if(!Sound.celloModule){const r=await fetch('cello.wasm?v=1.7.2');if(!r.ok)throw Error('Cello engine could not load');Sound.celloModule=await WebAssembly.compile(await r.arrayBuffer());}
  if(!this.celloWorkletLoaded){await c.audioWorklet.addModule('cello-worklet.js?v=1.7');this.celloWorkletLoaded=true;}
  const node=new AudioWorkletNode(c,'integrated-cello',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2],processorOptions:{module:Sound.celloModule}});
  this.celloBus=c.createGain();this.celloBus.gain.value=0;
  this.celloMix=c.createGain();this.celloMix.gain.value=PadMix.recipe.instruments.cello.level/100*.22;
  node.connect(this.celloBus).connect(this.celloMix).connect(this.tracks.cello.input);
  this.celloNode=node;this.applyMix();if($('stringMode')){node.port.postMessage({type:'expression',pace:Number($('stringPace').value)/100,variety:Number($('stringVariety').value)/100});node.port.postMessage({type:'spirit',index:Number($('stringMode').value)});}
  node.port.onmessage=({data})=>{if(data.resting)$('celloPhrase').textContent='RESTING';if(data.error||data.faults){$('alert').textContent='Cello engine issue: '+(data.error||'unstable voice reset');}if(playing&&(this.stage>=2||this.auditionAll))$('celloPhrase').textContent=data.spirit?data.spirit.toUpperCase()+(data.phraseRest?' · SILENCE':''):data.degree&&data.degree!==1?'DEGREE '+data.degree+' → 1':data.pulse?'PULSE '+data.pulse+' / 4':'SUSTAIN';};
  node.onprocessorerror=()=>{this.celloBus.gain.setTargetAtTime(0,c.currentTime,.05);$('alert').textContent='Cello engine stopped. Reload this test to retry.';};
 }
 makePad(){let c=this.ctx;this.planeBus=c.createGain();this.planeBus.gain.value=0;this.planeBus.connect(this.padBus);
  this.padWarm=c.createGain();this.padWarm.gain.value=.19;this.padWarm.connect(this.padBus);this.subMaster=c.createGain();this.subMaster.connect(this.padWarm);
  // Two slow, sub-octave sine oscillators, corresponding to the SuperCollider foundation.
  [-24,-12].forEach((interval,i)=>{let o=c.createOscillator(),gain=c.createGain(),lfo=c.createOscillator(),depth=c.createGain();o.type='sine';o.frequency.value=hz(60+REGISTER(root)+interval);gain.gain.value=.012/(i+1);lfo.type='sine';lfo.frequency.value=rng(.001,.01);depth.gain.value=i===0?.032:.014;lfo.connect(depth).connect(gain.gain);o.connect(gain).connect(this.subMaster);o.start();lfo.start();this.subs.push({o,interval});});
  // The tonal centre remains locked. Organic motion comes from filters, stereo, and detuning rather than new chords.
  this.bed=[];
  // Rounded, slightly irregular wavetable: reduced upper partials compared with sawtooth.
  // Keep slow independent spectral / pitch motion as in the Norns planes.
  const harmonics=24, real=new Float32Array(harmonics+1), imag=new Float32Array(harmonics+1);
  for(let h=1;h<=harmonics;h++) imag[h]=Math.pow(h,-1.75)*(h%2?1:-.8);
  const organicWave=c.createPeriodicWave(real,imag,{disableNormalization:false});
  for(let i=0;i<8;i++){let osc=c.createOscillator();osc.setPeriodicWave(organicWave);osc.detune.value=rng(-3.5,3.5);let filter=c.createBiquadFilter();filter.type='lowpass';filter.Q.value=.38;
   let delay=c.createDelay(.05);delay.delayTime.value=rng(.002,.006);let pan=c.createStereoPanner?c.createStereoPanner():c.createGain();let gain=c.createGain();gain.gain.value=.021;
   const rounded=c.createGain(),edgy=c.createGain(),saw=c.createOscillator();rounded.gain.value=1;edgy.gain.value=0;saw.type='sawtooth';saw.detune.value=osc.detune.value;osc.connect(rounded).connect(filter);saw.connect(edgy).connect(filter);saw.start();
   filter.connect(delay).connect(pan).connect(gain).connect(this.planeBus);
   const lfo=c.createOscillator(),lfoDepth=c.createGain();lfo.type='sine';lfo.frequency.value=rng(1/30,1/10);lfoDepth.gain.value=155*this.movement;
   lfo.connect(lfoDepth).connect(filter.frequency);lfo.start();osc.start();
   // Irregular sub-semitone drift per oscillator, independent from the filter sweep.
   const drift=c.createOscillator(), driftDepth=c.createGain();
   drift.type='sine';drift.frequency.value=rng(.017,.061);driftDepth.gain.value=rng(1.5,3.5)*this.movement;
   drift.connect(driftDepth).connect(osc.detune);driftDepth.connect(saw.detune);drift.start();
   this.voices.push({osc,saw,rounded,edgy,filter,pan,gain,lfo,lfoDepth,drift,driftDepth,i});}
  // Four narrowband resonators, excited by soft, continuous pink-ish noise.
  let noiseBuffer=c.createBuffer(1,Math.round(c.sampleRate*2),c.sampleRate),arr=noiseBuffer.getChannelData(0),pink=0;
  for(let i=0;i<arr.length;i++){pink=.98*pink+.02*(Math.random()*2-1);arr[i]=pink*2;}
  // Smoothly join the loop end to its beginning, eliminating periodic wrap clicks.
  const seam=4096,begin=arr.length-seam;
  for(let i=0;i<seam;i++){
    const t=i/(seam-1),shape=t*t*(3-2*t);
    arr[begin+i]=arr[begin+i]*(1-shape)+arr[i]*shape;
  }
  noiseBuffer.copyToChannel(arr,0);let noise=c.createBufferSource();noise.buffer=noiseBuffer;noise.loop=true;let ng=c.createGain();ng.gain.value=.003;noise.connect(ng);
  for(let i=0;i<4;i++){let bp=c.createBiquadFilter();bp.type='bandpass';bp.Q.value=40;let g=c.createGain();g.gain.value=.013;ng.connect(bp).connect(g).connect(this.padBus);this.ringing.push(bp)}noise.start();this.noiseSource=noise;
 }

 makeOrgan(){
  const c=this.ctx;
  // Tonewheel and Leslie architecture adapted from gpasquero/hammond-b3 (MIT).
  // Free-running oscillators, 9 drawbar ratios, separate horn/drum paths.
  this.orgPre=c.createGain();this.orgPre.gain.value=.105;
  this.orgHighSwell=c.createGain();this.orgHighSwell.gain.value=.004;
  const expression=c.createGain();expression.gain.value=.11;
  this.orgPre.connect(expression);this.orgHighSwell.connect(expression);this.orgSecond=c.createGain();this.orgSecond.gain.value=0;this.orgSecond.connect(this.orgPre);this.orgSecondOn=false;this.orgSecondAt=0;
  const cabinet=this.orgCabinet=c.createBiquadFilter();cabinet.type='lowpass';cabinet.frequency.value=3600;cabinet.Q.value=.45;
  expression.connect(cabinet);
  const lo=c.createBiquadFilter();lo.type='lowpass';lo.frequency.value=800;
  const hi=c.createBiquadFilter();hi.type='highpass';hi.frequency.value=800;
  cabinet.connect(lo);cabinet.connect(hi);
  this.orgRotor=[];
  [[lo,.72,5.2,.28,.007],[hi,.82,6.8,.75,.012]].forEach(([input,slow,fast,panAmount,delayAmount],i)=>{
   const delay=c.createDelay(.05);delay.delayTime.value=.018;
   const pan=c.createStereoPanner();const gain=c.createGain();gain.gain.value=i===0?.74:.43;
   const filter=c.createBiquadFilter();filter.type='peaking';filter.frequency.value=i===0?320:1600;filter.Q.value=1.1;filter.gain.value=0;
   input.connect(delay).connect(filter).connect(pan).connect(gain).connect(this.organBus);
   const phase=c.createOscillator();phase.type='sine';phase.frequency.value=slow;
   const panDepth=c.createGain();panDepth.gain.value=panAmount;phase.connect(panDepth).connect(pan.pan);
   // Doppler: short variable delay, not oscillator pitch modulation.
   const delayDepth=c.createGain();delayDepth.gain.value=i===0?.00008:.00012;phase.connect(delayDepth).connect(delay.delayTime);
   const spectralDepth=c.createGain();spectralDepth.gain.value=i===0?1.35:3.4;phase.connect(spectralDepth).connect(filter.gain);
   // Very shallow amplitude modulation avoids unnatural tremolo.
   const ampDepth=c.createGain();ampDepth.gain.value=i===0?.009:.018;phase.connect(ampDepth).connect(gain.gain);
   phase.start();this.orgRotor.push({motors:[phase],slow,fast});
  });
  const ratios=[.5,1,1.5,2,3,4,5,6,8];
  const levels=[.06,.72,.075,.42,.095,.32,.07,.055,.025];
  this.orgVoices=[];this.orgUpperVoices=[];this.drawbarAmps=Array.from({length:9},()=>[]);
  const register=(dest,notes)=>notes.forEach(([offset,level])=>{
    let vg=c.createGain();vg.gain.value=level;vg.connect(dest);
    let oscs=[];
    ratios.forEach((ratio,i)=>{
      if(levels[i]<.01)return;
      let osc=c.createOscillator(),amp=c.createGain();osc.type='sine';osc.frequency.value=220;amp.gain.value=levels[i];this.drawbarAmps[i].push(amp.gain);
      osc.connect(amp).connect(vg);osc.start();oscs.push({o:osc,ratio});
    });
    (dest===this.orgPre?this.orgVoices:this.orgUpperVoices).push({interval:offset,oscs});
  });
  register(this.orgPre,[[0,.48],[7,.26],[12,.16]]);
  register(this.orgSecond,[[2,.25],[14,.10]]);
  register(this.orgHighSwell,[[12,.48],[19,.34],[24,.18]]);
  this.orgNextSwell=0;this.orgUpperNext=0;this.orgNextRotor=0;this.orgFast=false;
  this.rotaryFastUntil=0;this.rotaryCooldownUntil=0;this.rotaryReturnAt=0;this.manualRotaryUntil=0;
 }
 setOrganPitch(at,cancelAt=at){
  for(const voice of [...this.orgVoices,...this.orgUpperVoices]){
   const f=hz(60+REGISTER(this.root)+voice.interval);
   for(const part of voice.oscs){
    // Tonewheel foldback keeps harmonics in a playable upper range.
    let target=f*part.ratio;
    while(target>Math.min(12000,this.ctx.sampleRate*.42))target*=.5;
    const prm=part.o.frequency;prm.cancelScheduledValues(cancelAt);prm.setValueAtTime(target,at);
   }
  }
 }
 setRotaryFast(fast,at){
  if(this.orgFast===fast)return;
  this.orgFast=fast;
  // Unlike tremolo depth or organ gain, only MOTOR SPEED changes.
  // Short motor ramps let the requested brief fast intervals become audible.
  for(const rotor of this.orgRotor){
   for(const motor of rotor.motors){
    const speed=motor.frequency;
    if(speed.cancelAndHoldAtTime) speed.cancelAndHoldAtTime(at);
    else { speed.cancelScheduledValues(at); speed.setValueAtTime(speed.value,at); }
    // Slow drum and faster horn have their own acceleration due to inertia.
    const tau=fast?(rotor.fast>6?.18:.3):(rotor.fast>6?.35:.55);
    speed.setTargetAtTime(fast?rotor.fast:rotor.slow,at,tau);
   }
  }
 }
 organPulse(now){
  if(this.stage!==3&&!this.auditionAll)return;
  if(now>=this.rotaryReturnAt){
   this.setRotaryFast(!this.orgFast,now);
   this.rotaryReturnAt=now+(this.orgFast?rng(2,4):rng(4,10));
  }
  if(now>=this.orgSecondAt){
   this.orgSecondOn=!this.orgSecondOn;
   fadeParam(this.orgSecond.gain,this.orgSecondOn?1:0,now,rng(1.5,3));
   this.orgSecondAt=now+(this.orgSecondOn?rng(5,12):rng(7,18));
  }
  if(now>=this.orgNextSwell){
   const start=now+.4,attack=rng(15,24),hold=rng(8,16),release=rng(16,26),g=this.orgPre.gain;
   const peak=rng(.115,.132),floor=.105;
   g.cancelScheduledValues(start);
   g.setValueAtTime(floor,start);g.linearRampToValueAtTime(peak,start+attack);
   g.setValueAtTime(peak,start+attack+hold);g.linearRampToValueAtTime(floor,start+attack+hold+release);
   this.orgNextSwell=start+attack+hold+release+rng(15,28);

  }
  if(now>=this.orgUpperNext){
   const start=now+.5,attack=rng(17,27),hold=rng(9,17),release=rng(19,30),g=this.orgHighSwell.gain;
   const peak=rng(.014,.025),floor=.004;
   g.cancelScheduledValues(start);
   g.setValueAtTime(floor,start);g.linearRampToValueAtTime(peak,start+attack);
   g.setValueAtTime(peak,start+attack+hold);g.linearRampToValueAtTime(floor,start+attack+hold+release);
   this.orgUpperNext=start+attack+hold+release+rng(18,32);
  }
 }
 chooseOther(last,length){let next=Math.floor(Math.random()*length);if(length>1){while(next===last)next=Math.floor(Math.random()*length)}return next}
 changeChord(index,first=false,at=this.ctx.currentTime){
  const now=this.ctx.currentTime,chord=this.planes[index];this.lastPlane=index;
  this.planeBus.gain.value=.68;
  this.voices.forEach((v,i)=>{
   const pitch=48+REGISTER(this.root)+chord[i%4];
   for(const osc of [v.osc,v.saw]){osc.frequency.cancelScheduledValues(now);osc.frequency.setValueAtTime(hz(pitch),at);}
   v.filter.frequency.cancelScheduledValues(now);v.filter.frequency.setTargetAtTime(Math.max(280,hz(60+REGISTER(this.root))*rng(1.6,4.1)),at,2.5);
  });
  this.ringing.forEach((f,i)=>{f.frequency.cancelScheduledValues(now);f.frequency.setValueAtTime(hz(72+REGISTER(this.root)+chord[i]),at);});
 }
 changeRoot(note,initial=false){
  this.root=note;const now=this.ctx.currentTime,down=opts[0].val*.35,up=opts[0].val*.65,at=initial?now:now+down+.08;
  if(initial){this.audioRoot=note;this.keyChange=null;}
  else{
   this.keyChange={note,at};this.nextNote=at+.12;
   // Every dry instrument crosses the same silent retune point. Old reverb decays naturally.
   for(const track of Object.values(this.tracks)){
    fadeParam(track.keyGate.gain,0,now,down);
    track.keyGate.gain.setValueAtTime(0,at);
    track.keyGate.gain.linearRampToValueAtTime(1,at+up);
    // Store the complete piecewise envelope for interruption fallback.
    const first=envelopes.get(track.keyGate.gain);envelopes.set(track.keyGate.gain,{...first,retune:at,end:at+up});
   }
   for(const voice of this.pianoVoices){fadeParam(voice.gain,0,now,Math.min(1,down));}
  }
  if(this.celloNode)this.celloNode.port.postMessage({type:'note',root:note,at});
  this.subs.forEach(v=>{v.o.frequency.cancelScheduledValues(now);v.o.frequency.setValueAtTime(hz(60+REGISTER(note)+v.interval),at);});
  this.changeChord(this.lastPlane<0?0:this.lastPlane,initial,at);this.setOrganPitch(at,now);
 }
 changeStage(s,initial=false){
  const previous=this.stage;
  this.stage=s;
  const now=this.ctx.currentTime;
  // Fade shapes release and proportional entrance; Dawn attack stays quick for its rotor cue.
  const release=initial?.05:opts[0].val;
  const pianoAttack=initial?.05:Math.max(.15,opts[0].val*.25);
  const organAttack=initial?.05:Math.min(1.2,opts[0].val*.25);
  const ramp=(param,destination,duration)=>fadeParam(param,destination,now,duration);
  ramp(this.pianoBus.gain,(s===0||this.auditionAll)?.75:0,(s===0||this.auditionAll)?pianoAttack:release);
  fadeParam(this.organBus.gain,(s===3||this.auditionAll)?.72:0,now,(s===3||this.auditionAll)?organAttack:release,(s===3||this.auditionAll)?'linear':'release');
  this.syncCelloStage(s,previous,initial);
  // The padBus is deliberately never touched by stage changes.
  if((s===3 && previous!==3)||initial){
    // Dawn enters fast, then alternates randomized fast and slow intervals.
    this.orgNextSwell=now+4;this.orgUpperNext=now+10;
    this.setRotaryFast(s===3||this.auditionAll,now);this.rotaryReturnAt=now+rng(2,4);this.orgSecondOn=false;fadeParam(this.orgSecond.gain,0,now,.2);this.orgSecondAt=now+rng(4,10);
  }
  if(s!==3&&!this.auditionAll){this.setRotaryFast(false,now);this.rotaryReturnAt=0;}
  if(s===0 && previous!==0){
    this.nextNote=now+.35;
    this.nextPhrase=now;
    this.nextRate=now;
  }
 }
 syncCelloStage(s,previous,initial=false){
  if(!this.celloNode)return;const now=this.ctx.currentTime,g=this.celloBus.gain;
  if(s>=2||this.auditionAll){this.celloNode.port.postMessage({type:'enter',root:this.keyChange?this.audioRoot:this.root,stage:s,restart:initial||previous<2,transport:initial});if(this.keyChange)this.celloNode.port.postMessage({type:'note',root:this.keyChange.note,at:this.keyChange.at});fadeParam(g,1,now,initial?.8:Math.max(.2,opts[0].val*.25));}
  else {const release=initial?.02:opts[0].val;this.celloNode.port.postMessage({type:'leave',at:now+release});$('celloPhrase').textContent=initial?'RESTING':'FADING';}
 }
 changeOpts(){let c=this.ctx,now=c.currentTime,v=opts[3].val/100;
  this.out.gain.setTargetAtTime(playing?v*.65:0,now,.18);
  // Movement affects the pad's actual modulation, not its reverb balance.
  this.movement=Math.pow(opts[1].val/100,1.5);
  this.masterLP.frequency.setTargetAtTime(Math.min(toneHz(opts[2].val),c.sampleRate*.45),now,.2);
  this.applyMix();
  this.voices.forEach(v=>{
   v.lfoDepth.gain.setTargetAtTime(155*this.movement,now,.3);
   v.driftDepth.gain.setTargetAtTime(2.5*this.movement,now,.8);
   v.filter.frequency.setTargetAtTime(hz(60+REGISTER(this.audioRoot))*2.6,now,2);if(v.pan.pan)v.pan.pan.setTargetAtTime(0,now,2);
  });
 }
 // Browser-native Karplus-Strong-like feedback delay (two slightly detuned delay times) plus filtered PolyPerc pulse.
 pluck(midi,when){
  // A muted piano voice, rather than the previous strongly plucked comb/square tone.
  // Additive, slightly inharmonic partials produce a soft hammer tone with a long decay.
  const c=this.ctx, f=hz(midi), vel=rng(.68,.95);
  const voice=c.createGain();voice.gain.value=.22*vel;this.pianoVoices.add(voice);
  const tone=c.createBiquadFilter();tone.type='lowpass';tone.frequency.value=Math.min(3400,Math.max(1350,f*6));tone.Q.value=.42;
  const pan=c.createStereoPanner?c.createStereoPanner():c.createGain();
  if(pan.pan)pan.pan.value=rng(-.19,.19);
  voice.connect(tone).connect(pan).connect(this.pianoBus);
  const parts=[
    {ratio:1,amp:.80,decay:5.3},
    {ratio:2.001,amp:.24,decay:2.9},
    {ratio:3.007,amp:.09,decay:1.75},
    {ratio:4.019,amp:.035,decay:1.1}
  ];
  let remaining=parts.length;
  parts.forEach((part,i)=>{
    const osc=c.createOscillator(), env=c.createGain();
    osc.type='sine';osc.frequency.value=f*part.ratio;
    env.gain.setValueAtTime(.00001,when);
    env.gain.linearRampToValueAtTime(part.amp*.72,when+(i===0?.014:.009));
    env.gain.exponentialRampToValueAtTime(.00001,when+part.decay);
    osc.connect(env).connect(voice);osc.start(when);osc.stop(when+part.decay+.04);
    osc.onended=()=>{osc.disconnect();env.disconnect();if(--remaining===0){this.pianoVoices.delete(voice);voice.disconnect();tone.disconnect();pan.disconnect();}};
  });
 }

 // Poisson stochastic triggers, like Dust.kr (not a fixed bar loop).
 tick(){if(!playing)return;let now=this.ctx.currentTime;
  // Tonic lock: keep the current voicing fixed. Only filters, stereo and micro-detuning evolve.
  this.voices.forEach(v=>{if(this.movement>0&&Math.random()<.015+.03*this.movement){v.filter.frequency.setTargetAtTime(hz(60+REGISTER(this.audioRoot))*rng(2.6-1.0*this.movement,2.6+1.5*this.movement),now,rng(5,12));if(v.pan.pan)v.pan.pan.setTargetAtTime(rng(-.75*this.movement,.75*this.movement),now,3);}});
  this.organPulse(now);
  if(this.keyChange){if(now<this.keyChange.at)return;this.audioRoot=this.keyChange.note;this.keyChange=null;this.nextNote=Math.max(this.nextNote,now+.025);draw();}
  if(this.stage!==0&&!this.auditionAll)return;
  if(now>=this.nextRate){let rates=[.02,.05,1,2,.5,.25,2].map(x=>x/2);this.rate=Math.max(.12, rates[Math.floor(Math.random()*rates.length)]*rng(.78,1.32));this.nextRate=now+-Math.log(Math.max(.000001,Math.random()));}
  if(now>=this.nextPhrase){let ix=this.chooseOther(this.lastPhrase,this.airports.length);this.lastPhrase=ix;this.sequence=this.airports[ix];this.seqIdx=0;this.nextPhrase=now+-Math.log(Math.max(.000001,Math.random()))*10;}
  let n=0;while(this.nextNote<now+.16&&n++<3){let when=Math.max(now+.025,this.nextNote);this.pluck(60+REGISTER(this.audioRoot)+this.sequence[this.seqIdx%this.sequence.length],when);this.seqIdx++;this.nextNote=when+1/Math.max(.01,this.rate);}
 }
 async start(){clearTimeout(this.suspendTimer);await this.ctx.resume();await this.makeCello();this.changeRoot(root,true);for(const t of Object.values(this.tracks)){t.keyGate.gain.cancelScheduledValues(this.ctx.currentTime);t.keyGate.gain.setValueAtTime(1,this.ctx.currentTime);envelopes.delete(t.keyGate.gain);}playing=true;this.soundStart=this.ctx.currentTime;
  let now=this.ctx.currentTime;this.out.gain.setTargetAtTime(opts[3].val/100*.65,now,.45);
  this.orgNextSwell=now+4;this.rotaryCooldownUntil=now+8;this.rotaryReturnAt=0;this.setRotaryFast(false,now);this.orgUpperNext=now+7;
  this.nextChord=Infinity;this.nextPhrase=now;this.nextRate=now;this.nextNote=now+.55;
  clearInterval(this.timer);this.changeStage(stage,true);this.timer=setInterval(()=>this.tick(),85);}
 stop(){playing=false;this.out.gain.setTargetAtTime(0,this.ctx.currentTime,.25);clearInterval(this.timer);this.timer=null;$('celloPhrase').textContent='RESTING';clearTimeout(this.suspendTimer);this.suspendTimer=setTimeout(()=>{if(!playing)this.ctx.suspend();},1600);}
}
function draw(){window.updatePadSky?.(stage);PadMix.recipe.globals={fade:opts[0].val,movement:opts[1].val,tone:opts[2].val,volume:opts[3].val,root,stage};PadMix.save();const el=$('display');el.style.setProperty('--accent',COLORS[stage]);$('stageTitle').textContent=NAMES[stage];$('stageDesc').textContent=DESCS[stage];$('rootText').textContent=NOTES[root]+(engine?.keyChange?' · CHANGING':'')+(keyTimer!==null?' → '+NOTES[queuedRoot]:'');$('status').textContent=playing&&engine?.auditionAll?'AUDITION · ALL INSTRUMENTS'+(PadMix.solo?' · SOLO '+PadMix.solo.toUpperCase():''):playing?stage===3?'PLAYING · PAD + STRINGS + ORGAN':stage===2?'PLAYING · PAD + STRINGS':'PLAYING · '+(stage===0?'PAD + GENERATIVE PIANO':'PAD ONLY'):'READY · TAP START AUDIO';document.querySelectorAll('.stage').forEach(b=>{let id=Number(b.dataset.id);b.setAttribute('aria-pressed',String(stage===id));b.classList.toggle('queued',stageTimer!==null&&target===id)});$('left').disabled=target===0;$('right').disabled=target===3;$('pending').textContent=stageTimer!==null?'QUEUED: '+NAMES[target]+' · 1 SECOND AFTER LAST TAP':keyTimer!==null?'KEY QUEUED: '+NOTES[queuedRoot]+' · 1 SECOND AFTER LAST TAP':'';}
function chooseStage(s){target=Math.max(0,Math.min(3,s));if(stageTimer!==null){clearTimeout(stageTimer);stageTimer=null}if(target!==stage){stageTimer=setTimeout(()=>{stage=target;stageTimer=null;if(engine)engine.changeStage(stage);draw()},1000)}draw()}
$('stagebar').querySelectorAll('button').forEach(b=>b.onclick=()=>chooseStage(Number(b.dataset.id)));$('left').onclick=()=>chooseStage(target-1);$('right').onclick=()=>chooseStage(target+1);
NOTES.forEach((name,i)=>{let b=document.createElement('button');b.className='note'+(name.includes('♯')?' black':'');b.textContent=name;b.dataset.note=i;const white=[0,2,4,5,7,9,11],black=[1,3,6,8,10];b.style.setProperty('--key-position',white.includes(i)?white.indexOf(i):[1,2,4,5,6][black.indexOf(i)]);b.setAttribute('aria-label','Root '+name);b.onclick=()=>{queuedRoot=i;if(keyTimer!==null){clearTimeout(keyTimer);keyTimer=null}
 if(queuedRoot!==root){keyTimer=setTimeout(()=>{root=queuedRoot;keyTimer=null;if(engine)engine.changeRoot(root);drawKeys();draw()},1000)}
 drawKeys();draw()};$('keyboard').append(b)});function drawKeys(){$('keyboard').querySelectorAll('button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===(keyTimer!==null?queuedRoot:root))))}drawKeys();
opts.forEach((o,i)=>{let holder=document.createElement('div');holder.className='control';holder.innerHTML=`<button class="knob" role="slider" aria-label="${o.name}" aria-valuemin="${o.min}" aria-valuemax="${o.max}" style="--accent:${o.color}"><svg viewBox="0 0 100 100"><path class="track" d="M19.6 79.3 A42 42 0 1 1 80.4 79.3"/><path class="progress" d="M19.6 79.3 A42 42 0 1 1 80.4 79.3"/><circle class="cap" cx="50" cy="50" r="34"/><circle cx="50" cy="50" r="24" fill="#fff" opacity=".12"/><line class="pointer" x1="50" y1="23" x2="50" y2="34"/></svg></button><label>${o.name}</label><div class="value"></div>`;$('controls').append(holder);let k=holder.querySelector('button'),v=holder.querySelector('.value'),p=holder.querySelector('.progress'),length=p.getTotalLength(),startY=null,startVal=0;const update=n=>{o.val=Math.max(o.min,Math.min(o.max,Math.round(n)));let pct=(o.val-o.min)/(o.max-o.min);k.style.setProperty('--angle',(-135+pct*270)+'deg');p.style.strokeDasharray=`${pct*length} ${length}`;v.textContent=i===2?Math.round(toneHz(o.val))+' Hz':o.val+o.unit;k.setAttribute('aria-valuenow',String(o.val));k.setAttribute('aria-valuetext',v.textContent);if(engine)engine.changeOpts();PadMix.recipe.globals[['fade','movement','tone','volume'][i]]=o.val;PadMix.save()};PadMix.knobUpdates[i]=update;update(o.val);k.addEventListener('pointerdown',e=>{PadMix.checkpoint();k.setPointerCapture(e.pointerId);startY=e.clientY;startVal=o.val;k.classList.add('adjusting')});k.addEventListener('pointermove',e=>{if(startY!==null)update(startVal+(startY-e.clientY)*(o.max-o.min)/160)});['pointerup','pointercancel','lostpointercapture'].forEach(x=>k.addEventListener(x,()=>{startY=null;k.classList.remove('adjusting')}));k.addEventListener('wheel',e=>{e.preventDefault();PadMix.checkpoint();update(o.val-Math.sign(e.deltaY))},{passive:false});k.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowRight'){e.preventDefault();if(!e.repeat)PadMix.checkpoint();update(o.val+1)}if(e.key==='ArrowDown'||e.key==='ArrowLeft'){e.preventDefault();if(!e.repeat)PadMix.checkpoint();update(o.val-1)}});k.addEventListener('dblclick',()=>{PadMix.checkpoint();update([8,35,50,55][i]);})});
if($('rotSlow'))$('rotSlow').onclick=()=>{if(engine&&playing){engine.manualRotaryUntil=engine.ctx.currentTime+60;engine.rotaryReturnAt=engine.ctx.currentTime+rng(4,10);engine.setRotaryFast(false,engine.ctx.currentTime);$('pending').textContent='LESLIE TEST: SLOW'}}; if($('rotFast'))$('rotFast').onclick=()=>{if(engine&&playing){let t=engine.ctx.currentTime;engine.manualRotaryUntil=t+60;engine.setRotaryFast(true,t);engine.rotaryReturnAt=t+rng(2,4);$('pending').textContent='LESLIE TEST: FAST (2–4S)'}};
if($('celloLevel')){$('celloLevel').value=PadMix.recipe.instruments.cello.level;$('celloValue').textContent=$('celloLevel').value+'%';$('celloLevel').oninput=()=>{PadMix.recipe.instruments.cello.level=PadMix.recipe.instruments.cello.level;$('celloValue').textContent=$('celloLevel').value+'%';if(engine)engine.applyMix();PadMix.save();};}
let starting=false;
$('play').onclick=async()=>{if(starting)return;starting=true;$('play').disabled=true;try{if(!engine)engine=new Sound();if(playing){engine.stop();$('play').textContent='▶ START AUDIO'}else{$('play').textContent='LOADING…';await engine.start();$('play').textContent='■ STOP AUDIO'}$('alert').textContent='';draw()}catch(err){if(engine)engine.stop();$('play').textContent='▶ START AUDIO';$('alert').textContent='Audio could not start: '+err.message;console.error(err)}finally{starting=false;$('play').disabled=false;}};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&playing){$('alert').textContent='Keep this browser tab active for the most reliable playback.'}});draw();

setInterval(()=>{const m=$('outputMeter');if(!m)return;if(!engine||!playing){m.textContent='Output — dBFS';return;}const v=engine.readMeter(engine.outputMeter);m.textContent='Output '+v.text+' · Compression '+Math.abs(engine.limiter.reduction||0).toFixed(1)+' dB'+(v.peak>=.95?' · HIGH LEVEL':'');m.style.color=v.peak>=.95?'#a42e2e':'';},100);

if($('stringMode'))$('stringMode').onchange=()=>{$('wanderControls').hidden=$('stringMode').value!=='9';if(engine?.celloNode)engine.celloNode.port.postMessage({type:'spirit',index:Number($('stringMode').value)});};

for(const id of ['stringPace','stringVariety'])if($(id))$(id).oninput=()=>{$('paceValue').textContent=$('stringPace').value+'%';$('varietyValue').textContent=$('stringVariety').value+'%';if(engine?.celloNode)engine.celloNode.port.postMessage({type:'expression',pace:Number($('stringPace').value)/100,variety:Number($('stringVariety').value)/100});};
