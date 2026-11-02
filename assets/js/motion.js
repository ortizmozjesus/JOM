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


  /* ---------- apertura: las ondas dibujan el plano y se abre el telón ---------- */
  var introOn = root.classList.contains('intro-pending'), heroTl = null;
  var endIntro = function () { root.classList.remove('intro-pending'); try { localStorage.setItem('jom-intro', String(Date.now())); } catch (e) {} if (heroTl) heroTl.play(); };
  var playIntro = function () {
    if (!hasG) return endIntro();
    var es = lang() === 'es', box = d.createElement('div'); box.className = 'intro'; box.setAttribute('role', 'presentation');
    var rings = [90, 170, 260, 370, 500].map(function (r) { return '<circle cx="500" cy="300" r="' + r + '"/>'; }).join('');
    box.innerHTML = '<svg class="intro-svg" viewBox="0 0 1000 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">' + rings +
      '<line class="ln" x1="0" y1="300" x2="1000" y2="300"/><line class="ln" x1="500" y1="0" x2="500" y2="600"/>' +
      '<line class="ln" x1="140" y1="520" x2="860" y2="520"/><line class="ln" x1="140" y1="508" x2="140" y2="532"/><line class="ln" x1="860" y1="508" x2="860" y2="532"/></svg>' +
      '<div class="intro-center"><p class="intro-name" aria-hidden="true"><span>Jesús Ortiz Muñoz</span></p><p class="intro-sub"><span>' + (es ? 'Arquitectura y software' : 'Architecture and software') + '</span></p></div>' +
      '<button type="button" class="intro-skip">' + (es ? 'Saltar' : 'Skip') + '</button>';
    root.appendChild(box);
    var circles = $$('circle', box), lines = $$('.ln', box), done = false;
    circles.forEach(function (c) { var L = 2 * Math.PI * parseFloat(c.getAttribute('r')); c.style.strokeDasharray = L; c.style.strokeDashoffset = L; });
    var finish = function () { if (done) return; done = true; box.remove(); endIntro(); };
    var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, onComplete: finish });
    tl.from(lines, { opacity: 0, duration: 0.5, stagger: 0.05 }, 0)
      .to(circles, { strokeDashoffset: 0, duration: 0.9, stagger: 0.07, ease: 'power2.inOut' }, 0.05)
      .fromTo('.intro-name span', { yPercent: 110 }, { yPercent: 0, duration: 0.6 }, 0.25)
      .fromTo('.intro-sub span', { yPercent: 110 }, { yPercent: 0, duration: 0.5 }, 0.45)
      .to('.intro-name span,.intro-sub span', { yPercent: -110, duration: 0.35, ease: 'power3.out', stagger: 0.04 }, 1.05)
      .to('.intro-skip,.intro-svg', { opacity: 0, duration: 0.3 }, 1.05)
      .to(box, { clipPath: 'inset(0 0 100% 0)', duration: 0.6, ease: 'power4.inOut' }, 1.2);
    var skip = function () { if (!done) { tl.timeScale(4); if (tl.time() < 1.0) tl.seek(1.0); } };
    box.addEventListener('click', skip);
    $('.intro-skip', box).addEventListener('click', function (e) { e.stopPropagation(); skip(); });
    d.addEventListener('keydown', function k(e) { if (e.key === 'Escape' || e.key === 'Enter') { skip(); d.removeEventListener('keydown', k); } });
    root.classList.remove('intro-pending');
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
    var ctx = cv.getContext('2d'), w = 0, h = 0, dpr = 1, SP = 28, rings = [], run = false, inView = true, ink = '#0a1522', acc = '#2aa7c9';
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
      var tl = gsap.timeline({ defaults: { ease: 'power3.out' }, paused: introOn }); heroTl = tl;
      tl.from('.hero h1 .ch', { yPercent: 115, duration: 0.9, stagger: 0.028 }, 0.1)
        .from('.hero .lead,.hero .actions', { y: 18, autoAlpha: 0, duration: 0.7, stagger: 0.12 }, 0.55)
        .add(function () { var r = tgt.getBoundingClientRect(), hr = hero.getBoundingClientRect(); spawn(r.left - hr.left + r.width / 2, r.top - hr.top + r.height / 2, 1); }, 0.9);
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

  /* ---------- teatro de herramientas ---------- */
  var th = $('#theatre');
  if (th) {
    var items = $$('.t-item', th), frameBox = $('#tFrame'), poster = $('#tPoster'), cover = $('#tCover'), meta = $('#tPath'), openTab = $('#tTab'), bFull = $('#tFull'), bUse = $('#tUse');
    var cur = -1, iframe = null, started = false;
    var mountStage = function (i) {
      var it = items[i], src = it.getAttribute('data-src');
      if (iframe) { if (iframe._ro) iframe._ro.disconnect(); iframe.remove(); iframe = null; }
      frameBox.classList.remove('is-ready', 'is-active'); frameBox.classList.add('is-loading');
      iframe = d.createElement('iframe'); iframe.setAttribute('title', it.getAttribute('data-title')); iframe.style.width = '1440px'; iframe.style.height = '900px';
      var fit = function () { iframe.style.transform = 'scale(' + (frameBox.clientWidth / 1440) + ')'; }; fit();
      if ('ResizeObserver' in window) { iframe._ro = new ResizeObserver(fit); iframe._ro.observe(frameBox); }
      var done = false, ok = function () { if (done) return; done = true; frameBox.classList.remove('is-loading'); frameBox.classList.add('is-ready'); };
      iframe.addEventListener('load', function () { embedFix(iframe); try { iframe.contentDocument.addEventListener('keydown', function (e) { if (e.key === 'Escape') release(); }); } catch (e) {} ok(); });
      setTimeout(ok, 9000);
      iframe.src = src; frameBox.appendChild(iframe);
    };
    var select = function (i, opt) {
      opt = opt || {}; if (i === cur) return; cur = i;
      items.forEach(function (it, k) { it.setAttribute('data-active', k === i ? 'true' : 'false'); $('.t-btn', it).setAttribute('aria-pressed', k === i ? 'true' : 'false'); });
      var it = items[i];
      poster.src = it.getAttribute('data-poster'); poster.alt = it.getAttribute('data-title');
      meta.textContent = it.getAttribute('data-src').replace('/index.html', '');
      var gp = $('#tGuide'); if (gp) { gp.innerHTML = $('.t-guide', it).innerHTML; localize(gp); }
      openTab.href = it.getAttribute('data-src');
      if (history.replaceState && !opt.silent) history.replaceState(null, '', '#' + it.id);
      if (hasG && !reduce && !opt.instant) gsap.fromTo(frameBox, { clipPath: 'inset(-24px 100% -24px -24px)' }, { clipPath: 'inset(-24px -24px -24px -24px)', duration: 0.8, ease: 'power3.out' });
      if (started) mountStage(i);
    };
    var activate = function () { if (!iframe) return; frameBox.classList.add('is-active'); bUse.textContent = tr('stop'); bUse.setAttribute('aria-pressed', 'true'); try { iframe.focus(); } catch (e) {} };
    var release = function () { frameBox.classList.remove('is-active'); bUse.textContent = tr('use'); bUse.setAttribute('aria-pressed', 'false'); };
    items.forEach(function (it, i) {
      $('.t-btn', it).addEventListener('click', function () { select(i); });
      $('.t-btn', it).addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowDown' ? i + 1 : e.key === 'ArrowUp' ? i - 1 : null; if (n === null) return;
        e.preventDefault(); n = (n + items.length) % items.length; select(n, { instant: true }); $('.t-btn', items[n]).focus();
      });
    });
    cover.addEventListener('click', function () { if (innerWidth <= 960) openIm(cur, frameBox); else activate(); });
    bUse.addEventListener('click', function () { if (innerWidth <= 960) return openIm(cur, frameBox); frameBox.classList.contains('is-active') ? release() : activate(); });
    d.addEventListener('keydown', function (e) { if (e.key === 'Escape' && frameBox.classList.contains('is-active')) release(); });
    d.addEventListener('pointerdown', function (e) { if (frameBox.classList.contains('is-active') && !e.target.closest('#tFrame,#tUse')) release(); });
    d.addEventListener('langchange', function () { var gp = $('#tGuide'); if (gp) localize(gp); if (im && im.classList.contains('is-open')) showIm(imIdx); bUse.textContent = frameBox.classList.contains('is-active') ? tr('stop') : tr('use'); });
    var first = Math.max(0, items.map(function (x) { return '#' + x.id; }).indexOf(location.hash));
    select(first, { silent: true });
    var kick = function () { if (started) return; started = true; mountStage(cur); };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es, o) { if (es[0].isIntersecting) { kick(); o.disconnect(); } }, { threshold: 0.2 }).observe(frameBox); else kick();

    /* pantalla completa inmersiva */
    var im = null, imIdx = 0, opener = null;
    var build = function () {
      im = d.createElement('div'); im.className = 'immerse'; im.setAttribute('role', 'dialog'); im.setAttribute('aria-modal', 'true');
      im.innerHTML = '<div class="immerse-bar"><span class="t"></span><div class="g"><button type="button" data-a="guide" aria-pressed="false"></button><button type="button" data-a="prev"></button><button type="button" data-a="next"></button><a target="_blank" rel="noopener" data-a="tab"></a><button type="button" data-a="close"></button></div></div><div class="immerse-body"><aside class="immerse-guide"></aside><iframe title="" ></iframe></div>';
      d.body.appendChild(im);
      im.addEventListener('click', function (e) { var a = e.target.closest('[data-a]'); if (!a) return; var k = a.getAttribute('data-a'); if (k === 'close') closeIm(); if (k === 'guide') { var on = !im.classList.contains('is-guide'); im.classList.toggle('is-guide', on); a.setAttribute('aria-pressed', on); } if (k === 'prev') showIm(imIdx - 1); if (k === 'next') showIm(imIdx + 1); });
      d.addEventListener('keydown', function (e) { if (!im.classList.contains('is-open')) return; if (e.key === 'Escape') closeIm(); if (e.key === 'ArrowLeft' && e.altKey) showIm(imIdx - 1); if (e.key === 'ArrowRight' && e.altKey) showIm(imIdx + 1); });
    };
    var labels = function () { $('[data-a=guide]', im).textContent = tr('guide'); $('[data-a=prev]', im).textContent = tr('prev'); $('[data-a=next]', im).textContent = tr('next'); $('[data-a=tab]', im).textContent = tr('tab'); $('[data-a=close]', im).textContent = tr('close'); };
    var showIm = function (i) {
      imIdx = (i + items.length) % items.length; var it = items[imIdx], f = $('iframe', im), body = $('.immerse-body', im);
      $('.t', im).textContent = it.getAttribute('data-title'); $('[data-a=tab]', im).href = it.getAttribute('data-src'); im.setAttribute('aria-label', it.getAttribute('data-title')); f.title = it.getAttribute('data-title');
      f.classList.remove('is-ready'); body.classList.add('is-loading');
      f.onload = function () { embedFix(f); try { f.contentDocument.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeIm(); }); } catch (e) {} f.classList.add('is-ready'); body.classList.remove('is-loading'); };
      var gi = $('.immerse-guide', im); gi.innerHTML = '<h2 style="font-size:var(--text-2xl)">' + it.getAttribute('data-title') + '</h2>' + $('.t-guide', it).innerHTML; localize(gi);
      f.src = it.getAttribute('data-src'); labels();
    };
    var openIm = function (i, from) {
      if (!im) build(); opener = d.activeElement; release();
      showIm(i); var r = (from || frameBox).getBoundingClientRect();
      var gOn = innerWidth > 960; im.classList.toggle('is-guide', gOn); $('[data-a=guide]', im).setAttribute('aria-pressed', gOn); d.body.classList.add('is-locked'); $$('main,.nav,.foot').forEach(function (n) { n.setAttribute('inert', ''); });
      im.classList.add('is-open');
      if (hasG && !reduce) gsap.fromTo(im, { clipPath: 'inset(' + r.top + 'px ' + (innerWidth - r.right) + 'px ' + (innerHeight - r.bottom) + 'px ' + r.left + 'px)' }, { clipPath: 'inset(0px 0px 0px 0px)', duration: 0.8, ease: 'power3.inOut', clearProps: 'clipPath' });
      setTimeout(function () { $('[data-a=close]', im).focus(); }, 60);
    };
    var closeIm = function () {
      var r = frameBox.getBoundingClientRect();
      var fin = function () { im.classList.remove('is-open'); $('iframe', im).removeAttribute('src'); d.body.classList.remove('is-locked'); $$('main,.nav,.foot').forEach(function (n) { n.removeAttribute('inert'); }); if (opener && opener.focus) opener.focus(); };
      if (hasG && !reduce) gsap.to(im, { clipPath: 'inset(' + r.top + 'px ' + (innerWidth - r.right) + 'px ' + (innerHeight - r.bottom) + 'px ' + r.left + 'px)', duration: 0.6, ease: 'power3.inOut', onComplete: function () { fin(); gsap.set(im, { clearProps: 'clipPath' }); } }); else fin();
    };
    bFull.addEventListener('click', function () { openIm(cur, frameBox); });
    var fs = $('#tFullCover'); if (fs) fs.addEventListener('click', function () { openIm(cur, frameBox); });
  }

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
