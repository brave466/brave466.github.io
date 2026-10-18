/* brave — likes (Lyket REST) + guest comments (Cusdis), loaded only when configured. */
(function () {
  'use strict';
  var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------- likes ---------------- */
  var box = document.querySelector('[data-like]');
  if (box) initLikes(box);

  function initLikes(box) {
    var btn = box.querySelector('.like-btn'),
        nEl = box.querySelector('[data-like-n]'),
        wEl = box.querySelector('[data-like-word]'),
        key = box.getAttribute('data-like-key'),
        ns = box.getAttribute('data-like-ns'),
        id = box.getAttribute('data-like-id'),
        anon = box.hasAttribute('data-like-anon'),
        url = 'https://api.lyket.dev/v1/like-buttons/' + encodeURIComponent(ns) + '/' + encodeURIComponent(id),
        state = { n: 0, liked: false }, busy = false;

    function sid() {
      try {
        var s = localStorage.getItem('lyket-session-id');
        if (!s) { s = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); localStorage.setItem('lyket-session-id', s); }
        return s;
      } catch (e) { return null; }
    }
    function req(method, path) {
      var h = { 'Accept': 'application/json', 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key };
      var s = !anon && sid(); if (s) h['x-session-id'] = s;
      return fetch(url + (path || ''), { method: method, headers: h, body: method === 'PUT' ? '{}' : undefined })
        .then(function (r) { if (!r.ok) throw new Error('lyket ' + r.status); return r.json(); })
        .then(function (j) { var a = ((j && j.data) || j || {}).attributes || {}; return { n: +a.total_likes || 0, liked: !!a.user_has_liked }; });
    }
    function paint() {
      nEl.textContent = state.n;
      wEl.textContent = state.n === 1 ? 'like' : 'likes';
      btn.setAttribute('aria-pressed', state.liked ? 'true' : 'false');
      box.classList.toggle('liked', state.liked);
    }
    function fail() {
      box.classList.add('offline'); btn.disabled = true;
      nEl.textContent = '--'; wEl.textContent = 'likes offline';
    }
    function burst() {
      if (reduced) return;
      btn.classList.remove('pop'); void btn.offsetWidth; btn.classList.add('pop');
      var f = document.createElement('span'); f.className = 'like-float'; f.textContent = '+1'; f.setAttribute('aria-hidden', 'true');
      box.appendChild(f); setTimeout(function () { f.remove(); }, 900);
    }

    req('GET').then(function (s) { state = s; btn.disabled = false; box.classList.add('ready'); paint(); }, fail);

    btn.addEventListener('click', function () {
      if (busy) return; busy = true;
      var prev = { n: state.n, liked: state.liked };
      state.liked = !state.liked; state.n = Math.max(0, state.n + (state.liked ? 1 : -1));
      paint(); if (state.liked) burst();
      req('PUT', '/press').then(function (s) { state = s; paint(); }, function () { state = prev; paint(); box.classList.add('err'); setTimeout(function () { box.classList.remove('err'); }, 1200); })
        .then(function () { busy = false; });
    });
  }

  /* ---------------- comments ---------------- */
  var thread = document.getElementById('cusdis_thread');
  if (thread) initComments(thread);

  function initComments(el) {
    var host = (el.getAttribute('data-host') || 'https://cusdis.com').replace(/\/+$/, ''),
        status = el.querySelector('[data-cm-status]'),
        theme = el.getAttribute('data-theme') || 'dark',
        heard = false, started = false;

    function say(t, cls) { if (!status) return; status.textContent = t; if (cls) el.classList.add(cls); }

    window.addEventListener('message', function (e) {
      var m; try { m = typeof e.data === 'string' ? JSON.parse(e.data) : null; } catch (x) { return; }
      if (!m || m.from !== 'cusdis') return;
      if (!heard) { heard = true; el.classList.add('cm-live'); }
      if (m.event === 'onload' && window.CUSDIS && CUSDIS.setTheme) CUSDIS.setTheme(theme);
    });

    function skin(frame) {
      /* Cusdis renders into a srcdoc iframe (same origin as this page), so we can add
         a small stylesheet for fonts/edges. Best effort: silently skipped if it fails. */
      try {
        var d = frame.contentDocument; if (!d || !d.head || d.getElementById('brave-skin')) return;
        var fonts = new URL('/fonts/', location.href).href;
        var st = d.createElement('style'); st.id = 'brave-skin';
        st.textContent =
          '@font-face{font-family:"IBM Plex Mono";font-weight:400;src:url(' + fonts + 'ibm-plex-mono-latin-400-normal.woff2) format("woff2")}' +
          '@font-face{font-family:"IBM Plex Mono";font-weight:700;src:url(' + fonts + 'ibm-plex-mono-latin-700-normal.woff2) format("woff2")}' +
          ':root{color-scheme:dark}html,body{background:transparent!important;color:#e9e6dc;font-family:"IBM Plex Mono",ui-monospace,monospace!important}' +
          '*{border-radius:0!important;font-family:inherit!important}' +
          'input,textarea{background:#121211!important;color:#e9e6dc!important;border:1px solid #3a3833!important}' +
          'input:focus,textarea:focus{outline:1px solid #c6ff00!important;border-color:#c6ff00!important}' +
          'button{background:#c6ff00!important;color:#0b0b0a!important;border:0!important;text-transform:uppercase;letter-spacing:.06em}' +
          'a{color:#c6ff00!important}';
        d.head.appendChild(st);
      } catch (x) {}
    }

    function start() {
      if (started) return; started = true;
      say('> connecting to comment server' + '…');
      var s = document.createElement('script');
      s.src = host + '/js/cusdis.es.js'; s.async = true;
      s.onerror = function () { say('> [ERR] comment server unreachable. try again later.', 'cm-error'); };
      s.onload = function () {
        var f = el.querySelector('iframe');
        if (f) { f.setAttribute('title', 'Comments'); f.setAttribute('loading', 'lazy'); f.addEventListener('load', function () { skin(f); }); skin(f); }
      };
      document.body.appendChild(s);
      setTimeout(function () {
        if (heard) return;
        var f = el.querySelector('iframe'); if (f) f.style.display = 'none';
        el.insertAdjacentHTML('afterbegin', '<p class="cm-status cm-error-msg">&gt; [ERR] comment server did not answer. try again later.</p>');
        el.classList.add('cm-error');
      }, 9000);
    }

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (es) {
        if (es.some(function (x) { return x.isIntersecting; })) { io.disconnect(); start(); }
      }, { rootMargin: '600px 0px' });
      io.observe(el);
    } else start();
  }
})();
