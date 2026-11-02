/* Capa de movimiento del portfolio: GSAP + ScrollTrigger (en local, assets/js/vendor). Todo degrada a contenido visible sin JS o con reduced-motion. */
(function () {
  'use strict';
  var d = document, root = d.documentElement;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasG = !!(window.gsap && window.ScrollTrigger);
  if (hasG) { gsap.registerPlugin(ScrollTrigger); if (window.Flip) gsap.registerPlugin(Flip); }
  var lang = function () { return root.lang === 'en' ? 'en' : 'es'; };
  var T = { es: { use: 'Usar aquí', stop: 'Soltar', full: 'Pantalla completa', tab: 'Abrir en pestaña', close: 'Cerrar', prev: 'Anterior', next: 'Siguiente', live: 'Vista en vivo', hint: 'Pulsa para usar la herramienta aquí', esc: 'Esc para soltar', guide: 'Cómo funciona' }, en: { use: 'Use here', stop: 'Release', full: 'Full screen', tab: 'Open in tab', close: 'Close', prev: 'Previous', next: 'Next', live: 'Live view', hint: 'Click to use the tool here', esc: 'Esc to release', guide: 'How it works' } };
  var tr = function (k) { return T[lang()][k]; };
  var localize = function (n) { $$('[data-es]', n).forEach(function (e) { e.textContent = e.getAttribute('data-' + lang()); }); };


  /* ---------- carátula: cubre la pantalla; se abre al pulsar o deslizar hacia abajo y vuelve al subir ---------- */
  var introOn = root.classList.contains('intro-pending'), heroTl = null, cover = null, coverState = 'up', coolUntil = 0;
  var endIntro = function () { root.classList.remove('intro-pending'); if (heroTl) heroTl.play(); };
  var playIntro = function () {
    if (!hasG) return endIntro();
    cover = d.createElement('div'); cover.className = 'intro cover'; cover.setAttribute('role', 'dialog'); cover.setAttribute('aria-label', 'Carátula');
    var ringsHtml = [90, 170, 260, 370, 500].map(function (r, k) { return '<circle pathLength="1" cx="500" cy="300" r="' + r + '" style="--k:' + k + '"/>'; }).join('');
    cover.innerHTML = '<svg class="intro-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + ringsHtml +
      '<line class="ln" x1="0" y1="300" x2="1000" y2="300"/><line class="ln" x1="500" y1="0" x2="500" y2="600"/></svg>' +
      '<div class="intro-center"><p class="intro-name" aria-hidden="true"><span>Jesús Ortiz Muñoz</span></p><p class="intro-sub"><span data-es="Arquitectura y software" data-en="Architecture and software">Arquitectura y software</span></p></div>' +
      '<p class="cover-hint"><span class="cover-line" aria-hidden="true"></span><span data-es="Desliza o pulsa para entrar" data-en="Scroll or click to enter">Desliza o pulsa para entrar</span></p>' +
      '<button type="button" class="intro-skip" data-es="Entrar" data-en="Enter">Entrar</button>';
    root.appendChild(cover); localize(cover);
    d.addEventListener('langchange', function () { localize(cover); });
    var circles = $$('circle', cover), lines = $$('.ln', cover);
    circles.forEach(function (c) { c.style.strokeDasharray = 1; c.style.strokeDashoffset = 1; });
    var cTl = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
    cTl.fromTo(lines, { opacity: 0 }, { opacity: 0.6, duration: 0.6, stagger: 0.06 }, 0)
       .fromTo(circles, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, stagger: 0.08, ease: 'power2.inOut' }, 0.05)
       .fromTo('.cover .intro-name span', { yPercent: 110 }, { yPercent: 0, duration: 0.8 }, 0.3)
       .fromTo('.cover .intro-sub span', { yPercent: 110 }, { yPercent: 0, duration: 0.6 }, 0.55)
       .fromTo('.cover .cover-hint,.cover .intro-skip', { autoAlpha: 0, y: 12 }, { autoAlpha: 1, y: 0, duration: 0.7, stagger: 0.1 }, 1.0);
    var lock = function (on) { d.body.classList.toggle('is-locked', on); $$('main,.nav,.foot').forEach(function (n) { if (on) n.setAttribute('inert', ''); else n.removeAttribute('inert'); }); };
    var offY = function () { return -(innerHeight + 24); };
    var open = function () {
      if (coverState !== 'up') return; coverState = 'opening'; lock(false);
      gsap.to(cover, { y: offY(), duration: 0.95, ease: 'power4.inOut', onComplete: function () { coverState = 'down'; coolUntil = performance.now() + 800; cover.style.visibility = 'hidden'; } });
      if (heroTl) gsap.delayedCall(0.4, function () { heroTl.restart(); });
    };
    var show = function () {
      if (coverState !== 'down' || performance.now() < coolUntil) return; coverState = 'showing';
      window.scrollTo(0, 0); lock(true); cover.style.visibility = 'visible';
      gsap.fromTo(cover, { y: offY() }, { y: 0, duration: 0.8, ease: 'power3.out', onComplete: function () { coverState = 'up'; if (heroTl) heroTl.progress(0).pause(); var b = $('.intro-skip', cover); if (b) b.focus({ preventScroll: true }); } });
      cTl.restart();
    };
    /* arranque */
    root.classList.remove('intro-pending'); lock(true); cTl.play();
    var acc = 0, wt = 0, t0 = null;
    cover.addEventListener('click', open);
    addEventListener('wheel', function (e) {
      if (coverState === 'up') {
        e.preventDefault();
        if (e.deltaY > 0) { acc += e.deltaY; gsap.set(cover, { y: -Math.min(acc * 0.6, innerHeight * 0.3) }); if (acc > 90) { acc = 0; open(); } clearTimeout(wt); wt = setTimeout(function () { if (coverState === 'up') { acc = 0; gsap.to(cover, { y: 0, duration: 0.5, ease: 'power3.out' }); } }, 160); }
      } else if (coverState === 'down' && window.scrollY <= 0 && e.deltaY < -10) show();
    }, { passive: false });
    d.addEventListener('keydown', function (e) {
      if (coverState !== 'up') return;
      if (e.key === 'ArrowDown' || e.key === 'PageDown' || e.key === ' ' || e.key === 'Enter') { e.preventDefault(); open(); }
    });
    cover.addEventListener('touchstart', function (e) { t0 = { y: e.touches[0].clientY, t: Date.now() }; }, { passive: true });
    cover.addEventListener('touchmove', function (e) { if (!t0) return; var dy = t0.y - e.touches[0].clientY; if (dy > 0 && coverState === 'up') gsap.set(cover, { y: -dy }); }, { passive: true });
    cover.addEventListener('touchend', function (e) {
      if (!t0) return; var dy = t0.y - e.changedTouches[0].clientY, fast = Date.now() - t0.t < 260; t0 = null;
      if (coverState !== 'up') return;
      if (dy > innerHeight * 0.18 || (dy > 30 && fast)) { e.preventDefault(); open(); } else gsap.to(cover, { y: 0, duration: 0.5, ease: 'power3.out' });
    });
    var pull = null;
    d.addEventListener('touchstart', function (e) { pull = (coverState === 'down' && window.scrollY <= 0) ? e.touches[0].clientY : null; }, { passive: true });
    d.addEventListener('touchmove', function (e) { if (pull !== null && e.touches[0].clientY - pull > 70) { pull = null; show(); } }, { passive: true });
    var away = false;
    addEventListener('scroll', function () { var y = window.scrollY; if (y > innerHeight * 0.6) away = true; else if (away && y < 24) { away = false; show(); } }, { passive: true });
  };

  /* ---------- progreso de lectura y barra ---------- */
  (function () {
    var nav = $('.nav'); if (!nav) return;
    var bar = d.createElement('div'); bar.className = 'progress'; bar.setAttribute('aria-hidden', 'true'); bar.innerHTML = '<i></i>'; d.body.appendChild(bar);
    var fill = bar.firstChild, last = 0, ticking = false;
    function upd() {
      ticking = false;
      var y = window.scrollY, h = root.scrollHeight - innerHeight;
      fill.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, y / h) : 0) + ')';
      nav.classList.toggle('is-solid', y > 24);
      if (!d.body.classList.contains('is-locked')) nav.classList.toggle('is-hidden', y > last && y > 240);
      last = y;
    }
    addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(upd); } }, { passive: true });
    nav.addEventListener('focusin', function () { nav.classList.remove('is-hidden'); });
    upd();
  })();

  /* ---------- clases de movimiento puestas desde JS (sin JS, todo queda visible) ---------- */
        
  /* el elemento recortado no intersecta por sí mismo: se observa su contenedor */
  var groups = new Map();
  var reveal = function (t) {
    if (t.classList.contains('stagger')) $$(':scope > *', t).forEach(function (c, i) { c.style.setProperty('--i', i); });
    if (t.classList.contains('wipe') && t.parentElement && t.parentElement.classList.contains('gallery')) t.style.transitionDelay = (($$('.wipe', t.parentElement).indexOf(t) % 3) * 90) + 'ms';
    t.classList.add('in');
  };
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      (groups.get(e.target) || []).forEach(reveal); groups.delete(e.target); io.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0 }) : null;
  $$('[data-head],.wipe,.stagger').forEach(function (e) {
    if (!io) return e.classList.add('in');
    var host = e.classList.contains('stagger') ? e : (e.parentElement || e);
    if (!groups.has(host)) groups.set(host, []); groups.get(host).push(e); io.observe(host);
  });

  /* contadores con datos reales */
  $$('[data-count]').forEach(function (el) {
    var n = parseInt(el.getAttribute('data-count'), 10);
    if (!hasG || reduce) { el.textContent = n; return; }
    el.textContent = '0';
    ScrollTrigger.create({ trigger: el, start: 'top 90%', once: true, onEnter: function () { var o = { v: 0 }; gsap.to(o, { v: n, duration: 1.2, ease: 'power2.out', onUpdate: function () { el.textContent = Math.round(o.v); } }); } });
  });

  /* ---------- portada: campo de ondas + titular + lámina ---------- */
  var hero = $('.hero');
  var spawn = function () {};
  if (hero) {
    hero.classList.add('has-field');
    var cv = d.createElement('canvas'); cv.className = 'field'; cv.setAttribute('aria-hidden', 'true'); hero.insertBefore(cv, hero.firstChild);
    var ctx = cv.getContext('2d'), w = 0, h = 0, dpr = 1, SP = 28, rings = [], run = false, inView = true, ink = '#0a1522', acc = '#ff2800';
    var cs = getComputedStyle(root); ink = cs.getPropertyValue('--color-ink').trim() || ink; acc = cs.getPropertyValue('--color-accent').trim() || acc;
    var size = function () {
      var r = hero.getBoundingClientRect(); dpr = Math.min(2, devicePixelRatio || 1); w = r.width; h = r.height;
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); draw(performance.now());
    };
    var draw = function (now) {
      ctx.clearRect(0, 0, w, h);
      var cols = Math.ceil(w / SP) + 1, rws = Math.ceil(h / SP) + 1, ox = (w % SP) / 2, oy = 14;
      rings = rings.filter(function (r) { return now - r.t < r.life; });
      for (var j = 0; j < rws; j++) for (var i = 0; i < cols; i++) {
        var x = ox + i * SP, y = oy + j * SP, dx = 0, dy = 0, k = 0;
        for (var q = 0; q < rings.length; q++) {
          var r = rings[q], age = (now - r.t) / r.life, rad = (now - r.t) * r.v, ddx = x - r.x, ddy = y - r.y, dist = Math.sqrt(ddx * ddx + ddy * ddy) || 1, u = (dist - rad) / 46, a = Math.exp(-u * u) * (1 - age) * r.amp;
          if (a > 0.003) { dx += (ddx / dist) * a * 9; dy += (ddy / dist) * a * 9; k += a; }
        }
        k = Math.min(1, k);
        ctx.globalAlpha = 0.2 + k * 0.7; ctx.fillStyle = k > 0.28 ? acc : ink;
        ctx.beginPath(); ctx.arc(x + dx, y + dy, 1 + k * 1.9, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    };
    var loop = function (now) {
      if (!run) return;
      draw(now);
      if (rings.length || inView) requestAnimationFrame(loop); else run = false;
    };
    spawn = function (x, y, amp) {
      if (reduce) return;
      rings.push({ x: x, y: y, t: performance.now(), life: 3200, v: 0.17, amp: amp || 1 }); if (rings.length > 9) rings.shift();
      if (!run && inView) { run = true; requestAnimationFrame(loop); }
    };
    size(); addEventListener('resize', size);
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { inView = es[0].isIntersecting; if (inView && rings.length && !run) { run = true; requestAnimationFrame(loop); } }).observe(hero);
    var lastSpawn = 0;
    if (canHover) hero.addEventListener('pointermove', function (e) {
      var n = performance.now(); if (n - lastSpawn < 420) return; lastSpawn = n;
      var r = hero.getBoundingClientRect(); spawn(e.clientX - r.left, e.clientY - r.top, 0.55);
    });
    hero.addEventListener('pointerdown', function (e) {
      if (e.target.closest('a,button')) return; var r = hero.getBoundingClientRect(); spawn(e.clientX - r.left, e.clientY - r.top, 1);
    });

    /* titular por palabras y letras */
    var h1 = $('h1', hero), plate = $('.hero-fig .plate', hero), tgt = plate || h1;
    if (h1 && hasG && !reduce) {
      var txt = h1.textContent; h1.setAttribute('aria-label', txt); h1.textContent = '';
      txt.split(' ').forEach(function (word, wi, arr) {
        var wsp = d.createElement('span'); wsp.className = 'w'; wsp.setAttribute('aria-hidden', 'true');
        word.split('').forEach(function (c) { var s = d.createElement('span'); s.className = 'ch'; s.textContent = c; wsp.appendChild(s); });
        h1.appendChild(wsp); if (wi < arr.length - 1) h1.appendChild(d.createTextNode(' '));
      });
      /* anillos que se dibujan alrededor de la obra: la misma onda de la apertura */
      var NS = 'http://www.w3.org/2000/svg', rsvg = d.createElementNS(NS, 'svg'), ringEls = [];
      rsvg.setAttribute('class', 'hero-rings'); rsvg.setAttribute('aria-hidden', 'true'); hero.insertBefore(rsvg, hero.children[1] || null);
      for (var k = 0; k < 7; k++) { var cEl = d.createElementNS(NS, 'circle'); cEl.setAttribute('pathLength', '1'); rsvg.appendChild(cEl); ringEls.push(cEl); }
      var centre = function (el) { var r = (el || tgt).getBoundingClientRect(), hr = hero.getBoundingClientRect(); return { x: r.left - hr.left + r.width / 2, y: r.top - hr.top + r.height / 2, w: hr.width, h: hr.height }; };
      var layout = function () { var c = centre(); rsvg.setAttribute('viewBox', '0 0 ' + c.w + ' ' + c.h); ringEls.forEach(function (e, i) { e.setAttribute('cx', c.x); e.setAttribute('cy', c.y); e.setAttribute('r', 90 + i * 95); }); };
      var burst = function (n) { var c = centre(n === 1 ? h1 : tgt); spawn(c.x, c.y, n === 2 ? 1 : 0.85); };
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, paused: introOn }); heroTl = tl;
      tl.add(layout, 0)
        .fromTo(ringEls, { strokeDashoffset: 1, opacity: 1 }, { strokeDashoffset: 0, duration: 1.1, stagger: 0.07, ease: 'power2.out' }, 0.02)
        .to(ringEls, { opacity: 0, duration: 0.8, stagger: 0.05, ease: 'power2.out' }, 1.05)
        .from('.hero h1 .ch', { yPercent: 115, duration: 0.9, stagger: 0.028 }, 0.1)
        .from('.hero .lead,.hero .actions,.hero-hint', { y: 18, autoAlpha: 0, duration: 0.7, stagger: 0.1 }, 0.55);
      if (plate) tl.fromTo(plate, { clipPath: 'inset(0 0 100% 0)' }, { clipPath: 'inset(0 0 0% 0)', duration: 1, ease: 'power4.inOut' }, 0.25)
        .from('.hero-fig img', { scale: 1.18, duration: 1.5 }, 0.25)
        .from('.hero-fig figcaption', { autoAlpha: 0, y: 8, duration: 0.6 }, 1.0);
      tl.add(function () { burst(2); }, 0.35).add(function () { burst(1); }, 0.75).add(function () { burst(2); }, 1.15);
      if (plate) gsap.to(plate, { yPercent: -5, ease: 'none', scrollTrigger: { trigger: hero, start: 'top top', end: 'bottom top', scrub: true } });
    } else if (tgt && !reduce) {
      setTimeout(function () { var r = tgt.getBoundingClientRect(), hr = hero.getBoundingClientRect(); spawn(r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2, 1); }, 400);
    }
  }

  /* ---------- botones con imán ---------- */
  if (hasG && canHover && !reduce) $$('.actions .btn,.statement .btn').forEach(function (b) {
    var qx = gsap.quickTo(b, 'x', { duration: 0.5, ease: 'power3' }), qy = gsap.quickTo(b, 'y', { duration: 0.5, ease: 'power3' });
    b.addEventListener('pointermove', function (e) { var r = b.getBoundingClientRect(); qx((e.clientX - r.left - r.width / 2) * 0.18); qy((e.clientY - r.top - r.height / 2) * 0.28); });
    b.addEventListener('pointerleave', function () { qx(0); qy(0); });
  });

  /* ---------- franja horizontal de renders ---------- */
  var hs = $('.hs');
  if (hs && hasG && !reduce) {
    var mm = gsap.matchMedia();
    mm.add('(min-width: 961px)', function () {
      var track = $('.hs-track', hs), fillBar = $('.hs-bar i', hs), wrap = hs;
      var dist = function () { return Math.max(0, track.scrollWidth - root.clientWidth); };
      gsap.to(track, { x: function () { return -dist(); }, ease: 'none', scrollTrigger: { trigger: wrap, start: 'top top+=96', end: function () { return '+=' + dist(); }, pin: true, scrub: 0.7, anticipatePin: 1, invalidateOnRefresh: true, onUpdate: function (s) { gsap.set(fillBar, { scaleX: s.progress }); } } });
    });
  }

  /* ---------- proyectos: aparición al filtrar ---------- */
  $$('.tab').forEach(function (b) {
    b.addEventListener('click', function () {
      if (!hasG || reduce) return;
      setTimeout(function () {
        var vis = $$('.case').filter(function (c) { return !c.hidden; });
        gsap.fromTo(vis, { autoAlpha: 0, y: 28 }, { autoAlpha: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, clearProps: 'transform,opacity,visibility' });
        $$('.wipe', d).forEach(function (e) { if (!e.closest('[hidden]')) e.classList.add('in'); });
        ScrollTrigger.refresh();
      }, 0);
    });
  });

  /* ---------- vistas vivas: la herramienta real corre dentro de la tarjeta ---------- */
  function embedFix(frame) {
    try {
      var doc = frame.contentDocument; if (!doc || !doc.head) return;
      var st = doc.createElement('style'); st.textContent = '.jom-bar,.top{display:none!important}:root{--bar:0px!important}html body{padding-top:0!important}'; doc.head.appendChild(st);
    } catch (e) { /* origen distinto: se deja la barra */ }
  }
  function mountScaled(box, src, onReady) {
    var f = d.createElement('iframe'); f.setAttribute('title', box.getAttribute('data-title') || 'Herramienta'); f.setAttribute('tabindex', '-1'); f.setAttribute('loading', 'eager');
    f.style.width = '1440px'; f.style.height = '900px';
    var fit = function () { f.style.transform = 'scale(' + (box.clientWidth / 1440) + ')'; }; fit();
    f._ro = 'ResizeObserver' in window ? new ResizeObserver(fit) : null; if (f._ro) f._ro.observe(box);
    f.addEventListener('load', function () { embedFix(f); onReady && onReady(f); });
    f.src = src; box.appendChild(f); return f;
  }
  var liveNow = null;
  function unmount(box) { var f = $('iframe', box); if (f) { if (f._ro) f._ro.disconnect(); f.remove(); } box.classList.remove('is-on', 'is-loading'); }
  function mountLive(box) {
    if (liveNow && liveNow !== box) unmount(liveNow);
    if ($('iframe', box)) return; liveNow = box; box.classList.add('is-loading');
    mountScaled(box, box.getAttribute('data-src'), function () { box.classList.remove('is-loading'); box.classList.add('is-on'); });
  }
  $$('.live').forEach(function (box) {
    var card = box.closest('a') || box;
    if (canHover) { card.addEventListener('pointerenter', function () { mountLive(box); }); card.addEventListener('focusin', function () { mountLive(box); }); card.addEventListener('pointerleave', function () { setTimeout(function () { if (liveNow === box) { unmount(box); liveNow = null; } }, 200); }); }
    else if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) mountLive(box); else if (liveNow === box) { unmount(box); liveNow = null; } }); }, { threshold: 0.75 }).observe(box);
  });

  /* ---------- galería de herramientas: diagramas; al pulsar se abre la herramienta ---------- */
  var gal = $('#toolGrid');
  if (gal) {
    var items = $$('.tool-tile[data-src]', gal), im = null, imIdx = 0, opener = null;
    items.forEach(function (it, i) { $('.tile-btn', it).addEventListener('click', function () { openIm(i, it); }); });
    var rectOf = function (el) { var r = el.getBoundingClientRect(); return 'inset(' + r.top + 'px ' + (innerWidth - r.right) + 'px ' + (innerHeight - r.bottom) + 'px ' + r.left + 'px)'; };
    var build = function () {
      im = d.createElement('div'); im.className = 'immerse'; im.setAttribute('role', 'dialog'); im.setAttribute('aria-modal', 'true');
      im.innerHTML = '<div class="immerse-bar"><span class="t"></span><div class="g"><button type="button" data-a="guide" aria-pressed="false"></button><button type="button" data-a="prev"></button><button type="button" data-a="next"></button><button type="button" data-a="close"></button></div></div><div class="immerse-body"><aside class="immerse-guide"></aside><iframe title=""></iframe></div>';
      d.body.appendChild(im);
      im.addEventListener('click', function (e) { var a = e.target.closest('[data-a]'); if (!a) return; var k = a.getAttribute('data-a'); if (k === 'close') closeIm(); if (k === 'prev') showIm(imIdx - 1); if (k === 'next') showIm(imIdx + 1); if (k === 'guide') { var on = !im.classList.contains('is-guide'); im.classList.toggle('is-guide', on); a.setAttribute('aria-pressed', on); } });
      d.addEventListener('keydown', function (e) { if (!im.classList.contains('is-open')) return; if (e.key === 'Escape') closeIm(); if (e.key === 'ArrowLeft' && e.altKey) showIm(imIdx - 1); if (e.key === 'ArrowRight' && e.altKey) showIm(imIdx + 1); });
    };
    var labels = function () { $('[data-a=guide]', im).textContent = tr('guide'); $('[data-a=prev]', im).textContent = tr('prev'); $('[data-a=next]', im).textContent = tr('next'); $('[data-a=close]', im).textContent = tr('close'); };
    var showIm = function (i) {
      imIdx = (i + items.length) % items.length; var it = items[imIdx], f = $('iframe', im), body = $('.immerse-body', im);
      $('.t', im).textContent = it.getAttribute('data-title'); im.setAttribute('aria-label', it.getAttribute('data-title')); f.title = it.getAttribute('data-title');
      f.classList.remove('is-ready'); body.classList.add('is-loading');
      f.onload = function () { embedFix(f); try { f.contentDocument.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeIm(); }); } catch (e) {} f.classList.add('is-ready'); body.classList.remove('is-loading'); };
      var gi = $('.immerse-guide', im); gi.innerHTML = '<h2 style="font-size:var(--text-2xl)">' + it.getAttribute('data-title') + '</h2>' + $('.t-guide', it).innerHTML; localize(gi);
      f.src = it.getAttribute('data-src'); labels();
      if (history.replaceState) history.replaceState(null, '', '#' + it.id);
    };
    var openIm = function (i, from) {
      if (!im) build(); opener = d.activeElement; showIm(i);
      var gOn = innerWidth > 960; im.classList.toggle('is-guide', gOn); $('[data-a=guide]', im).setAttribute('aria-pressed', gOn);
      d.body.classList.add('is-locked'); $$('main,.nav,.foot').forEach(function (n) { n.setAttribute('inert', ''); });
      var from0 = rectOf(from || items[imIdx]); im.classList.add('is-open');
      if (hasG && !reduce) gsap.fromTo(im, { clipPath: from0 }, { clipPath: 'inset(0px 0px 0px 0px)', duration: 0.8, ease: 'power4.out', clearProps: 'clipPath' });
      setTimeout(function () { $('[data-a=close]', im).focus(); }, 60);
    };
    var closeIm = function () {
      var tile = items[imIdx];
      var fin = function () { im.classList.remove('is-open'); $('iframe', im).removeAttribute('src'); d.body.classList.remove('is-locked'); $$('main,.nav,.foot').forEach(function (n) { n.removeAttribute('inert'); }); if (history.replaceState) history.replaceState(null, '', location.pathname); if (opener && opener.focus) opener.focus(); };
      if (hasG && !reduce) gsap.to(im, { clipPath: rectOf(tile), duration: 0.5, ease: 'power3.inOut', onComplete: function () { fin(); gsap.set(im, { clearProps: 'clipPath' }); } }); else fin();
    };
    d.addEventListener('langchange', function () { if (im && im.classList.contains('is-open')) showIm(imIdx); });
    /* dibujo al entrar y bucle solo en pantalla */
    var tiles = $$('.tool-tile', gal);
    if ('IntersectionObserver' in window) {
      var tio = new IntersectionObserver(function (es) { es.forEach(function (e) {
        var t = e.target, sv = $('.line-art', t); t.classList.toggle('is-live', e.isIntersecting);
        if (e.isIntersecting && sv && !sv.classList.contains('is-drawn')) setTimeout(function () { sv.classList.add('is-drawn'); }, (tiles.indexOf(t) % 3) * 110);
      }); }, { threshold: 0.25 });
      tiles.forEach(function (t) { tio.observe(t); });
    } else tiles.forEach(function (t) { t.classList.add('is-live'); var sv = $('.line-art', t); if (sv) sv.classList.add('is-drawn'); });
    var hit = items.map(function (x) { return '#' + x.id; }).indexOf(location.hash);
    if (hit > -1) setTimeout(function () { openIm(hit, items[hit]); }, 500);
  }

  /* ---------- dibujos de línea de las tarjetas ---------- */
  if ('IntersectionObserver' in window) {
    var lio = new IntersectionObserver(function (es) { es.forEach(function (e) { var sv = $('.line-art', e.target); e.target.classList.toggle('is-live', e.isIntersecting); if (e.isIntersecting && sv) sv.classList.add('is-drawn'); }); }, { threshold: 0.35 });
    $$('.tool-note').forEach(function (s) { lio.observe(s); });
  } else $$('.tool-note .line-art').forEach(function (s) { s.classList.add('is-drawn'); });

  /* ---------- visor de láminas: transición al cambiar de imagen ---------- */
  var lbImg = $('#lbImg');
  if (lbImg && 'MutationObserver' in window) new MutationObserver(function () { lbImg.classList.add('is-swapping'); requestAnimationFrame(function () { requestAnimationFrame(function () { lbImg.classList.remove('is-swapping'); }); }); }).observe(lbImg, { attributes: true, attributeFilter: ['src'] });


  /* ---------- menú móvil ---------- */
  (function () {
    var nav = $('.nav'), links = nav && $('nav', nav), lg = nav && $('.lang', nav); if (!nav || !links || !lg) return;
    var btn = d.createElement('button'); btn.type = 'button'; btn.className = 'menu-btn'; btn.setAttribute('aria-expanded', 'false');
    var lab = function (open) { btn.textContent = open ? (lang() === 'es' ? 'Cerrar' : 'Close') : (lang() === 'es' ? 'Menú' : 'Menu'); };
    links.id = links.id || 'navlinks'; btn.setAttribute('aria-controls', links.id); lab(false);
    lg.parentNode.insertBefore(btn, lg);
    var set = function (open) { nav.classList.toggle('is-menu', open); btn.setAttribute('aria-expanded', open); d.body.classList.toggle('is-locked', open); lab(open); if (open) nav.classList.remove('is-hidden'); };
    btn.addEventListener('click', function () { set(!nav.classList.contains('is-menu')); });
    links.addEventListener('click', function (e) { if (e.target.closest('a')) set(false); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && nav.classList.contains('is-menu')) { set(false); btn.focus(); } });
    addEventListener('resize', function () { if (innerWidth > 640 && nav.classList.contains('is-menu')) set(false); });
    d.addEventListener('langchange', function () { lab(nav.classList.contains('is-menu')); });
  })();

  /* ---------- visor de láminas: zoom y arrastre ---------- */
  (function () {
    var img = $('#lbImg'), dlg = $('#lightbox'); if (!img || !dlg) return;
    var z = 1, x = 0, y = 0, drag = null, moved = false;
    var apply = function () { img.style.transform = z === 1 ? '' : 'translate(' + x + 'px,' + y + 'px) scale(' + z + ')'; img.classList.toggle('is-zoom', z > 1); };
    var reset = function () { z = 1; x = y = 0; apply(); };
    img.addEventListener('click', function () { if (moved) { moved = false; return; } if (z === 1) { z = 2.4; } else reset(); apply(); });
    img.addEventListener('pointerdown', function (e) { if (z === 1) return; drag = { px: e.clientX, py: e.clientY, x: x, y: y }; moved = false; img.setPointerCapture(e.pointerId); img.classList.add('is-drag'); });
    img.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - drag.px, dy = e.clientY - drag.py; if (Math.abs(dx) + Math.abs(dy) > 4) moved = true; x = drag.x + dx; y = drag.y + dy; apply(); });
    var end = function () { drag = null; img.classList.remove('is-drag'); };
    img.addEventListener('pointerup', end); img.addEventListener('pointercancel', end);
    img.addEventListener('wheel', function (e) { if (z === 1) return; e.preventDefault(); z = Math.max(1, Math.min(5, z * (e.deltaY < 0 ? 1.12 : 0.89))); if (z === 1) { x = y = 0; } apply(); }, { passive: false });
    new MutationObserver(reset).observe(img, { attributes: true, attributeFilter: ['src'] });
    dlg.addEventListener('close', reset);
  })();

  if (introOn) playIntro();
  if (hasG) addEventListener('load', function () { ScrollTrigger.refresh(); });
})();
