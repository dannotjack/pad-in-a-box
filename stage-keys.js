// Keyboard stage navigation leaves editing and accessible slider controls alone.
document.addEventListener('keydown',event=>{
 const delta={ArrowLeft:-1,ArrowDown:-1,ArrowRight:1,ArrowUp:1}[event.key];
 if(!delta||event.defaultPrevented||event.altKey||event.ctrlKey||event.metaKey||event.shiftKey)return;
 if(event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="slider"],dialog[open]')||document.querySelector('dialog[open]'))return;
 event.preventDefault();if(!event.repeat)chooseStage(target+delta);
});
