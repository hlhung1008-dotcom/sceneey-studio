(function () {
  var KEY = 'sceneey-annc-closed';
  var css = '' +
    '.annc{position:relative;z-index:200;display:flex;align-items:center;gap:12px;min-height:40px;box-sizing:border-box;' +
    'padding:6px max(16px,env(safe-area-inset-right,0px)) 6px max(16px,env(safe-area-inset-left,0px));' +
    'background:#fdf3f5;color:#4a4547;border-bottom:1.5px dashed #e7a8bf;font:500 14px/1.4 "M PLUS Rounded 1c","Noto Sans TC",system-ui,sans-serif}' +
    '.annc svg.horn{flex:none;width:26px;height:26px}' +
    '.annc .tag{flex:none;font-weight:800;font-size:11px;letter-spacing:.15em;padding:2px 8px;border-radius:999px;background:#f6c9d4}' +
    '.annc a.msg{flex:1;min-width:0;color:inherit;text-decoration:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.annc a.msg:hover .t{text-decoration:underline;text-decoration-color:#e7a8bf;text-underline-offset:3px}' +
    '.annc .more{color:#c27ba0;margin-left:8px;font-weight:800}' +
    '.annc button{flex:none;width:30px;height:30px;border:0;background:none;color:#4a4547;cursor:pointer;border-radius:50%;display:grid;place-items:center}' +
    '.annc button:hover{background:#f6dbe2}' +
    '.annc :focus-visible{outline:2px dashed #4a4547;outline-offset:2px}';
  function closed() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function remember(id) { try { localStorage.setItem(KEY, id); } catch (e) {} }
  fetch('news.json', { cache: 'no-cache' }).then(function (r) { return r.json(); }).then(function (list) {
    if (!list || !list.length) return;
    list.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    var n = list[0];
    if (closed() === n.id) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    var bar = document.createElement('div'); bar.className = 'annc'; bar.id = 'annc'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', '最新公告');
    bar.innerHTML =
      '<svg class="horn" viewBox="0 0 32 32" aria-hidden="true"><g fill="none" stroke="#4a4547" stroke-width="2" stroke-linejoin="round" stroke-linecap="round">' +
      '<path d="M5 13.5c0-1 .8-1.8 1.8-1.8H11l10-6v20.6l-10-6H6.8c-1 0-1.8-.8-1.8-1.8z" fill="#f6c9d4"/><path d="M11 20.5l2.2 6.2c.3.8 1.3 1 1.9.5l.6-.5c.5-.4.6-1.1.3-1.7L14 20.5"/>' +
      '<path d="M25 12.5c1.4 1 2.2 2.4 2.2 3.8s-.8 2.8-2.2 3.8M24.2 8.6c2.6 1.7 4.2 4.5 4.2 7.6s-1.6 5.9-4.2 7.6" stroke="#c27ba0"/></g></svg>' +
      '<span class="tag"></span><a class="msg" href="news.html"><span class="t"></span><span class="more">看更多 →</span></a>' +
      '<button type="button" aria-label="關閉公告"><svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="M4.5 4.8c3.6 3.4 7 7 11 10.6M15.4 4.4c-3.8 3.6-7.4 7.4-10.8 11" stroke="#4a4547" stroke-width="2.2" stroke-linecap="round" fill="none"/></svg></button>';
    bar.querySelector('.tag').textContent = n.cat;
    bar.querySelector('.t').textContent = n.title;
    bar.querySelector('a.msg').href = 'news.html#' + encodeURIComponent(n.id);
    bar.querySelector('button').addEventListener('click', function () {
      remember(n.id); bar.remove(); window.dispatchEvent(new Event('resize'));
    });
    document.body.insertBefore(bar, document.body.firstChild);
    window.dispatchEvent(new Event('resize'));
  }).catch(function () {});
})();
