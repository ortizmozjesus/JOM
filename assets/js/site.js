/* Portfolio de Jesús Ortiz Muñoz: idioma, aparición al desplazar, filtro de proyectos y visor de láminas. */
(function () {
  'use strict';
  var root = document.documentElement, lang = 'es';
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  var UI = { es: { close: 'Cerrar', prev: 'Anterior', next: 'Siguiente', copy: 'Copiar', copied: 'Copiado' }, en: { close: 'Close', prev: 'Previous', next: 'Next', copy: 'Copy', copied: 'Copied' } };

  function applyLang(l) {
    lang = l; root.lang = l; store('jom-lang', l);
    document.querySelectorAll('[data-es]').forEach(function (el) { el.textContent = el.getAttribute('data-' + l); });
    document.querySelectorAll('[data-aria-es]').forEach(function (el) { el.setAttribute('aria-label', el.getAttribute('data-aria-' + l)); });
    var t = document.querySelector('title[data-en]'); if (t) document.title = t.getAttribute('data-' + l);
    var md = document.querySelector('meta[name="description"][data-en]'); if (md) md.setAttribute('content', md.getAttribute('data-' + l));
    var lb = document.getElementById('lbClose'); if (lb) { lb.textContent = UI[l].close; document.getElementById('lbPrev').setAttribute('aria-label', UI[l].prev); document.getElementById('lbNext').setAttribute('aria-label', UI[l].next); }
    var lg = document.getElementById('lang'); if (lg) lg.textContent = l === 'es' ? 'EN' : 'ES';
    document.dispatchEvent(new CustomEvent('langchange'));
  }
  if (store('jom-lang') === 'en') applyLang('en'); else { var lg0 = document.getElementById('lang'); if (lg0) lg0.textContent = 'EN'; }
  var lgb = document.getElementById('lang');
  if (lgb) lgb.addEventListener('click', function () { applyLang(lang === 'es' ? 'en' : 'es'); });

  /* aparición al desplazar */
  var items = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    items.forEach(function (el) { io.observe(el); });
  } else items.forEach(function (el) { el.classList.add('in'); });

  /* filtro de proyectos */
  var cases = Array.prototype.slice.call(document.querySelectorAll('.case'));
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-f');
      document.querySelectorAll('.tab').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      cases.forEach(function (c) { c.hidden = !(f === 'all' || c.getAttribute('data-kind') === f); });
    });
  });
  if (location.hash && cases.length) {
    var target = document.getElementById(location.hash.slice(1));
    if (target) { target.hidden = false; }
  }

  /* visor */
  var dlg = document.getElementById('lightbox');
  if (dlg) {
    var cur = { c: null, i: 0 };
    var frames = function (c) { return c.querySelectorAll('.frame'); };
    var show = function (c, i) {
      var fr = frames(c); cur.c = c; cur.i = (i + fr.length) % fr.length;
      var img = fr[cur.i].querySelector('img');
      var big = document.getElementById('lbImg'); big.src = img.currentSrc || img.src; big.alt = img.alt;
      document.getElementById('lbTitle').textContent = c.querySelector('h2').textContent;
      document.getElementById('lbAlt').textContent = img.alt + ' (' + (cur.i + 1) + '/' + fr.length + ')';
      if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
    };
    cases.forEach(function (c) { frames(c).forEach(function (f, i) { f.addEventListener('click', function () { show(c, i); }); }); });
    document.getElementById('lbClose').addEventListener('click', function () { dlg.close(); });
    document.getElementById('lbPrev').addEventListener('click', function () { show(cur.c, cur.i - 1); });
    document.getElementById('lbNext').addEventListener('click', function () { show(cur.c, cur.i + 1); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    document.addEventListener('keydown', function (e) {
      if (!dlg.open) return;
      if (e.key === 'ArrowLeft') show(cur.c, cur.i - 1);
      if (e.key === 'ArrowRight') show(cur.c, cur.i + 1);
    });
  }

  /* copiar correo */
  var cp = document.getElementById('copyMail');
  if (cp) cp.addEventListener('click', function () {
    var txt = cp.getAttribute('data-mail');
    function ok() { cp.textContent = UI[lang].copied; setTimeout(function () { cp.textContent = UI[lang].copy; }, 1600); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, function () { window.prompt && 0; });
    else { var r = document.createRange(); r.selectNodeContents(document.getElementById('mailText')); var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
  });
  document.addEventListener('langchange', function () { if (cp) cp.textContent = UI[lang].copy; });
})();
