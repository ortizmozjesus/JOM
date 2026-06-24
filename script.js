// ========================
// PORTFOLIO SCRIPT - CLEAN
// ========================

document.addEventListener('DOMContentLoaded', function() {

  // ========================
  // LANGUAGE TOGGLE
  // ========================
  var langBtns = document.querySelectorAll('[data-l]');

  function setLang(lang) {
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
  var hdr = document.getElementById('hdr');
  if (hdr) {
    window.addEventListener('scroll', function() {
      hdr.classList.toggle('scrolled', window.scrollY > 50);
    });
  }

  // ========================
  // MOBILE MENU
  // ========================
  var hbg = document.getElementById('hbg');
  var mob = document.getElementById('mob');
  var mobClose = document.getElementById('mobClose');

  if (hbg && mob) {
    hbg.addEventListener('click', function() {
      mob.classList.add('open');
      hbg.classList.add('open');
    });
  }
  if (mobClose && mob) {
    mobClose.addEventListener('click', function() {
      mob.classList.remove('open');
      if (hbg) hbg.classList.remove('open');
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
  var strips = document.querySelectorAll('.proj-strip');

  strips.forEach(function(strip) {
    var arrow = strip.querySelector('.ps-arrow');
    if (arrow) {
      arrow.addEventListener('click', function(e) {
        e.stopPropagation();
        var isOpen = strip.classList.contains('open');
        strips.forEach(function(s) { s.classList.remove('open'); });
        if (!isOpen) strip.classList.add('open');
      });
    }
  });

  // ========================
  // LIGHTBOX
  // ========================
  var lbx = document.getElementById('lbx');
  var lbxImg = document.getElementById('lbx-img');

  function openLbx(src) {
    if (!lbx || !lbxImg) return;
    lbxImg.src = src;
    lbx.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }

  function closeLbx() {
    if (!lbx) return;
    lbx.style.display = 'none';
    if (lbxImg) lbxImg.src = '';
    document.body.style.overflow = '';
  }

  document.addEventListener('click', function(e) {
    var img = e.target;
    if (img.tagName === 'IMG' && img.closest && (img.closest('.ps-img-wrap') || img.closest('.misc-img-wrap'))) {
      e.preventDefault();
      if (img.src) openLbx(img.src);
    }
  });

  if (lbx) {
    lbx.addEventListener('click', function(e) {
      if (e.target === lbx || e.target.tagName === 'SPAN') closeLbx();
    });
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') closeLbx();
  });

  function setCursors() {
    document.querySelectorAll('.ps-img-wrap img, .misc-img-wrap img').forEach(function(img) {
      img.style.cursor = 'zoom-in';
    });
  }
  setCursors();

  // ========================
  // FADE-IN ON SCROLL
  // ========================
  var fadeEls = document.querySelectorAll('.fade-in');
  if (fadeEls.length > 0 && 'IntersectionObserver' in window) {
    var observer = new IntersectionObserver(function(entries) {
      entries.forEach(function(entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    fadeEls.forEach(function(el) { observer.observe(el); });
  } else {
    // Si no hay soporte, mostrar todo directamente
    fadeEls.forEach(function(el) { el.classList.add('in-view'); });
  }

  // ========================
  // HERO SCROLL INDICATOR
  // ========================
  var heroScroll = document.querySelector('.hero-scroll');
  if (heroScroll) {
    heroScroll.addEventListener('click', function() {
      var projects = document.getElementById('projects');
      if (projects) projects.scrollIntoView({behavior: 'smooth'});
    });
  }

});
