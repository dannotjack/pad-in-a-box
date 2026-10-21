(() => {
 const paths=[...document.querySelectorAll('.wave path')];if(!paths.length)return;
 const samples=new Float32Array(2048),reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)');let last=-Infinity;
 function frame(now){requestAnimationFrame(frame);if(document.hidden||now-last<(reduced?.matches?125:33))return;last=now;
  const meter=engine?.outputMeter;
  paths.forEach((path,channel)=>{
   samples.fill(0);if(meter&&engine.ctx.state==='running')meter.channels[channel%meter.channels.length].getFloatTimeDomainData(samples);
   // Trigger near a rising zero crossing to keep a sustained tone visually stable.
   let start=0;for(let i=1;i<512;i++)if(samples[i-1]<=0&&samples[i]>0){start=i;break;}
   let d='';for(let i=0;i<=125;i++){const index=start+i*8;const value=Number.isFinite(samples[index])?samples[index]:0;const y=14-Math.max(-12,Math.min(12,value*96));d+=(i?' L':'M')+(i*4)+' '+y.toFixed(2);}
   path.setAttribute('d',d);
  });
 }
 requestAnimationFrame(frame);
})();
