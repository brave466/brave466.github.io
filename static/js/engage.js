/* brave — like button (Lyket REST), loaded only when configured. */
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
})();
