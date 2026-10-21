// Pad synthesis retained from the production Sound.makePad implementation.
const hz=m=>440*2**((m-69)/12),REGISTER=n=>n>=6?n-12:n;
let seed=1;function rng(a,b){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return a+(b-a)*seed/4294967296;}
export class PadBed{
 constructor(ctx,root,output){seed=1;this.ctx=ctx;this.root=root;this.movement=.2;this.voices=[];this.ringing=[];this.subs=[];this.padBus=ctx.createGain();this.padBus.gain.value=.45;this.padBus.connect(output);this.makePad();const pitches=[0,7,12,19];this.planeBus.gain.value=1;this.voices.forEach((v,i)=>{v.osc.frequency.value=v.saw.frequency.value=hz(60+REGISTER(root)+pitches[i%4]);v.filter.frequency.value=hz(60+REGISTER(root))*2.6;});this.ringing.forEach((f,i)=>f.frequency.value=hz(72+REGISTER(root)+pitches[i]));}
 stop(){for(const v of this.voices)for(const k of ['osc','saw','lfo','drift'])try{v[k].stop();}catch{}for(const v of this.subs)for(const k of ['o','lfo'])try{v[k].stop();}catch{}try{this.noiseSource.stop();}catch{}this.padBus.disconnect();}
 makePad(){let c=this.ctx;this.planeBus=c.createGain();this.planeBus.gain.value=0;this.planeBus.connect(this.padBus);
  this.padWarm=c.createGain();this.padWarm.gain.value=.19;this.padWarm.connect(this.padBus);this.subMaster=c.createGain();this.subMaster.connect(this.padWarm);
  // Two slow, sub-octave sine oscillators, corresponding to the SuperCollider foundation.
  [-24,-12].forEach((interval,i)=>{let o=c.createOscillator(),gain=c.createGain(),lfo=c.createOscillator(),depth=c.createGain();o.type='sine';o.frequency.value=hz(60+REGISTER(this.root)+interval);gain.gain.value=.012/(i+1);lfo.type='sine';lfo.frequency.value=rng(.001,.01);depth.gain.value=i===0?.032:.014;lfo.connect(depth).connect(gain.gain);o.connect(gain).connect(this.subMaster);o.start();lfo.start();this.subs.push({o,lfo,interval});});
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

}
