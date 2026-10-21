const VIOLIN_TESTS=[{name:'A4 sustain',notes:[[9,9]],rest:9},{name:'B4 → A4',notes:[[11,2],[9,8]],rest:10},{name:'E5 → D5',notes:[[16,2],[14,10]],rest:10}];
class ViolinAudition extends AudioWorkletProcessor{
 constructor(o){super();this.e=new WebAssembly.Instance(o.processorOptions.module,{wasi_snapshot_preview1:{fd_close:()=>0,fd_seek:()=>0,fd_write:()=>0}}).exports;this.e._initialize();if(!this.e.violin_init(sampleRate))throw Error('Unsupported sample rate');this.samples=new Float32Array(this.e.memory.buffer,this.e.violin_render(0),128);this.active=false;this.stopAt=Infinity;this.test=0;this.start=0;this.note=-1;this.gain=0;this.release=Infinity;this.blocks=0;this.pending=null;this.attackFilter=0;this.port.onmessage=({data:d})=>{if(d.type==='phrase'&&Array.isArray(d.notes)&&d.notes.length&&d.notes.length<=6&&d.notes.every(n=>Array.isArray(n)&&Number.isInteger(n[0])&&n[0]>=0&&n[0]<24&&Number.isFinite(n[1])&&n[1]>=.2&&n[1]<=30)){this.custom={name:String(d.name||'Violin'),notes:d.notes,rest:3600};this.begin(-1);}
if(d.type==='play'&&Number.isInteger(d.test)&&d.test>=0&&d.test<3){if(this.active){this.pending=d.test;this.release=currentTime;}else this.begin(d.test);}if(d.type==='resume')this.stopAt=Infinity;
if(d.type==='leave')this.stopAt=d.at;
if(d.type==='stop'){this.pending=null;this.release=currentTime;}};}
 begin(test){this.stopAt=Infinity;this.test=test;this.start=currentTime+.65;this.cyclePrepared=false;this.note=0;this.e.violin_restart((test===-1?this.custom:VIOLIN_TESTS[test]).notes[0][0]);this.gain=0;this.attackFilter=0;this.release=Infinity;this.pending=null;this.active=true;}
 process(inputs,outputs){const out=outputs[0];if(currentTime>=this.stopAt){this.active=false;this.stopAt=Infinity;}if(!this.active){for(const c of out)c.fill(0);return true;}
 // Run the solver at its normal audio rate while completely disconnected acoustically.
 // Phrase time begins only after the string has established a stable bow oscillation.
 if(currentTime<this.start){for(const c of out)c.fill(0);if(currentTime>=this.release){if(this.pending!==null)this.begin(this.pending);else{this.active=false;this.port.postMessage({stopped:true});}return true;}try{this.e.violin_render(out[0].length);}catch(e){this.active=false;this.port.postMessage({error:String(e)});}return true;}
 const p=this.test===-1?this.custom:VIOLIN_TESTS[this.test],sound=p.notes.reduce((n,x)=>n+x[1],0),pos=(currentTime-this.start)%(sound+p.rest);let end=0,index=-1;for(let i=0;i<p.notes.length;i++){end+=p.notes[i][1];if(pos<end){index=i;break;}}
 // Prepare the first pitch in the final silent portion of each repeating cycle.
 if(index<0&&pos>=sound+p.rest-.65&&!this.cyclePrepared){this.e.violin_note(p.notes[0][0]);this.cyclePrepared=true;}
 if(index>=0)this.cyclePrepared=false;
 if(index>=0&&index!==this.note)this.e.violin_note(p.notes[index][0]);this.note=index;
 // Bloom within each long note, with an independent contour but continuous vibrato phase.
 let depth=0;if(index>=0){const duration=p.notes[index][1],local=pos-(end-duration),u=Math.max(0,Math.min(1,local/duration));depth=duration>=3?1.5+7.5*Math.pow(Math.sin(Math.PI*u),2):1.5;}
 this.e.violin_vibrato(depth);
 const attack=Math.max(0,Math.min(1,(pos-.12)/.68)),target=index<0||currentTime>=this.release?0:Math.min(attack*attack*(3-2*attack),Math.max(0,(sound-pos)/1.2));
 try{this.e.violin_render(out[0].length);for(let i=0;i<out[0].length;i++){this.gain+=(target-this.gain)/(sampleRate*(this.pending!==null?.02:.06));if(target===0&&this.gain<.00001)this.gain=0;const t=pos+i/sampleRate,blend=Math.max(0,Math.min(1,(t-.12)/.65)),air=blend*blend*(3-2*blend);this.attackFilter+=(this.samples[i]-this.attackFilter)*(1-Math.exp(-2*Math.PI*1800/sampleRate));const shaped=this.attackFilter*(1-air)+this.samples[i]*air;for(const c of out)c[i]=shaped*this.gain;}if(++this.blocks%100===0)this.port.postMessage({label:p.name,rest:index<0,faults:this.e.violin_faults()});if(currentTime>this.release+(this.pending!==null?.2:.8)){if(this.pending!==null)this.begin(this.pending);else{this.active=false;this.port.postMessage({stopped:true});}}}catch(e){for(const c of out)c.fill(0);this.active=false;this.port.postMessage({error:String(e)});}return true;}
}
registerProcessor('violin-audition',ViolinAudition);
