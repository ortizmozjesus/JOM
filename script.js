/* ── LANGUAGE ── */
let lang = 'es';

function applyLang(l) {
  lang = l;
  document.querySelectorAll('[data-es]').forEach(el => {
    el.textContent = el.getAttribute('data-' + l);
  });
  document.querySelectorAll('#lb [data-l]').forEach(el => {
    el.classList.toggle('la', el.getAttribute('data-l') === l);
  });
  document.querySelectorAll('.mob-lang button').forEach(el => {
    el.classList.toggle('la', el.getAttribute('data-l') === l);
  });
}

document.getElementById('lb').addEventListener('click', () => {
  applyLang(lang === 'es' ? 'en' : 'es');
});
document.querySelectorAll('.mob-lang button').forEach(btn => {
  btn.addEventListener('click', () => applyLang(btn.getAttribute('data-l')));
});

/* ── HEADER SCROLL ── */
const hdr = document.getElementById('hdr');
window.addEventListener('scroll', () => {
  hdr.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ── MOBILE MENU ── */
const mob      = document.getElementById('mob');
const hbg      = document.getElementById('hbg');
const mobClose = document.getElementById('mobClose');

function openMob()  { mob.classList.add('open');  hbg.classList.add('open');  document.body.style.overflow = 'hidden'; }
function closeMob() { mob.classList.remove('open'); hbg.classList.remove('open'); document.body.style.overflow = ''; }

hbg.addEventListener('click', openMob);
mobClose.addEventListener('click', closeMob);
mob.querySelectorAll('a').forEach(a => a.addEventListener('click', closeMob));

/* ── HERO SCROLL ── */
const heroScroll = document.getElementById('heroScroll');
if (heroScroll) {
  heroScroll.addEventListener('click', () => {
    document.getElementById('projects').scrollIntoView({ behavior: 'smooth' });
  });
}

/* ── PROJ STRIP EXPAND ── */
document.querySelectorAll('.proj-strip').forEach(strip => {
  strip.querySelector('.ps-header').addEventListener('click', () => {
    const isOpen = strip.classList.contains('open');
    document.querySelectorAll('.proj-strip.open').forEach(s => s.classList.remove('open'));
    if (!isOpen) {
      strip.classList.add('open');
      setTimeout(() => strip.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
  });
});

/* ── ACTIVE NAV ── */
const navLinks = document.querySelectorAll('nav .nl');
const ioObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      navLinks.forEach(l => l.classList.remove('active'));
      const a = document.querySelector(`nav a[href="#${e.target.id}"]`);
      if (a) a.classList.add('active');
    }
  });
}, { threshold: 0.3 });
['hero','projects','about','contact'].forEach(id => {
  const el = document.getElementById(id);
  if (el) ioObs.observe(el);
});

/* ── FADE IN ON SCROLL ── */
const fadeObs = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('in-view'); fadeObs.unobserve(e.target); }
  });
}, { threshold: 0.15 });
document.querySelectorAll('.fade-in').forEach(el => fadeObs.observe(el));

/* ── LIGHTBOX ── */
const lbx      = document.getElementById('lbx');
const lbxImg   = document.getElementById('lbx-img');
const lbxClose = document.getElementById('lbxClose');

function openLbx(src, alt) {
  lbxImg.src = src; lbxImg.alt = alt || '';
  lbx.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeLbx() {
  lbx.classList.remove('active');
  document.body.style.overflow = '';
  lbxImg.src = '';
}

document.querySelectorAll('.ps-img-wrap img, .misc-img-wrap img').forEach(img => {
  img.style.cursor = 'zoom-in';
  img.addEventListener('click', () => openLbx(img.src, img.alt));
});
lbxClose.addEventListener('click', closeLbx);
lbx.addEventListener('click', e => { if (e.target === lbx) closeLbx(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLbx(); });

/* ── PARALLAX (solo desktop, sin motion-reduce) ── */
if (window.matchMedia('(min-width:768px)').matches &&
    !window.matchMedia('(prefers-reduced-motion:reduce)').matches) {
  window.addEventListener('scroll', () => {
    document.querySelectorAll('.proj-strip').forEach(strip => {
      const bg   = strip.querySelector('.ps-bg');
      if (!bg) return;
      const rect = strip.getBoundingClientRect();
      if (rect.bottom > 0 && rect.top < window.innerHeight) {
        bg.style.transform = `translateY(${(rect.top / window.innerHeight) * 30}px)`;
      }
    });
  }, { passive: true });
}
