(function () {
  'use strict';
  var modal = document.getElementById('search-modal');
  var input = document.getElementById('search-input');
  var results = document.getElementById('search-results');
  if (!modal || !input || !results) return;

  var pagefind = null;
  function load() {
    if (pagefind) return Promise.resolve(pagefind);
    try {
      return Function('return import("/pagefind/pagefind.js")')()
        .then(function (m) { pagefind = m; return m; })
        .catch(function () { return null; });
    } catch (e) { return Promise.resolve(null); }
  }

  function open() {
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    load();
    setTimeout(function () { input.focus(); }, 100);
  }
  function close() {
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
    input.value = '';
    results.innerHTML = '<div class="px-4 py-8 text-center text-muted-foreground">输入关键词开始搜索</div>';
  }

  document.getElementById('search-open')?.addEventListener('click', open);
  document.getElementById('search-close')?.addEventListener('click', close);
  document.getElementById('search-overlay')?.addEventListener('click', close);
  document.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
    if (e.key === 'Escape' && !modal.classList.contains('hidden')) close();
  });

  var timer = null;
  input.addEventListener('input', function () {
    var q = input.value.trim();
    clearTimeout(timer);
    if (!q) { results.innerHTML = '<div class="px-4 py-8 text-center text-muted-foreground">输入关键词开始搜索</div>'; return; }
    timer = setTimeout(function () { runSearch(q); }, 180);
  });

  function runSearch(q) {
    load().then(function (pf) {
      if (!pf) {
        results.innerHTML = '<div class="px-4 py-8 text-center text-muted-foreground text-sm">搜索索引未生成。请使用完整构建预览（npm run preview）后重试。</div>';
        return;
      }
      return pf.search(q).then(function (res) {
        return Promise.all(res.results.slice(0, 10).map(function (r) { return r.data(); }));
      }).then(function (data) {
        if (!data.length) { results.innerHTML = '<div class="px-4 py-8 text-center text-muted-foreground">没有找到相关结果</div>'; return; }
        var ul = document.createElement('ul');
        ul.className = 'py-2';
        data.forEach(function (d) {
          var li = document.createElement('li');
          var a = document.createElement('a');
          a.href = d.url;
          a.className = 'block px-4 py-3 hover:bg-secondary transition-colors';
          var title = document.createElement('div');
          title.className = 'font-medium text-foreground';
          title.textContent = d.meta && d.meta.title ? d.meta.title : '未命名';
          var excerpt = document.createElement('div');
          excerpt.className = 'text-sm text-muted-foreground mt-1 line-clamp-2';
          excerpt.innerHTML = d.excerpt || '';
          a.append(title, excerpt);
          a.addEventListener('click', close);
          li.appendChild(a);
          ul.appendChild(li);
        });
        results.replaceChildren(ul);
      });
    }).catch(function () {
      results.innerHTML = '<div class="px-4 py-8 text-center text-muted-foreground">搜索出错，请稍后重试</div>';
    });
  }
})();
