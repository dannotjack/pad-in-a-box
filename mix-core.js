(function(g){
 const channel=(cutoff,space,level=100)=>({level,mute:false,bass:0,lowMid:-3,treble:0,cutoff,space});
 const defaults={"schema":"pad-in-a-box-mix/1","name":"Default","globals":{"fade":8,"movement":35,"tone":50,"volume":55,"root":0,"stage":3},"instruments":{"drone":{"level":84,"bass":-6,"lowMid":9.5,"treble":-2,"cutoff":12000,"space":43,"mute":false,"edge":0},"piano":{"level":100,"bass":0,"lowMid":-3,"treble":9.5,"cutoff":1900,"space":58,"mute":false},"cello":{"level":44,"bass":-8,"lowMid":-4,"treble":2.5,"cutoff":2530,"space":42,"mute":false},"organ":{"level":115,"bass":-2,"lowMid":-6,"treble":4,"cutoff":6500,"space":27,"mute":false,"drawbars":[7.56,5.76,4.35,6.61,7.05,7.34,6.4,6.39,6.8]}}};
 const performance={organDegrees:[1,2,5],celloMode:'spirits-ensemble',tempo:80,bowCycle:12};
 defaults.schema='pad-in-a-box-mix/2';defaults.engineVersion='1.7';defaults.instruments.violin={level:45,mute:false,bass:0,lowMid:0,treble:0,cutoff:5000,space:55};defaults.ensemble={mood:'auto'};defaults.performance=performance;
 const clone=x=>JSON.parse(JSON.stringify(x));
 function validate(r){
  if(!r||!['pad-in-a-box-mix/1',defaults.schema].includes(r.schema))throw Error('This is not a supported Pad in a Box mix recipe.');
  if(r.schema===defaults.schema&&(!['1.2','1.3','1.4','1.7'].includes(r.engineVersion)||!r.performance||r.performance.celloMode!==(r.engineVersion==='1.7'?'spirits-ensemble':'major-neighbours')||r.performance.tempo!==80||r.performance.bowCycle!==12||JSON.stringify(r.performance.organDegrees)!==(r.engineVersion==='1.2'?'[2,5]':'[1,2,5]')))throw Error('This recipe uses a different playing engine. Keep its original export.');
  const out=clone(defaults);if(typeof r.name!=='string'||r.name.length>80)throw Error('Recipe name must be 80 characters or fewer.');out.name=r.name;
  const num=(v,a,b,label)=>{if(typeof v!=='number'||!Number.isFinite(v)||v<a||v>b)throw Error('Invalid '+label);return v;};
  for(const [k,range]of Object.entries({fade:[1,20],movement:[0,100],tone:[0,100],volume:[0,100],root:[0,11],stage:[0,3]})){out.globals[k]=num(r.globals?.[k],...range,k);if(!Number.isInteger(out.globals[k]))throw Error('Invalid '+k);}
  for(const k of Object.keys(out.instruments)){const c=r.instruments?.[k]||(k==='violin'&&r.engineVersion!=='1.7'?defaults.instruments.violin:null);if(!c)throw Error('Missing '+k);for(const [p,range]of Object.entries({level:[0,k==='cello'?100:150],bass:[-12,12],lowMid:[-12,12],treble:[-12,12],cutoff:[120,12000],space:[0,60]}))out.instruments[k][p]=num(c[p],...range,k+' '+p);if(typeof c.mute!=='boolean')throw Error('Invalid mute');out.instruments[k].mute=c.mute;}
  out.instruments.drone.edge=num(r.instruments.drone.edge,0,100,'drone edge');
  const d=r.instruments.organ.drawbars;if(!Array.isArray(d)||d.length!==9)throw Error('Nine organ drawbars required');out.instruments.organ.drawbars=d.map(v=>num(v,0,8,'drawbar'));
  if(r.engineVersion==='1.7'){if(!['auto','stillness','conversation','unresolved'].includes(r.ensemble?.mood))throw Error('Invalid ensemble mood');out.ensemble.mood=r.ensemble.mood;}
  return out;
 }
 const api={defaults,clone,validate,recipe:clone(defaults),solo:null,auditionAll:false,storageOK:true,knobUpdates:[],history:[]};
 try{const r=g.localStorage?.getItem('pad-in-a-box-mix-v4')||g.localStorage?.getItem('pad-in-a-box-mix-v3')||g.localStorage?.getItem('pad-in-a-box-mix-v2')||g.localStorage?.getItem('pad-in-a-box-mix-v1');if(r)api.recipe=validate(JSON.parse(r));}catch(e){api.storageOK=false;}
 api.save=()=>{try{g.localStorage.setItem('pad-in-a-box-mix-v4',JSON.stringify(api.recipe));api.storageOK=true;}catch(e){api.storageOK=false;}return api.storageOK;};
 api.checkpoint=()=>{const r=clone(api.recipe);if(JSON.stringify(api.history.at(-1))!==JSON.stringify(r))api.history.push(r);if(api.history.length>50)api.history.shift();g.document?.dispatchEvent(new Event('mixhistory'));};
 api.undo=()=>api.history.pop()||null;
 g.PadMix=api;
})(globalThis);
