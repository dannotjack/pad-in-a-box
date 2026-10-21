const SPIRITS=[
 {name:'Home',notes:[[0,11]],rest:17},
 {name:'Sigh',notes:[[2,5],[0,8]],rest:18},
 {name:'Reach',notes:[[0,7],[7,9]],rest:13},
 {name:'Remember',notes:[[9,4],[7,6],[0,10]],rest:17},
 {name:'Question',notes:[[5,9],[7,7]],rest:15},
 {name:'Resolve',notes:[[2,5],[4,6],[0,11]],rest:18},
 {name:'Threshold',notes:[[5,14]],rest:20},
 {name:'Warm Window',notes:[[4,12]],rest:23},
 {name:'Footsteps',notes:[[9,6],[7,8],[5,9]],rest:19}
];
class IntegratedCello extends AudioWorkletProcessor {
 constructor(options){super();this.active=false;this.releaseStart=Infinity;this.releaseFrom=1;this.releaseGain=1;this.spirit=-1;this.wander=false;this.pace=1;this.variety=.5;this.wanderingPhrase=null;this.lastSpirit=-1;this.phraseStart=0;this.phraseGain=0;this.phraseNote=-2;this.stopAt=Infinity;this.noteEvent=null;this.blocks=0;
  this.root=0;this.stage=1;this.ornament=false;this.nextOrnament=Infinity;this.resolveAt=Infinity;this.repeatDegree=0;this.lastDegree=0;
  this.e=new WebAssembly.Instance(options.processorOptions.module,{wasi_snapshot_preview1:{fd_close:()=>0,fd_seek:()=>0,fd_write:()=>0}}).exports;
  this.e._initialize();if(!this.e.lab_init(sampleRate))throw Error('Unsupported cello sample rate');
  this.samples=new Float32Array(this.e.memory.buffer,this.e.lab_render(0),128);
  this.port.onmessage=({data:d})=>{
   if(d.type==='expression'){if(Number.isFinite(d.pace))this.pace=Math.max(.5,Math.min(1.5,d.pace));if(Number.isFinite(d.variety))this.variety=Math.max(0,Math.min(1,d.variety));}
   if(d.type==='phrase'&&Array.isArray(d.notes)&&d.notes.length&&d.notes.length<=6&&d.notes.every(n=>Array.isArray(n)&&Number.isFinite(n[0])&&n[0]>=-1&&n[0]<=12&&Number.isFinite(n[1])&&n[1]>=.2&&n[1]<=30)){this.custom={name:String(d.name||'Cello'),notes:d.notes,rest:3600};this.spirit=0;this.wander=false;this.e.lab_spirit(1);this.phraseStart=currentTime;this.phraseNote=-2;this.nextOrnament=Infinity;this.ornament=false;this.resolveAt=Infinity;}
   if(d.type==='spirit'){this.custom=null;this.wander=d.index===9;this.wanderingPhrase=null;this.spirit=Number.isInteger(d.index)&&d.index>=0&&d.index<SPIRITS.length?d.index:this.wander?0:-1;this.e.lab_spirit(this.spirit>=0?1:0);this.phraseStart=currentTime;this.phraseNote=-2;this.phraseGain=0;this.cancelOrnament();this.scheduleOrnament();}
   if(d.type==='enter'){
    const restart=!this.active||d.transport,changed=this.stage!==d.stage;this.stopAt=Infinity;this.releaseStart=Infinity;this.stage=d.stage;
    if(restart){this.noteEvent=null;this.root=d.root;this.e.lab_restart(d.root);this.phraseStart=currentTime;this.phraseNote=-2;this.releaseGain=1;this.cancelOrnament();this.scheduleOrnament();}
    else if(changed){this.cancelOrnament();this.scheduleOrnament();}
    this.e.lab_stage(d.stage===3?1:0);this.active=true;
   }
   if(d.type==='leave'){this.releaseStart=currentTime;this.releaseFrom=this.releaseGain;this.stopAt=d.at;this.nextOrnament=Infinity;this.resolveAt=Infinity;}
   if(d.type==='note'){this.nextOrnament=Infinity;this.cancelOrnament();if(this.active)this.noteEvent=d;else{this.root=d.root;this.e.lab_note(d.root);}}
  };
 }
 makeWanderingPhrase(){
  // Tonal home is frequent; colours and longer gestures are less common.
  const pool=[0,0,1,1,2,2,3,4,5,6,7,8],choices=pool.filter(n=>n!==this.lastSpirit);
  const index=choices[Math.floor(Math.random()*choices.length)],source=SPIRITS[index];this.lastSpirit=index;this.spirit=index;
  const variety=this.variety,speed=this.pace*(1+(Math.random()-.5)*.5*variety),notes=source.notes.map(([pitch,seconds])=>[pitch,seconds/speed*(1+(Math.random()-.5)*.3*variety)]);
  let ornament=false;
  // Brief neighbour and return inside a held note; borrow time, never add busy runs.
  if(Math.random()<.55*variety){const i=Math.floor(Math.random()*notes.length),[pitch,duration]=notes[i],neighbour=pitch===0?2:pitch===7?9:pitch===5?4:pitch===9?7:pitch===4?2:0,short=Math.min(.65/speed,duration*.12),lead=duration*.52;
   notes.splice(i,1,[pitch,lead],[neighbour,short],[pitch,duration-lead-short]);ornament=true;
  }
  const sound=notes.reduce((n,x)=>n+x[1],0),rest=source.rest/speed*(.65+Math.random()*.55),level=.72+Math.random()*.23;
  this.wanderingPhrase={name:source.name,notes,sound,rest,level,speed,ornament};this.phraseStart=currentTime;this.phraseNote=-2;
 }
 scheduleOrnament(){
  if(this.stage!==2||this.spirit>=0){this.nextOrnament=Infinity;return;}
  // Sparse phrases begin in the held-bow portion, away from the four-stroke gesture.
  const wait=42+Math.random()*24,age=this.e.lab_age();
  const target=Math.ceil((age+wait-3)/12)*12+3;this.nextOrnament=currentTime+target-age;
 }
 cancelOrnament(){if(this.spirit<0)this.e.lab_colour(0);this.ornament=false;this.resolveAt=Infinity;}
 process(inputs,outputs){const out=outputs[0];
  if(currentTime>=this.stopAt){this.active=false;this.stopAt=Infinity;this.noteEvent=null;this.nextOrnament=Infinity;this.port.postMessage({resting:true});}
  if(this.noteEvent&&currentTime>=this.noteEvent.at){this.root=this.noteEvent.root;this.phraseStart=currentTime;this.phraseNote=-2;this.e.lab_note(this.root);this.noteEvent=null;this.scheduleOrnament();}
  if(!this.active){for(const c of out)c.fill(0);return true;}
  if(this.ornament&&currentTime>=this.resolveAt){this.cancelOrnament();this.scheduleOrnament();}
  if(this.spirit<0&&this.stage===2&&!this.noteEvent&&!this.ornament&&currentTime>=this.nextOrnament){
   let degree=Math.random()<.7?2:7;if(this.repeatDegree>=2&&degree===this.lastDegree)degree=degree===2?7:2;
   this.repeatDegree=degree===this.lastDegree?this.repeatDegree+1:1;this.lastDegree=degree;
   this.e.lab_colour(degree===2?200:-100);this.ornament=true;
   this.resolveAt=currentTime+(degree===2?2.25:1.5);this.nextOrnament=Infinity;
  }
  let phraseTarget=1;
  if(this.spirit>=0){if(this.wander&&(!this.wanderingPhrase||currentTime-this.phraseStart>=this.wanderingPhrase.sound+this.wanderingPhrase.rest))this.makeWanderingPhrase();const p=this.custom|| (this.wander?this.wanderingPhrase:SPIRITS[this.spirit]),sound=p.notes.reduce((n,x)=>n+x[1],0),cycle=sound+p.rest,pos=(currentTime-this.phraseStart)%cycle;let end=0,index=-1;
   for(let i=0;i<p.notes.length;i++){end+=p.notes[i][1];if(pos<end){index=i;break;}}
   phraseTarget=index<0?0:Math.min(1,pos/.5,Math.max(0,(sound-pos)/.8))*(this.wander?p.level*(.94+.06*Math.sin(Math.PI*pos/sound)):1);
   if(index>=0&&index!==this.phraseNote){this.e.lab_colour(p.notes[index][0]*100);this.phraseNote=index;}
   if(index<0)this.phraseNote=-1;
  }
  try{this.e.lab_render(out[0].length);for(let i=0;i<out[0].length;i++){const t=currentTime+i/sampleRate;if(this.releaseStart!==Infinity){const u=Math.max(0,Math.min(1,(t-this.releaseStart)/(this.stopAt-this.releaseStart)));this.releaseGain=this.releaseFrom*(1-u*u*(3-2*u));}else this.releaseGain=Math.min(1,this.releaseGain+1/(sampleRate*.2));this.phraseGain+=(phraseTarget-this.phraseGain)/(sampleRate*.015);if(phraseTarget===0&&this.phraseGain<.00001)this.phraseGain=0;const v=this.samples[i]*this.releaseGain*(this.spirit>=0?this.phraseGain:1);for(const c of out)c[i]=v;}
   if(++this.blocks%100===0)this.port.postMessage({spirit:this.spirit>=0?(this.custom?this.custom.name:(this.wander?'Wandering · ':'')+SPIRITS[this.spirit].name):null,phraseRest:this.phraseNote===-1,pulse:this.e.lab_pulse(),faults:this.e.lab_faults(),degree:this.ornament?this.lastDegree:1});
  }catch(e){for(const c of out)c.fill(0);this.active=false;this.port.postMessage({error:String(e)});}
  return true;
 }
}
registerProcessor('integrated-cello',IntegratedCello);
