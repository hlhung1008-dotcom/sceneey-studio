(function(){
  var p=document.createElement('button');p.className='peek';p.type='button';p.setAttribute('aria-label','Sceneey');
  p.innerHTML='<img src="img/sceneey-peek.webp" alt="" width="640" height="732">';
  var b=document.createElement('a');b.className='bubble';b.href='gallery.html';b.textContent="Sceneey's Gallery →";
  document.body.append(b,p);
  function close(){p.classList.remove('open');b.classList.remove('show');p.setAttribute('aria-expanded','false')}
  p.setAttribute('aria-expanded','false');
  p.addEventListener('click',function(e){e.stopPropagation();
    if(p.classList.contains('open')){location.href='gallery.html';return}
    p.classList.add('open');b.classList.add('show');p.setAttribute('aria-expanded','true')});
  document.addEventListener('click',function(e){if(!p.contains(e.target)&&!b.contains(e.target))close()});
  document.addEventListener('keydown',function(e){if(e.key==='Escape')close()});
})();
