/* brave.js v4 — dependency-free motion for the zine theme.
   boot intro · page wipes · ASCII logo (decrypt, glitch, pointer scramble) ·
   reactive ASCII field · custom cursor · magnetic hover · scroll reveals ·
   progress bar · parallax · code/table/heading reveals · live clock.
   Entirely skipped under prefers-reduced-motion (content is always in the HTML). */
(function () {
  'use strict';
  var root = document.documentElement;
  if (root.classList.contains('reduced') || !root.classList.contains('js')) return;

  var GLYPHS = '!<>-_\\/[]{}=+*^?#%&$@01';
  var LOGO_GLYPHS = '/\\|_-=+#<>01';
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var raf = window.requestAnimationFrame.bind(window);
  var pointer = { x: -9999, y: -9999, active: false };
  function rnd(s) { return s.charAt((Math.random() * s.length) | 0); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return [].slice.call((c || document).querySelectorAll(s)); }
  function mk(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html) e.innerHTML = html; return e; }

  /* ---------- text scramble (works on an element's main text node) ---------- */
  function textNode(el) {
    if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) return el.firstChild;
    var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n, best = null;
    while ((n = w.nextNode())) if (!best || n.nodeValue.trim().length > best.nodeValue.trim().length) best = n;
    return best;
  }
  function scramble(el, o) {
    o = o || {};
    var node = textNode(el); if (!node) return;
    if (node._scr) cancelAnimationFrame(node._scr);
    var fin = node._final != null ? node._final : (node._final = node.nodeValue);
    var g = o.glyphs || GLYPHS, dur = o.duration || 700, sp = o.spread == null ? 0.6 : o.spread, q = [];
    for (var i = 0; i < fin.length; i++) {
      var st = Math.random() * dur * sp;
      q.push({ c: fin.charAt(i), s: st, e: st + dur * (1 - sp) * (0.35 + Math.random() * 0.65) });
    }
    var t0 = performance.now();
    (function f(now) {
      var t = now - t0, out = '', done = 0;
      for (var k = 0; k < q.length; k++) {
        var c = q[k];
        if (c.c === ' ' || c.c === '\n' || t >= c.e) { out += c.c; done++; }
        else if (t >= c.s) out += rnd(g);
        else out += o.hide ? ' ' : c.c;
      }
      node.nodeValue = out;
      if (done < q.length) node._scr = raf(f);
      else { node.nodeValue = fin; node._scr = null; if (o.done) o.done(); }
    })(t0);
  }
  function typeIn(el, speed, done) {
    var node = textNode(el); if (!node) return;
    var fin = node._final != null ? node._final : (node._final = node.nodeValue), n = 0;
    el.classList.add('typing');
    (function tick() {
      node.nodeValue = fin.slice(0, ++n);
      if (n < fin.length) setTimeout(tick, speed + Math.random() * speed);
      else { el.classList.remove('typing'); if (done) done(); }
    })();
  }

  /* ---------- boot intro (first page of a session) ---------- */
  function boot() {
    return new Promise(function (resolve) {
      if (!root.classList.contains('booting')) return resolve(false);
      try { sessionStorage.setItem('brave-booted', '1'); } catch (e) {}
      var posts = ($('meta[name="brave-posts"]') || {}).content || '0';
      var lines = [
        'brave-boot 4.0.0 (tty1) — press any key to skip',
        '',
        '[ ok ] probing hardware .............. done',
        '[ ok ] seeding entropy pool .......... 4096 bits',
        '[ ok ] mounting /writeups ............ ' + ('00' + posts).slice(-3) + ' entries',
        '[ ok ] loading payloads .............. xss idor ssrf',
        '[ ok ] loading wordlists ............. 1.2M lines',
        '[warn] waf detected .................. ignoring',
        '[ ok ] starting proxy on 127.0.0.1:8080',
        '[ ok ] decrypting index',
        '[ ok ] spawning shell for brave@bounty',
        '',
        '> exec ./brave --zine'
      ];
      var scr = mk('div', 'boot-screen'), log = mk('pre', 'boot-log'), bar = mk('div', 'boot-bar', '<i></i>');
      scr.appendChild(log); scr.appendChild(bar); document.body.appendChild(scr);
      var i = 0, ended = false, timer;
      function end() {
        if (ended) return; ended = true; clearTimeout(timer);
        window.removeEventListener('keydown', end); scr.removeEventListener('click', end);
        scr.classList.add('out'); root.classList.remove('booting');
        setTimeout(function () { scr.remove(); }, 650);
        setTimeout(function () { resolve(true); }, 180);
      }
      window.addEventListener('keydown', end); scr.addEventListener('click', end);
      (function next() {
        if (i >= lines.length) { timer = setTimeout(end, 260); return; }
        var l = lines[i++], d = mk('div', l.indexOf('[warn]') === 0 ? 'warn' : l.indexOf('>') === 0 ? 'cmd' : '');
        d.textContent = l || ' '; log.appendChild(d);
        bar.firstChild.style.transform = 'scaleX(' + (i / lines.length) + ')';
        timer = setTimeout(next, 55 + Math.random() * 55);
      })();
    });
  }

  /* ---------- page wipe on internal navigation ---------- */
  function wipes() {
    document.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('a[href]');
      if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target && a.target !== '_self') return;
      var url = new URL(a.href, location.href);
      if (url.origin !== location.origin || a.hasAttribute('download')) return;
      if (url.pathname === location.pathname && url.hash) return;
      if (/\.(xml|json|txt|pdf|png|jpg|webp|zip)$/i.test(url.pathname)) return;
      e.preventDefault();
      var w = mk('div', 'wipe'), lab = mk('span', 'wipe-label');
      lab.textContent = '> cd ~/brave' + url.pathname;
      w.appendChild(lab); document.body.appendChild(w);
      try { sessionStorage.setItem('brave-wipe', '1'); } catch (er) {}
      raf(function () { w.classList.add('go'); });
      setTimeout(function () { location.href = url.href; }, 380);
    });
    window.addEventListener('pageshow', function (e) { if (e.persisted) $$('.wipe').forEach(function (w) { w.remove(); }); });
  }

  /* ---------- ASCII logo: decrypt, periodic glitch, pointer scramble ---------- */
  function Logo(pre) {
    var base = pre.textContent.split('\n'), rows = base.length, cols = 0;
    base.forEach(function (l) { cols = Math.max(cols, l.length); });
    pre.textContent = '';
    var spans = base.map(function (l) { var s = mk('span', 'll'); s.textContent = l; pre.appendChild(s); return s; });
    var disp = base.map(function (l) { return l.split(''); });
    var until = base.map(function (l) { return new Array(l.length).fill(0); }); // scramble-until per char
    var resolveAt = null, t0 = 0, nextGlitch = performance.now() + 2600, glitchEnd = 0, dirty = true;

    this.decrypt = function () {
      t0 = performance.now();
      resolveAt = base.map(function (l) {
        return l.split('').map(function (c, x) { return c === ' ' ? 0 : 200 + x * 26 + Math.random() * 700; });
      });
      pre.classList.add('decrypting');
    };
    function glitch(now) {
      var n = 1 + ((Math.random() * 2) | 0);
      for (var k = 0; k < n; k++) {
        var r = (Math.random() * rows) | 0;
        spans[r].style.transform = 'translate3d(' + ((Math.random() < .5 ? -1 : 1) * (6 + Math.random() * 18)) + 'px,0,0)';
        spans[r].classList.add('hot');
        for (var x = 0; x < base[r].length; x++) if (base[r][x] !== ' ' && Math.random() < .35) until[r][x] = now + 140;
      }
      pre.classList.add('glitch');
      glitchEnd = now + 150 + Math.random() * 90;
      nextGlitch = now + 2800 + Math.random() * 2400;
    }
    this.poke = function (px, py, now) {
      var r = pre.getBoundingClientRect();
      if (px < r.left - 40 || px > r.right + 40 || py < r.top - 30 || py > r.bottom + 30) return;
      var cw = r.width / cols, lh = r.height / rows;
      var cx = (px - r.left) / cw, cy = (py - r.top) / lh;
      for (var y = 0; y < rows; y++) for (var x = 0; x < base[y].length; x++) {
        if (base[y][x] === ' ') continue;
        var dx = (x - cx) / 4.2, dy = (y - cy) / 1.4;
        if (dx * dx + dy * dy < 1) until[y][x] = Math.max(until[y][x], now + 90 + Math.random() * 220);
      }
    };
    this.tick = function (now) {
      if (resolveAt == null) return;
      if (now >= nextGlitch) glitch(now);
      if (glitchEnd && now >= glitchEnd) {
        glitchEnd = 0; pre.classList.remove('glitch');
        spans.forEach(function (s) { s.style.transform = ''; s.classList.remove('hot'); });
      }
      var t = now - t0, resolving = false;
      for (var y = 0; y < rows; y++) {
        var line = disp[y], changed = false;
        for (var x = 0; x < line.length; x++) {
          var c = base[y][x], want;
          if (c === ' ') continue;
          if (t < resolveAt[y][x]) { want = t < resolveAt[y][x] - 600 * Math.random() - 150 ? ' ' : rnd(LOGO_GLYPHS); resolving = true; }
          else if (now < until[y][x]) want = Math.random() < .5 ? rnd(LOGO_GLYPHS) : line[x];
          else want = c;
          if (want !== line[x]) { line[x] = want; changed = true; }
        }
        if (changed || dirty) spans[y].textContent = line.join('');
      }
      dirty = false;
      if (!resolving) pre.classList.remove('decrypting');
    };
  }

  /* ---------- reactive ASCII field ---------- */
  function Field(canvas, host) {
    var ctx = canvas.getContext('2d'), RAMP = ' .,:;-~=+*#%@';
    var dpr = Math.min(window.devicePixelRatio || 1, 2), W = 0, H = 0, cell = 14, cw = 8.7, cols = 0, rows = 0;
    var t = Math.random() * 100, last = 0, ripples = [], rect = null;
    function size() {
      var r = canvas.getBoundingClientRect(); W = r.width; H = r.height;
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cell = W < 600 ? 13 : 15; cw = cell * 0.6;
      cols = Math.ceil(W / cw); rows = Math.ceil(H / cell);
      ctx.font = '500 ' + (cell - 2) + 'px "IBM Plex Mono", monospace'; ctx.textBaseline = 'top';
    }
    size(); window.addEventListener('resize', size);
    host.addEventListener('pointerdown', function (e) { var r = canvas.getBoundingClientRect(); ripples.push({ x: e.clientX - r.left, y: e.clientY - r.top, t: performance.now() }); });
    var auto = 0;
    this.tick = function (now) {
      if (now - last < 33) return;              // ~30fps is plenty for glyphs
      last = now; t += 0.05; rect = canvas.getBoundingClientRect();
      if (now - auto > 3200 && !pointer.active) { auto = now; ripples.push({ x: W * (.25 + Math.random() * .6), y: H * (.15 + Math.random() * .4), t: now }); }
      ripples = ripples.filter(function (r) { return now - r.t < 2200; });
      var px = pointer.x - rect.left, py = pointer.y - rect.top, R = fine ? 150 : 0;
      ctx.clearRect(0, 0, W, H);
      for (var y = 0; y < rows; y++) {
        var yy = y * cell, fade = 1 - clamp((yy / H - .4) / .35, 0, 1);  // fade toward bottom
        if (fade <= 0) continue;
        for (var x = 0; x < cols; x++) {
          var xx = x * cw;
          var v = Math.sin(x * 0.07 + t) + Math.sin(y * 0.19 - t * 0.8) + Math.sin((x - y) * 0.045 + t * 0.6)
                + Math.sin(Math.sqrt(x * x * 0.5 + y * y * 2.4) * 0.11 - t * 1.25);
          v = (v + 4) / 8;
          var hot = 0;
          for (var k = 0; k < ripples.length; k++) {   // expanding rings
            var rp = ripples[k], age = (now - rp.t) / 1000, dd = Math.hypot(xx - rp.x, yy - rp.y) - age * 520;
            if (dd > -26 && dd < 26) { var a = (1 - Math.abs(dd) / 26) * (1 - age / 2.2); v += a * .45; hot = Math.max(hot, a * .8); }
          }
          if (R) { var d = Math.hypot(xx - px, yy - py); if (d < R) { var f = 1 - d / R; v += f * .5; hot = Math.max(hot, f); } }
          if (v < 0.5) continue;
          var idx = Math.min(RAMP.length - 1, ((v - 0.5) / 0.5 * RAMP.length) | 0);
          if (hot > .18) { ctx.fillStyle = 'rgba(198,255,0,' + (hot * .9 * fade).toFixed(2) + ')'; ctx.fillText(hot > .7 ? rnd('01#$/\\') : RAMP.charAt(idx), xx, yy); }
          else { ctx.fillStyle = 'rgba(233,230,220,' + ((0.045 + (v - 0.5) * 0.26) * fade).toFixed(3) + ')'; ctx.fillText(RAMP.charAt(idx), xx, yy); }
        }
      }
    };
  }

  /* ---------- custom cursor ---------- */
  function Cursor() {
    var dot = mk('div', 'cur-dot'), ring = mk('div', 'cur-ring', '<span></span>');
    document.body.appendChild(ring); document.body.appendChild(dot);
    root.classList.add('has-cursor');
    var rx = -100, ry = -100, label = ring.firstChild, state = '';
    document.addEventListener('pointermove', function (e) {
      if (e.pointerType !== 'mouse') return;
      var tgt = e.target.closest ? e.target : null;
      var s = tgt && tgt.closest('.row') ? 'row' : tgt && tgt.closest('a, button, summary, input, [role=button]') ? 'link' : '';
      if (s !== state) { state = s; ring.className = 'cur-ring' + (s ? ' is-' + s : ''); dot.className = 'cur-dot' + (s ? ' is-' + s : ''); label.textContent = s === 'row' ? 'open' : ''; }
    });
    document.addEventListener('pointerdown', function () { ring.classList.add('down'); });
    document.addEventListener('pointerup', function () { ring.classList.remove('down'); });
    document.addEventListener('mouseleave', function () { dot.style.opacity = ring.style.opacity = 0; });
    document.addEventListener('mouseenter', function () { dot.style.opacity = ring.style.opacity = ''; });
    this.tick = function () {
      rx += (pointer.x - rx) * 0.18; ry += (pointer.y - ry) * 0.18;
      dot.style.transform = 'translate3d(' + pointer.x + 'px,' + pointer.y + 'px,0)';
      ring.style.transform = 'translate3d(' + rx + 'px,' + ry + 'px,0)';
    };
  }

  /* ---------- magnetic hover ---------- */
  function magnetic(sel, k, max) {
    $$(sel).forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        if (e.pointerType !== 'mouse') return;
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', clamp((e.clientX - (r.left + r.width / 2)) * k, -max, max).toFixed(1) + 'px');
        el.style.setProperty('--my', clamp((e.clientY - (r.top + r.height / 2)) * k, -max, max).toFixed(1) + 'px');
      });
      el.addEventListener('pointerleave', function () { el.style.setProperty('--mx', '0px'); el.style.setProperty('--my', '0px'); });
    });
  }

  /* ---------- scroll-driven reveals ---------- */
  function observe(sel, fn, opts) {
    var els = $$(sel); if (!els.length) return;
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { fn(e); }); return; }
    var io = new IntersectionObserver(function (en) {
      en.forEach(function (x) { if (x.isIntersecting) { io.unobserve(x.target); fn(x.target); } });
    }, opts || { rootMargin: '0px 0px -10% 0px', threshold: 0.12 });
    els.forEach(function (e) { io.observe(e); });
  }

  /* ---------- homepage synopsis typing ---------- */
  function shell(box) {
    var lines = $$('.sh-line', box); lines.forEach(function (l) { l.classList.add('sh-hidden'); });
    var i = 0;
    (function next() {
      if (i >= lines.length) return;
      var line = lines[i++]; line.classList.remove('sh-hidden');
      var cmd = $('.sh-cmd', line);
      if (!cmd) { line.classList.add('sh-pop'); setTimeout(next, 160); return; }
      var text = cmd.getAttribute('data-type'), n = 0; cmd.textContent = ''; line.classList.add('typing');
      (function tick() {
        cmd.textContent = text.slice(0, ++n);
        if (n < text.length) setTimeout(tick, 40 + Math.random() * 40);
        else setTimeout(function () { line.classList.remove('typing'); next(); }, 220);
      })();
    })();
  }

  /* ---------- init ---------- */
  function init() {
    root.classList.add('motion');
    wipes();

    // progress bar (scroll on lists, reading progress on posts)
    var prog = mk('div', 'progress', '<i></i>'); document.body.appendChild(prog);
    var article = $('.post-single.is-writeup .post-content');

    // live clock in the man-page header
    var clock = $('.clock');
    if (clock) {
      var tz = ''; try { tz = new Intl.DateTimeFormat('en', { timeZoneName: 'short' }).formatToParts(new Date()).filter(function (p) { return p.type === 'timeZoneName'; })[0].value; } catch (e) {}
      var upd = function () { var d = new Date(); clock.textContent = '· ' + d.toTimeString().slice(0, 8) + (tz ? ' ' + tz : ''); };
      upd(); setInterval(upd, 1000);
    }

    // pre-hide things that will type/scramble in
    $$('[data-typein]').forEach(function (el) { var n = textNode(el); if (n) { n._final = n.nodeValue; n.nodeValue = ''; } });

    var logoEl = $('.ascii-logo'), logo = logoEl ? new Logo(logoEl) : null;
    var hero = $('.hero'), canvas = $('canvas.noise');
    var field = canvas && canvas.getContext ? new Field(canvas, hero) : null;
    var cursor = fine ? new Cursor() : null;
    var heroVisible = true, tag = $('.hero-tag');
    if (hero && 'IntersectionObserver' in window) new IntersectionObserver(function (e) { heroVisible = e[0].isIntersecting; }).observe(hero);

    document.addEventListener('pointermove', function (e) {
      pointer.x = e.clientX; pointer.y = e.clientY;
      pointer.active = !!(hero && e.target.closest && e.target.closest('.hero'));
      if (logo && e.pointerType === 'mouse') logo.poke(e.clientX, e.clientY, performance.now());
    }, { passive: true });

    // single rAF loop; the browser already pauses rAF in hidden tabs, we also bail explicitly
    var lastY = -1;
    (function loop(now) {
      raf(loop);
      if (document.hidden) return;
      if (cursor) cursor.tick();
      var y = window.scrollY;
      if (y !== lastY) {
        lastY = y;
        var h = document.documentElement.scrollHeight - innerHeight, p = h > 0 ? y / h : 0;
        if (article) { var r = article.getBoundingClientRect(); p = clamp((innerHeight * .35 - r.top) / r.height, 0, 1); }
        prog.firstChild.style.transform = 'scaleX(' + p.toFixed(4) + ')';
        if (logoEl && y < innerHeight * 1.2) {          // parallax
          var fadeOut = clamp(1 - y / (innerHeight * .75), 0, 1).toFixed(3);
          logoEl.style.transform = 'translate3d(' + (-y * 0.06).toFixed(1) + 'px,' + (-y * 0.22).toFixed(1) + 'px,0)';
          logoEl.style.opacity = y > 0 ? fadeOut : '';
          if (tag) { tag.style.transform = 'translate3d(' + (y * 0.05).toFixed(1) + 'px,' + (-y * 0.1).toFixed(1) + 'px,0)'; tag.style.opacity = y > 0 ? fadeOut : ''; }
        }
      }
      if (heroVisible) { if (field) field.tick(now); if (logo) logo.tick(now); }
    })(performance.now());

    // nav: scramble + magnetic; rows: magnetic + title scramble
    $$('#menu a').forEach(function (a) {
      var n = textNode(a); if (n) n._final = n.nodeValue;
      a.addEventListener('mouseenter', function () { scramble(a, { duration: 380, spread: .4 }); });
    });
    if (fine) { magnetic('#menu a', .35, 8); magnetic('.row', .04, 10); magnetic('.post-content .links a', .05, 6); }
    $$('.row').forEach(function (row) {
      var a = $('[data-scramble="hover"]', row); if (!a) return;
      row.addEventListener('mouseenter', function () { scramble(a, { duration: 450, spread: .5 }); });
    });

    // copy button confirmation
    document.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('.copy-code'); if (!b) return;
      b.classList.remove('ok'); void b.offsetWidth; b.classList.add('ok');
      setTimeout(function () { b.classList.remove('ok'); }, 1800);
    });

    // scroll reveals
    $$('.row').forEach(function (r, i) { r.style.setProperty('--i', i % 6); });
    observe('.reveal', function (el) { el.classList.add('in'); });
    observe('[data-typein]', function (el) { el.classList.add('in'); setTimeout(function () { typeIn(el, 55); }, 120); });
    observe('.post-content h2, .post-content h3', function (el) { el.classList.add('in'); scramble(el, { duration: 650, spread: .55, hide: true }); });
    observe('.codeblock', function (el) { el.classList.add('in'); }, { rootMargin: '0px 0px -12% 0px', threshold: 0.2 });
    observe('.post-content table', function (el) {
      $$('tr', el).forEach(function (tr, i) { tr.style.setProperty('--i', i); }); el.classList.add('in');
    });
    observe('.finding-card, .example-banner, .post-footer, .post-content .links li, .terms-tags li, .archive-entry, #searchbox', function (el) { el.classList.add('in'); });

    // hero sequence starts after the boot screen / page wipe
    boot().then(function (booted) {
      var delay = booted ? 0 : root.classList.contains('wipe-in') ? 260 : 60;
      setTimeout(function () {
        root.classList.add('hero-go');
        if (logo) logo.decrypt();
        $$('[data-scramble="load"]').forEach(function (el, i) { scramble(el, { duration: 1000 + i * 200, spread: .6, hide: true }); });
        var sh = $('#sh'); if (sh) setTimeout(function () { shell(sh); }, 1000);
      }, delay);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
