export const clone=x=>JSON.parse(JSON.stringify(x));
const note=(degree,seconds,art='sustain')=>({degree,seconds,art,strength:80});
const phrase=(id,name,instrument,stages,notes)=>({id,name,instrument,stages,notes,register:'auto',vibrato:instrument==='violin'?9:6,bloom:50,swell:30,attack:.8,release:1.8,rest:12,reverb:instrument==='violin'?55:42,bowRate:6,tag:'Revisit',memo:''});
export const defaults=[
 phrase('C1','Ground','cello','Both',[note(1,15)]),
 phrase('C2','Breathe','cello','Both',[note(2,2),note(1,10)]),
 phrase('C3','Reach','cello','Both',[note(1,2),note(5,3),note(1,9)]),
 phrase('C4','Ascent','cello','Dawn',[note(1,2),note(8,1.5),note(1,2),note(9,6)]),
 phrase('V1','Light','violin','Moonlight',[note(1,2),note(5,1.5),note(1,11)]),
 phrase('V2','Thread','violin','Both',[note(5,18)]),
 phrase('V3','Shimmer','violin','Dawn',[note(5,6,'tremolo'),note(5,5)]),
 phrase('V4','Flight','violin','Dawn',[note(5,2,'tremolo'),note(8,1.5,'tremolo'),note(9,2,'tremolo'),note(8,9)])
];
export const ranges={vibrato:[0,12,.5],bloom:[15,85,1],swell:[0,80,1],attack:[.2,3,.1],release:[.2,6,.1],rest:[0,60,.5],reverb:[0,80,1],bowRate:[2,10,.5]};
export function validatePhrase(p){if(!p||typeof p!=='object')throw Error('Missing phrase');const d=defaults.find(d=>d.id===p.id);if(!d||p.instrument!==d.instrument)throw Error('Unknown phrase or instrument');const out=clone(d);if(typeof p.name!=='string'||!p.name.trim()||p.name.length>50)throw Error('Phrase name must be 1–50 characters');out.name=p.name;
 for(const [k,[lo,hi]]of Object.entries(ranges)){if(typeof p[k]!=='number'||!Number.isFinite(p[k])||p[k]<lo||p[k]>hi)throw Error('Invalid '+k);out[k]=p[k];}
 if(!['auto','-1','0','1'].includes(p.register))throw Error('Invalid register');out.register=p.register;
 if(!['Keep','Revisit'].includes(p.tag))throw Error('Invalid review tag');out.tag=p.tag;
 if(typeof p.memo!=='string'||p.memo.length>3000)throw Error('Notes must be under 3000 characters');out.memo=p.memo;
 if(!Array.isArray(p.notes)||p.notes.length<1||p.notes.length>16)throw Error('Use 1–16 notes');out.notes=p.notes.map(n=>{if(!n||!Number.isInteger(n.degree)||n.degree<1||n.degree>15||!Number.isFinite(n.seconds)||n.seconds<.2||n.seconds>30||!['sustain','short','tremolo'].includes(n.art)||!Number.isFinite(n.strength)||n.strength<10||n.strength>100)throw Error('Invalid note: check degree, duration and strength');return {degree:n.degree,seconds:n.seconds,art:n.art,strength:n.strength};});return out;
}
export function validateBundle(b){if(b?.schema!=='pad-strings-lab/1'||!Array.isArray(b.phrases)||b.phrases.length!==8)throw Error('Choose a Strings Lab settings export');const phrases=b.phrases.map(validatePhrase);if(new Set(phrases.map(p=>p.id)).size!==8)throw Error('Duplicate phrases');const versions=(b.versions||[]);if(!Array.isArray(versions)||versions.length>200)throw Error('Too many versions');return {schema:b.schema,phrases,versions:versions.map(v=>{if(typeof v.name!=='string'||v.name.length>80||typeof v.id!=='string'||v.id.length>100)throw Error('Invalid saved version');return {id:v.id,name:v.name,phrase:validatePhrase(v.phrase)};})};}
export function pitches(p,root){const scale=[0,2,4,5,7,9,11];let base=p.instrument==='cello'?36+root+(root<7?12:0):p.id==='V1'?48+root+(root<7?12:0):60+root;
 if(p.register!=='auto')base+=12*Number(p.register);
 const notes=p.notes.map(n=>({...n,midi:base+scale[(n.degree-1)%7]+12*Math.floor((n.degree-1)/7)}));const min=p.instrument==='violin'?55:36,max=p.instrument==='violin'?95:83;if(notes.some(n=>n.midi<min||n.midi>max))throw Error('This register goes outside the lab range. Choose Auto or another octave.');return notes;}
export const noteName=m=>['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'][m%12]+(Math.floor(m/12)-1);
