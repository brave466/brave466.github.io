/* brave.js — tiny, dependency-free motion for the zine theme.
   - text scramble/decrypt (hero logo, tagline, post titles, row titles on hover)
   - ASCII noise field on the homepage hero (canvas, ~12fps, pauses when hidden)
   - synopsis typing
   - staggered reveal of index rows (IntersectionObserver)
   Everything is skipped under prefers-reduced-motion; content is always in the HTML. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  if (reduce) { root.classList.add('reduced'); return; }

  var GLYPHS = '!<>-_\\/[]{}=+*^?#%&$@01';
  var LOGO_GLYPHS = '/\\|_-.,`\'<>';
  function rnd(s) { return s.charAt(Math.floor(Math.random() * s.length)); }

  /* ---------- scramble ---------- */
  function scramble(el, opts) {
    opts = opts || {};
    if (el._scr) cancelAnimationFrame(el._scr);
    var final = el._final || (el._final = el.textContent);
    var glyphs = opts.glyphs || GLYPHS;
    var dur = opts.duration || 700, spread = opts.spread || 0.6;
    var q = [];
    for (var i = 0; i < final.length; i++) {
      var ch = final.charAt(i);
      var start = Math.random() * dur * spread;
      q.push({ ch: ch, start: start, end: start + dur * (1 - spread) * (0.4 + Math.random() * 0.6) });
    }
    var t0 = performance.now();
    el.classList.add('scrambling');
    (function frame(now) {
      var t = now - t0, out = '', done = 0;
      for (var k = 0; k < q.length; k++) {
        var c = q[k];
        if (c.ch === ' ' || c.ch === '\n') { out += c.ch; done++; }
        else if (t >= c.end) { out += c.ch; done++; }
        else if (t >= c.start) { out += rnd(glyphs); }
        else { out += opts.hideUntilStart ? ' ' : c.ch; }
      }
      el.textContent = out;
      if (done < q.length) el._scr = requestAnimationFrame(frame);
      else { el.textContent = final; el.classList.remove('scrambling'); el._scr = null; if (opts.onDone) opts.onDone(); }
    })(t0);
  }

  /* ---------- typing (synopsis) ---------- */
  function typeShell(box, delay) {
    var lines = [].slice.call(box.querySelectorAll('.sh-line'));
    lines.forEach(function (l) { l.classList.add('sh-hidden'); });
    var i = 0;
    function next() {
      if (i >= lines.length) return;
      var line = lines[i++];
      line.classList.remove('sh-hidden');
      var cmd = line.querySelector('.sh-cmd');
      if (!cmd) { setTimeout(next, 180); return; }
      var text = cmd.getAttribute('data-type'), n = 0;
      cmd.textContent = ''; line.classList.add('typing');
      (function tick() {
        cmd.textContent = text.slice(0, ++n);
        if (n < text.length) setTimeout(tick, 45 + Math.random() * 45);
        else setTimeout(function () { line.classList.remove('typing'); next(); }, 260);
      })();
    }
    setTimeout(next, delay);
  }

  /* ---------- ASCII noise field ---------- */
  function noiseField(canvas) {
    var ctx = canvas.getContext('2d');
    var RAMP = ' .,:;-~=+*#%';
    var cell = 14, cols = 0, rows = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    var running = true, last = 0, t = Math.random() * 100;
    function size() {
      var r = canvas.getBoundingClientRect();
      canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = r.width < 600 ? 12 : 14;
      cols = Math.ceil(r.width / (cell * 0.62)); rows = Math.ceil(r.height / cell);
      ctx.font = (cell - 2) + 'px "IBM Plex Mono", monospace';
      ctx.textBaseline = 'top';
    }
    function draw(now) {
      if (!running) return;
      requestAnimationFrame(draw);
      if (now - last < 80) return;            // ~12 fps is plenty
      last = now; t += 0.035;
      var w = cell * 0.62;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (var y = 0; y < rows; y++) {
        for (var x = 0; x < cols; x++) {
          var v = Math.sin(x * 0.09 + t) + Math.sin(y * 0.21 - t * 0.8) + Math.sin((x - y) * 0.05 + t * 0.6)
                + Math.sin(Math.sqrt(x * x * 0.6 + y * y * 2.2) * 0.12 - t * 1.3);
          v = (v + 4) / 8;                    // 0..1
          if (v < 0.47) continue;
          var idx = Math.min(RAMP.length - 1, Math.floor((v - 0.47) / 0.53 * RAMP.length));
          var hot = v > 0.9 && Math.random() < 0.08;
          ctx.fillStyle = hot ? 'rgba(198,255,0,.55)' : 'rgba(233,230,220,' + (0.04 + (v - 0.47) * 0.30).toFixed(3) + ')';
          ctx.fillText(hot ? rnd('01#$') : RAMP.charAt(idx), x * w, y * cell);
        }
      }
    }
    size();
    window.addEventListener('resize', size);
    document.addEventListener('visibilitychange', function () {
      running = !document.hidden;
      if (running) requestAnimationFrame(draw);
    });
    requestAnimationFrame(draw);
  }

  /* ---------- reveal on scroll ---------- */
  function reveal() {
    var items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) { items.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.1 });
    items.forEach(function (e) { io.observe(e); });
  }

  /* ---------- row hover ---------- */
  function rowHover() {
    document.querySelectorAll('.row').forEach(function (row) {
      var a = row.querySelector('[data-scramble="hover"]');
      if (!a) return;
      var busy = false;
      row.addEventListener('mouseenter', function () {
        if (busy) return; busy = true;
        scramble(a, { duration: 420, spread: 0.5, onDone: function () { busy = false; } });
      });
      // whole row is clickable
      row.addEventListener('click', function (e) { if (e.target.closest('a')) return; a.click(); });
    });
  }

  function init() {
    root.classList.add('motion');
    var logo = document.querySelector('[data-scramble="logo"]');
    if (logo) scramble(logo, { glyphs: LOGO_GLYPHS, duration: 1100, spread: 0.55, hideUntilStart: true });
    document.querySelectorAll('[data-scramble="load"]').forEach(function (el, i) {
      scramble(el, { duration: 900, spread: 0.5, hideUntilStart: true });
    });
    var sh = document.getElementById('sh');
    if (sh) typeShell(sh, 900);
    var c = document.querySelector('canvas.noise');
    if (c && c.getContext) noiseField(c);
    reveal();
    rowHover();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
