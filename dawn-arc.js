// Audio-clock envelope: long musical arcs, independent of individual phrase endings.
export const dawnDefaults={build:25,peak:45,release:15};
export function dawnSettings(value={}){const out={};for(const [k,lo,hi] of [['build',20,30],['peak',30,60],['release',10,20]])out[k]=Number.isFinite(value[k])?Math.max(lo,Math.min(hi,value[k])):dawnDefaults[k];return out;}
export class DawnArc{
 constructor(now,settings){this.settings=dawnSettings(settings);this.phase='build';this.since=now;this.held=false;}
 setHold(value,t){this.sample(t);this.held=!!value;if(!value&&this.phase==='peak'){this.phase='release';this.since=t;}}
 sample(t){
  // Advance from the previous boundary, avoiding drift on delayed audio ticks.
  for(let i=0;i<10000;i++){const duration=this.phase==='rest'?12:this.settings[this.phase];if(this.phase==='peak'&&this.held)break;if(t-this.since<duration)break;this.since+=duration;this.phase={build:'peak',peak:'release',release:'rest',rest:'build'}[this.phase];if(this.phase==='build'&&this.nextSettings)this.settings=dawnSettings(this.nextSettings);}
  const duration=this.phase==='rest'?12:this.settings[this.phase],u=Math.max(0,Math.min(1,(t-this.since)/duration)),smooth=u*u*(3-2*u);
  const intensity=this.phase==='build'?smooth:this.phase==='peak'?1:this.phase==='release'?1-smooth:0;
  return {phase:this.phase,intensity,held:this.held,remaining:this.phase==='peak'&&this.held?null:Math.max(0,duration-(t-this.since))};
 }
}
