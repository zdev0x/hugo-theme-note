(function () {
  'use strict';

  // Theme toggle — smooth circular reveal (View Transitions) with CSS fallback
  var themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) {
    var applyTheme = function (next) {
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch (e) {}
    };
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    themeBtn.addEventListener('click', function (event) {
      var next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';

      // Reduced motion: instant switch, no animation at all
      if (reduceMotion) { applyTheme(next); return; }

      // Preferred: View Transitions API with a circular reveal from the button
      if (typeof document.startViewTransition === 'function') {
        var rect = themeBtn.getBoundingClientRect();
        var x = rect.left + rect.width / 2;
        var y = rect.top + rect.height / 2;
        var endRadius = Math.hypot(
          Math.max(x, window.innerWidth - x),
          Math.max(y, window.innerHeight - y)
        );
        var root = document.documentElement;
        root.style.setProperty('--theme-x', x + 'px');
        root.style.setProperty('--theme-y', y + 'px');
        root.style.setProperty('--theme-r', endRadius + 'px');
        root.classList.add('theme-vt');
        var vt = document.startViewTransition(function () { applyTheme(next); });
        vt.finished.finally(function () { root.classList.remove('theme-vt'); });
        return;
      }

      // Fallback: transient CSS transition class
      var root = document.documentElement;
      root.classList.add('theme-transition');
      applyTheme(next);
      window.setTimeout(function () { root.classList.remove('theme-transition'); }, 320);
    });
  }

  // Mobile menu
  var navToggle = document.getElementById('nav-toggle');
  var siteNav = document.getElementById('site-nav');
  if (navToggle && siteNav) {
    navToggle.addEventListener('click', function () {
      siteNav.classList.toggle('-translate-y-full');
      siteNav.classList.toggle('opacity-0');
      siteNav.classList.toggle('invisible');
      siteNav.classList.toggle('pointer-events-none');
    });
    siteNav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        siteNav.classList.add('-translate-y-full', 'opacity-0', 'invisible', 'pointer-events-none');
      });
    });
  }

  // Back to top
  var backTop = document.getElementById('back-top');
  if (backTop) {
    var update = function () {
      var show = window.scrollY > window.innerHeight / 3;
      backTop.classList.toggle('opacity-0', !show);
      backTop.classList.toggle('pointer-events-none', !show);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    backTop.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Share: copy link, with a transient color cue only (no tooltip bubble)
  var shareCopy = document.getElementById('share-copy');
  if (shareCopy) {
    shareCopy.addEventListener('click', function () {
      var url = shareCopy.dataset.url || window.location.href;
      var done = function () {
        shareCopy.classList.add('copied');
        window.setTimeout(function () { shareCopy.classList.remove('copied'); }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(done).catch(function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = url; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done(); } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  }
})();
