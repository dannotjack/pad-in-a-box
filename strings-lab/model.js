// Direct JavaScript port of src/ModalStiffStringProcessor.cpp's modal bow solver.
// Physical constants, damping, input/read positions and bow envelopes match the production source.
// Lab-only runtime exposes bow rate and vibrato without altering production WASM.
export class StringModel {
 constructor(sr,midi,instrument){
  this.sr=sr;this.dt=1/sr;this.previous=0;this.faults=0;
  const pi=Math.PI,violin=instrument==='violin';let radius,density,tension,young,length,input,read;
  if(violin){const open=midi<62?196:midi<69?293.6647679:440;radius=midi<62?.00020:midi<69?.00017:.00013;density=7800;tension=(2*.328*open)**2*pi*radius**2*density;young=8e9;length=.328*open/(440*2**((midi-69)/12));input=.82;read=.42;}
  else{radius=.000605;density=5357;tension=112.67;young=8.6e9;length=.69/2**((midi-43)/12);input=.733;read=.53;}
  const mu=density*pi*radius**2,I=pi*radius**4/4;this.modes=[];
  for(let n=1;n<512;n++){const k=n*pi/length,w=Math.sqrt(tension/mu*k*k+young*I/mu*k**4);if(w>20000*2*pi)break;
   const damp=2*1.225*1.619e-5/(density*radius**2)+2*1.225*Math.sqrt(2*1.619e-5)/(density*radius)*Math.sqrt(w)+w/18000+.003*young*density*pi*pi*radius**6/(4*tension*tension)*w**3;
   this.modes.push({w2:w*w,inp:Math.sqrt(2/length)*Math.sin(n*pi*input),out:Math.sqrt(2/length)*Math.sin(n*pi*read),t22:1+.5*this.dt*damp,b22:1-.5*this.dt*damp});
  }
  this.n=this.modes.length;for(const k of ['x','v','av','ab','ax','bx'])this[k]=new Float64Array(this.n);
 }
 reset(){this.x.fill(0);this.v.fill(0);this.previous=0;}
 tick(speed,force,cents){const dt=this.dt,h=dt*.5,ratio=2**(cents/600),m=this.modes;let zeta=0;
  for(let i=0;i<this.n;i++)zeta+=m[i].inp*this.v[i];
  const eta=zeta-speed,D=Math.sqrt(200)*Math.exp(-100*eta*eta+.5),lambda=D*(1-200*eta*eta);let vt1=0,vt2=0;
  for(let i=0;i<this.n;i++){const a=m[i],t21=h*a.w2*ratio,schur=a.t22+t21*h,b1=this.x[i]+h*this.v[i],b2=-t21*this.x[i]+a.b22*this.v[i]+a.inp*zeta*h*force*(lambda-2*D)+dt*force*D*a.inp*speed;
   this.av[i]=h*force*lambda*a.inp/schur;this.ax[i]=h*this.av[i];this.ab[i]=(b2-t21*b1)/schur;this.bx[i]=b1+h*this.ab[i];vt1+=a.inp*this.av[i];vt2+=a.inp*this.ab[i];}
  const coeff=vt2/(1+vt1);let output=0;
  for(let i=0;i<this.n;i++){this.x[i]=this.bx[i]-this.ax[i]*coeff;this.v[i]=this.ab[i]-this.av[i]*coeff;output+=m[i].out*this.x[i];}
  const value=(output-this.previous)/dt;this.previous=output;if(!Number.isFinite(value)||Math.abs(value)>20){this.faults++;this.reset();return 0;}return value;
 }
}
export const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
