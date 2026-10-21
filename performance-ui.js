(() => {
 const menu=document.getElementById('settingsMenu'),dialog=document.getElementById('helpDialog'),summary=menu.querySelector('summary');
 document.getElementById('openHelp').addEventListener('click',()=>{menu.open=false;dialog.showModal();});
 document.getElementById('closeHelp').addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>summary.focus());
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)dialog.close();}});
 document.addEventListener('click',event=>{if(!menu.contains(event.target))menu.open=false;});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.open=false;summary.focus();}});
})();

