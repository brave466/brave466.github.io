/* brave — tiny terminal typing effect (no deps). Content is pre-rendered in HTML,
   so it works without JS and with prefers-reduced-motion (shown instantly). */
(function () {
  var body = document.getElementById('terminal-body');
  if (!body) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var lines = Array.prototype.slice.call(body.querySelectorAll('.t-line'));
  body.classList.add('is-typing');
  lines.forEach(function (l) { l.classList.add('t-hidden'); });

  var CHAR_MS = 55, CMD_PAUSE = 350, OUT_PAUSE = 260;
  var i = 0;

  function next() {
    if (i >= lines.length) { body.classList.remove('is-typing'); body.classList.add('is-done'); return; }
    var line = lines[i++];
    line.classList.remove('t-hidden');
    var typed = line.querySelector('.t-typed');
    if (!typed) { setTimeout(next, OUT_PAUSE); return; }
    var text = typed.getAttribute('data-type') || typed.textContent;
    typed.textContent = '';
    line.classList.add('t-active');
    var n = 0;
    (function tick() {
      typed.textContent = text.slice(0, ++n);
      if (n < text.length) setTimeout(tick, CHAR_MS + Math.random() * 40);
      else setTimeout(function () { line.classList.remove('t-active'); next(); }, CMD_PAUSE);
    })();
  }
  setTimeout(next, 500);
})();
