/* main.js: slab corners, project rows, the reel (screens + videos), the copy button and
   the footer year. No dependencies. */
(function () {
  'use strict';
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  /* Slab corners: each green section's corner radius follows its edge's distance from the
     viewport edge (capped at MAX), eased per frame and written to --r-top / --r-bottom. */
  var MAX = 80, EASE = reduce ? 1 : 0.16;
  var slabs = ['about', 'contact'].map(function (id) { return document.getElementById(id); }).filter(Boolean)
    .map(function (el) { el.classList.add('slab'); return { el: el, t: -1, b: -1, tt: 0, tb: 0 }; });
  var slabRaf = 0, slabLast = 0;
  function clamp(v) { return v < 0 ? 0 : v > MAX ? MAX : v; }
  function slabTick(now) {
    slabRaf = 0;
    var dt = slabLast && now ? Math.min(3, (now - slabLast) / 16.667) : 1, k = EASE >= 1 ? 1 : 1 - Math.pow(1 - EASE, dt), moving = false;
    slabLast = now || 0;
    slabs.forEach(function (x) {
      var r = x.el.getBoundingClientRect();
      x.tt = clamp(r.top); x.tb = clamp(window.innerHeight - r.bottom);
      if (x.t < 0) { x.t = x.tt; x.b = x.tb; }
      x.t += (x.tt - x.t) * k; x.b += (x.tb - x.b) * k;
      if (Math.abs(x.tt - x.t) < 0.1) x.t = x.tt; else moving = true;
      if (Math.abs(x.tb - x.b) < 0.1) x.b = x.tb; else moving = true;
      x.el.style.setProperty('--r-top', x.t.toFixed(2) + 'px');
      x.el.style.setProperty('--r-bottom', x.b.toFixed(2) + 'px');
    });
    if (moving) slabRaf = requestAnimationFrame(slabTick); else slabLast = 0;
  }
  function slabKick() { if (!slabRaf) slabRaf = requestAnimationFrame(slabTick); }
  window.addEventListener('scroll', slabKick, { passive: true });
  window.addEventListener('resize', slabKick);
  window.addEventListener('load', slabKick);
  // A row opening changes the page height: measure again while it animates.
  if (window.ResizeObserver) { var slabRo = new ResizeObserver(slabKick); slabs.forEach(function (x) { slabRo.observe(x.el); }); }
  slabTick();

  /* Reel: sideways screen scroller with generated dots. A video's dot doubles as its
     play/pause control; videos pause when mostly hidden and rewind when left. */
  var PLAY_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4L13 8z" fill="currentColor"/></svg>';
  var PAUSE_SVG = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 3h3v10H4zM9 3h3v10H9z" fill="currentColor"/></svg>';
  function toggleVideo(v) { if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); } else v.pause(); }
  document.querySelectorAll('.reel__screens').forEach(function (box) {
    var frame = box.querySelector('.reel__frame');
    var shots = [].slice.call(box.querySelectorAll('.reel__shot'));
    var panel = box.closest('.proj__panel');
    var h3 = box.closest('.proj') && box.closest('.proj').querySelector(':scope > h3');
    if (!frame || shots.length < 2) return;
    var idx = -1, raf = 0, playWhenThere = -1;
    function goTo(i) { frame.scrollTo({ left: shots[i].offsetLeft, behavior: reduce ? 'auto' : 'smooth' }); }
    var list = document.createElement('ol');
    list.className = 'reel__dots';
    var dots = shots.map(function (s, i) {
      var li = document.createElement('li'), dot = document.createElement('button');
      var v = s.querySelector('video');
      dot.className = 'reel__dot' + (v ? ' reel__dot--video' : ''); dot.type = 'button';
      dot.setAttribute('aria-label', v ? 'Play video (screen ' + (i + 1) + ' of ' + shots.length + ')' : 'Show screen ' + (i + 1) + ' of ' + shots.length);
      dot.addEventListener('click', function () {
        if (!v) goTo(i);
        else if (i === idx) toggleVideo(v);
        else { playWhenThere = i; goTo(i); }
      });
      s.addEventListener('click', function () {
        if (i !== idx) goTo(i);
        else if (v) toggleVideo(v);
      });
      li.appendChild(dot); list.appendChild(li);
      return dot;
    });
    box.appendChild(list);
    shots.forEach(function (s, i) {
      var v = s.querySelector('video');
      if (!v) return;
      v.controls = false;
      var dot = dots[i], play = document.createElement('button'), tick = 0;
      play.className = 'reel__play'; play.type = 'button';
      play.setAttribute('aria-label', 'Play demo video');
      play.innerHTML = '<span class="reel__cue" aria-hidden="true">' + PLAY_SVG + PAUSE_SVG + '</span>';
      function progress() {
        var p = v.duration ? v.currentTime / v.duration : 0;
        dot.style.setProperty('--p', p.toFixed(4));
        dot.toggleAttribute('data-started', p > 0);
        if (!v.paused) tick = requestAnimationFrame(progress); else tick = 0;
      }
      function label(word) {
        play.setAttribute('aria-label', word + ' demo video');
        dot.setAttribute('aria-label', word + ' video (screen ' + (i + 1) + ' of ' + shots.length + ')');
      }
      v.addEventListener('play', function () { s.setAttribute('data-playing', ''); dot.setAttribute('data-playing', ''); label('Pause'); if (!tick) progress(); });
      v.addEventListener('pause', function () { s.removeAttribute('data-playing'); dot.removeAttribute('data-playing'); label('Play'); progress(); });
      v.addEventListener('seeked', progress);
      s.appendChild(play); // its clicks bubble to the screen's own click handler above
    });
    function current() {
      var pos = frame.scrollLeft, max = frame.scrollWidth - frame.clientWidth;
      if (pos >= max - 2) return shots.length - 1;
      var best = 0, d = Infinity;
      shots.forEach(function (s, i) { var x = Math.abs(s.offsetLeft - pos); if (x < d) { d = x; best = i; } });
      return best;
    }
    // Share of the box that's on screen and not under the header + sticky toggle.
    function shown() {
      var r = frame.getBoundingClientRect();
      var top = h3 ? Math.max(0, h3.getBoundingClientRect().bottom) : 0;
      return r.height ? Math.max(0, Math.min(r.bottom, window.innerHeight) - Math.max(r.top, top)) / r.height : 0;
    }
    function update() {
      raf = 0;
      idx = current();
      var open = !panel || panel.hasAttribute('data-open'), seen = open ? shown() : 0;
      dots.forEach(function (d, i) { if (i === idx) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current'); });
      shots.forEach(function (s, i) {
        s.setAttribute('data-state', i === idx ? 'active' : i === idx + 1 ? 'next' : 'idle');
        var v = s.querySelector('video');
        if (!v) return;
        var here = i === idx && seen > 0;
        if (here && playWhenThere === i) { playWhenThere = -1; if (v.paused) toggleVideo(v); }
        if (!v.paused && (!here || seen < 0.5)) v.pause();
        if (!here && v.currentTime > 0) v.currentTime = 0;
      });
    }
    function kick() { if (!raf) raf = requestAnimationFrame(update); }
    frame.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('scroll', kick, { passive: true });
    window.addEventListener('resize', kick);
    box._reelUpdate = update;
    update();
  });
  function updateReels(panel) {
    panel.querySelectorAll('.reel__screens').forEach(function (b) { if (b._reelUpdate) b._reelUpdate(); });
  }

  /* Project rows: click to open or close (any number can be open).
     Once a row has finished opening it stops clipping (data-settled). */
  document.querySelectorAll('button.proj__toggle').forEach(function (btn) {
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (!panel) return;
    var timer = 0;
    function settle() { clearTimeout(timer); if (panel.hasAttribute('data-open')) { panel.setAttribute('data-settled', ''); updateReels(panel); } }
    panel.addEventListener('transitionend', function (e) { if (e.target === panel && e.propertyName === 'grid-template-rows') settle(); });
    /* Closing a tall row shrinks the page and the browser would clamp the scroll (a visible
       jump), so first scroll to where the pinned toggle will rest after closing. */
    function closeWithoutJump() {
      var h3 = btn.closest('h3'), li = btn.closest('.proj');
      if (h3 && li) {
        var stickyTop = parseFloat(getComputedStyle(h3).top) || 0;
        var h3Rect = h3.getBoundingClientRect();
        if (h3Rect.top <= stickyTop + 1) {
          // A pinned h3 always reports stickyTop, so measure from the <li>.
          // 'instant' overrides the page's smooth scrolling during the close animation.
          var liRect = li.getBoundingClientRect();
          window.scrollTo({ top: window.pageYOffset + liRect.top - stickyTop, left: 0, behavior: 'instant' });
        }
      }
      panel.removeAttribute('data-settled');
      panel.removeAttribute('data-open');
      updateReels(panel);
    }
    btn.addEventListener('click', function () {
      var open = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', open ? 'false' : 'true');
      clearTimeout(timer);
      if (open) { closeWithoutJump(); }
      else { panel.setAttribute('data-open', ''); if (reduce) settle(); else timer = setTimeout(settle, 700); }
    });
  });

  /* Copy email */
  document.querySelectorAll('[data-copy]').forEach(function (btn) {
    var label = btn.querySelector('[data-copy-label]') || btn;
    var original = label.textContent, timer = 0;
    function done() { label.textContent = 'Copied'; clearTimeout(timer); timer = setTimeout(function () { label.textContent = original; }, 1800); }
    function fallback(text) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { if (document.execCommand('copy')) done(); } catch (err) {}
      document.body.removeChild(ta);
    }
    btn.setAttribute('aria-live', 'polite');
    btn.addEventListener('click', function () {
      var text = btn.getAttribute('data-copy');
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallback(text); });
      else fallback(text);
    });
  });

  var year = document.getElementById('year');
  if (year) year.textContent = new Date().getFullYear();
})();