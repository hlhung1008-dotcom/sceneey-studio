(function(){
  var p=document.createElement('button');p.className='peek';p.type='button';p.setAttribute('aria-label','Sceneey');
  p.innerHTML='<img src="img/sceneey-peek.webp" alt="" width="640" height="732">';
  var b=document.createElement('a');b.className='bubble';b.href='gallery.html';b.innerHTML='<span>Sceneey\'s Gallery</span><svg viewBox="0 0 62 34" aria-hidden="true"><defs><filter id="crayon" x="-20%" y="-40%" width="140%" height="180%"><feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="4" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="2.6" result="d"/><feTurbulence type="fractalNoise" baseFrequency="2.4" numOctaves="1" seed="9" result="g"/><feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.7" result="m"/><feComposite in="d" in2="m" operator="in"/></filter></defs><g filter="url(#crayon)" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round"><path d="M3 19 C14 15 27 21 40 17 S51 16 55 17" stroke-width="4.2"/><path d="M4 21 C16 18 28 22 41 19 S50 18 54 18" stroke-width="2" opacity=".7"/><path d="M42 6 C47 10 52 14 57 17 C52 21 47 25 43 30" stroke-width="4.2"/><path d="M44 8 C48 12 52 15 55 17" stroke-width="2" opacity=".7"/></g></svg>';b.setAttribute('aria-label',"Sceneey's Gallery");
  document.body.append(b,p);
  function close(){p.classList.remove('open');b.classList.remove('show');p.setAttribute('aria-expanded','false')}
  p.setAttribute('aria-expanded','false');
  p.addEventListener('click',function(e){e.stopPropagation();
    if(p.classList.contains('open')){location.href='gallery.html';return}
    p.classList.add('open');b.classList.add('show');p.setAttribute('aria-expanded','true')});
  document.addEventListener('click',function(e){if(!p.contains(e.target)&&!b.contains(e.target))close()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
})();
