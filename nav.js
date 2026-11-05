(function(){var b=document.querySelector('.menu'),n=document.querySelector('nav');if(!b||!n)return;
function sync(){if(innerWidth<=760){n.hidden=b.getAttribute('aria-expanded')!=='true'}else{n.hidden=false}}
b.addEventListener('click',function(){b.setAttribute('aria-expanded',b.getAttribute('aria-expanded')==='true'?'false':'true');sync()});
addEventListener('resize',sync);sync();})();
