import {StringModel,smooth} from './model.js';
class LabVoice extends AudioWorkletProcessor {
 constructor(){super();this.active=false;this.port.onmessage=({data})=>{if(data.type==='stop'){this.stop=currentTime;this.stopDuration=Math.max(.05,Math.min(20,data.fade||.2));return;}if(data.type==='play'){this.p=data.phrase;this.notes=data.notes;this.start=data.at;this.total=this.notes.reduce((s,n)=>s+n.seconds,0);this.models=new Map();for(const n of this.notes)if(!this.models.has(n.midi))this.models.set(n.midi,new StringModel(sampleRate,n.midi,this.p.instrument));this.voice=this.models.get(this.notes[0].midi);this.old=null;this.index=0;this.age=0;this.phase=0;this.filter=0;this.gain=0;this.stop=Infinity;this.stopDuration=.2;this.active=true;this.blocks=0;}}; }
 process(inputs,outputs){const out=outputs[0][0];out.fill(0);if(!this.active)return true;const p=this.p,isV=p.instrument==='violin';let report=false;
  for(let i=0;i<out.length;i++){const time=currentTime+i/sampleRate,pos=time-this.start;if(time<this.start-.65)continue;
   if(pos>=this.total+p.release||time>=this.stop+this.stopDuration){this.active=false;this.port.postMessage({done:true});break;}
   let end=0,index=this.notes.length-1;for(let j=0;j<this.notes.length;j++){end+=this.notes[j].seconds;if(pos<end){index=j;break;}}
   if(index!==this.index){this.old=this.voice;this.voice=this.models.get(this.notes[index].midi);if(this.old!==this.voice)this.voice.reset();this.changeAge=0;this.index=index;report=true;}
   const n=this.notes[index],local=Math.max(0,pos-(end-n.seconds)),u=Math.min(1,local/n.seconds),peak=p.bloom/100;
   const contour=u<peak?Math.sin(Math.PI*.5*u/peak)**2:Math.sin(Math.PI*.5*(1-u)/(1-peak))**2;
   const depth=p.vibrato*(n.seconds>=3?.15+.85*contour:.18);this.phase+=2*Math.PI*(isV?5.3:4.65)/sampleRate;
   let bowLength=n.art==='tremolo'?1/p.bowRate:n.art==='short'?.45:isV?5.8:6;
   const bowTime=this.age%bowLength,edge=Math.min(bowTime,bowLength-bowTime),sign=Math.floor(this.age/bowLength)%2?-1:1;
   const ease=smooth(edge/Math.min(.09,bowLength*.28));let speed=sign*(isV?.13:.2)*ease*(.96+.04*Math.sin(this.age*.43));
   const force=isV?2.5*(.65+.35*ease)*smooth(edge/Math.min(.075,bowLength*.23)):10*(.55+.45*smooth(edge/Math.min(.085,bowLength*.23)));
   let value=this.voice.tick(speed,force,depth*Math.sin(this.phase));
   if(this.old&&this.old!==this.voice){this.changeAge+=1/sampleRate;const cross=smooth((this.changeAge-.04)/.025);value=value*cross+this.old.tick(speed,force,depth*Math.sin(this.phase))*(1-cross);if(cross>=1)this.old=null;}
   const attack=smooth(Math.max(0,pos)/p.attack),release=pos>this.total?1-smooth((pos-this.total)/p.release):1,stop=time>=this.stop?1-smooth((time-this.stop)/this.stopDuration):1;
   const swell=1-p.swell/100*.5+p.swell/100*.5*Math.sin(Math.PI*Math.max(0,Math.min(1,pos/this.total)));
   const short=n.art==='short'?1-smooth(Math.max(0,bowTime/bowLength-.65)/.25):1;
   const target=pos<0?0:attack*release*stop*n.strength/100*swell*short;this.gain+=(target-this.gain)/(sampleRate*.015);
   this.filter+=(value-this.filter)*(1-Math.exp(-2*Math.PI*1800/sampleRate));const air=smooth(pos/.8);
   out[i]=(this.filter*(1-air)+value*air)*this.gain*(isV?.25:.32);
   if(!Number.isFinite(out[i])||Math.abs(out[i])>1){out[i]=0;this.active=false;this.port.postMessage({error:'Audio safety stop. Try the default settings.'});break;}
   this.age+=1/sampleRate;
  }
  if(report||++this.blocks%20===0)this.port.postMessage({index:this.index,preparing:currentTime<this.start,faults:[...this.models.values()].reduce((s,m)=>s+m.faults,0)});
  return true;
 }
}
registerProcessor('strings-lab',LabVoice);
