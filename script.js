// ========================
// PORTFOLIO SCRIPT - CLEAN
// ========================

document.addEventListener('DOMContentLoaded', function() {

  // ========================
  // LANGUAGE TOGGLE
  // ========================
  const langBtns = document.querySelectorAll('[data-l]');
  let currentLang = 'es';

  function setLang(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-es]').forEach(function(el) {
      el.textContent = el.getAttribute('data-' + lang);
    });
    langBtns.forEach(function(btn) {
      btn.classList.toggle('la', btn.getAttribute('data-l') === lang);
    });
  }

  langBtns.forEach(function(btn) {
    btn.addEventListener('click', function() {
      setLang(btn.getAttribute('data-l'));
    });
  });

  // ========================
  // HEADER SCROLL
  // ========================
  const hdr = document.getElementById('hdr');
  window.addEventListener('scroll', function() {
    hdr.classList.toggle('scrolled', window.scrollY > 50);
  });

  // ========================
  // MOBILE MENU
  // ========================
  const hbg = document.getElementById('hbg');
  const mob = document.getElementById('mob');
  const mobClose = document.getElementById('mobClose');

  if (hbg && mob) {
    hbg.addEventListener('click', function() {
      mob.classList.add('open');
      hbg.classList.add('open');
    });
  }
  if (mobClose && mob) {
    mobClose.addEventListener('click', function() {
      mob.classList.remove('open');
      hbg.classList.remove('open');
    });
  }
  if (mob) {
    mob.querySelectorAll('a').forEach(function(a) {
      a.addEventListener('click', function() {
        mob.classList.remove('open');
        if (hbg) hbg.classList.remove('open');
      });
    });
  }

  // ========================
  // PROJECT STRIPS
  // ========================
  const strips = document.querySelectorAll('.proj-strip');

  strips.forEach(function(strip) {
    const arrow = strip.querySelector('.ps-arrow');
    const panel = strip.querySelector('.ps-panel');

    if (arrow && panel) {
      arrow.addEventListener('click', function(e) {
        e.stopPropagation();
        const isOpen = strip.classList.contains('open');
        strips.forEach(function(s) { s.classList.remove('open'); });
        if (!isOpen) strip.classList.add('open');
      });
    }
  });

  // ========================
  // LIGHTBOX
  // ========================
  const lbx = document.getElementById('lbx');
  const lbxImg = document.getElementById('lbxImg');

  function openLbx(src) {
    if (!lbx || !lbxImg) return;
    lbxImg.src = src;
    lbx.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeLbx() {
    if (!lbx) return;
    lbx.classList.remove('active');
    lbxImg.src = '';
    document.body.style.overflow = '';
  }

  // Open lightbox on image click (event delegation)
  document.addEventListener('click', function(e) {
    if (e.target.tagName === 'IMG' && (e.target.closest('.ps-img-wrap') || e.target.closest('.misc-img-wrap'))) {
      e.preventDefault();
      e.stopPropagation();
      if (e.target.src) openLbx(e.target.src);
    }
  });

  // Close lightbox
  if (lbx) {
    lbx.addEventListener('click', function(e) {
      if (e.target === lbx || e.target.tagName === 'SPAN') closeLbx();
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeLbx();
  });

  // Set cursor for images
  function setCursors() {
    document.querySelectorAll('.ps-img-wrap img, .misc-img-wrap img').forEach(function(img) {
      img.style.cursor = 'zoom-in';
    });
  }
  setCursors();

  const imgObserver = new MutationObserver(setCursors);
  imgObserver.observe(document.body, {childList: true, subtree: true});

  // ========================
  // HERO SCROLL INDICATOR
  // ========================
  const heroScroll = document.querySelector('.hero-scroll');
  if (heroScroll) {
    heroScroll.addEventListener('click', function() {
      const projects = document.getElementById('projects');
      if (projects) projects.scrollIntoView({behavior: 'smooth'});
    });
  }

});
