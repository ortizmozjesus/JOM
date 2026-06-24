// =========================
// UTILIDAD: BLOQUEAR SCROLL
// =========================
const lockScroll = () => {
  document.body.style.overflow = 'hidden';
};

const unlockScroll = () => {
  document.body.style.overflow = '';
};

// =========================
// HEADER SCROLL
// =========================
const header = document.getElementById('hdr');

window.addEventListener('scroll', () => {
  if (window.scrollY > 10) {
    header.classList.add('scrolled');
  } else {
    header.classList.remove('scrolled');
  }
});

// =========================
// HAMBURGER + MENÚ MÓVIL
// =========================
const hbg = document.getElementById('hbg');
const mob = document.getElementById('mob');
const mobClose = document.getElementById('mobClose');
const mobLinks = mob.querySelectorAll('a');

const openMobMenu = () => {
  mob.classList.add('open');
  hbg.classList.add('open');
  lockScroll();
};

const closeMobMenu = () => {
  mob.classList.remove('open');
  hbg.classList.remove('open');
  unlockScroll();
};

hbg.addEventListener('click', () => {
  if (mob.classList.contains('open')) {
    closeMobMenu();
  } else {
    openMobMenu();
  }
});

mobClose.addEventListener('click', closeMobMenu);

// Cerrar menú móvil al hacer click en un link
mobLinks.forEach(link => {
  link.addEventListener('click', () => {
    closeMobMenu();
  });
});

// =========================
/* SMOOTH SCROLL MANUAL (para compensar header fijo) */
// =========================
const headerHeight = () => header.getBoundingClientRect().height;

const smoothScrollTo = (targetId) => {
  const el = document.querySelector(targetId);
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const offset = window.pageYOffset + rect.top - headerHeight() + 1;

  window.scrollTo({
    top: offset,
    behavior: 'smooth'
  });
};

// Navegación principal (desktop + móvil)
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const href = link.getAttribute('href');
    if (href && href.startsWith('#') && href.length > 1) {
      e.preventDefault();
      smoothScrollTo(href);
    }
  });
});

// =========================
// PARALLAX HERO (seguimiento del ratón)
// =========================
const hero = document.getElementById('hero');
const heroGrid = document.querySelector('.hero-grid');

if (hero && heroGrid) {
  hero.addEventListener('mousemove', (e) => {
    const rect = hero.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;

    const moveX = x * -20;
    const moveY = y * -20;

    heroGrid.style.transform = `translate3d(${moveX}px, ${moveY}px, 0)`;
  });

  hero.addEventListener('mouseleave', () => {
    heroGrid.style.transform = 'translate3d(0,0,0)';
  });
}

// =========================
// FRANJAS DE PROYECTOS: OPEN/CLOSE + PARALLAX
// =========================
const strips = document.querySelectorAll('.proj-strip');

strips.forEach(strip => {
  const headerStrip = strip.querySelector('.ps-header');
  const bg = strip.querySelector('.ps-bg');

  // Abrir/cerrar al click en cabecera
  if (headerStrip) {
    headerStrip.addEventListener('click', () => {
      const isOpen = strip.classList.contains('open');

      // Cerrar otras
      strips.forEach(s => {
        if (s !== strip) {
          s.classList.remove('open');
        }
      });

      // Toggle actual
      if (!isOpen) {
        strip.classList.add('open');
      } else {
        strip.classList.remove('open');
      }
    });
  }

  // Parallax con ratón por franja
  if (bg) {
    strip.addEventListener('mousemove', (e) => {
      const rect = strip.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;

      const moveX = x * 18;
      const moveY = y * 18;

      bg.style.transform = `translate3d(${moveX}px, ${moveY}px, 0) scale(1.05)`;
    });

    strip.addEventListener('mouseleave', () => {
      bg.style.transform = 'translate3d(0,0,0) scale(1.02)';
    });
  }
});

// Parallax suave de fondo con scroll
window.addEventListener('scroll', () => {
  const winH = window.innerHeight;

  strips.forEach(strip => {
    const bg = strip.querySelector('.ps-bg');
    if (!bg) return;

    const rect = strip.getBoundingClientRect();
    const center = rect.top + rect.height / 2;
    const distToCenter = center - winH / 2;

    const parallax = distToCenter * -0.05;
    bg.style.transform = `translate3d(0, ${parallax}px, 0) scale(1.05)`;
  });
});

// =========================
// IDIOMA ES / EN
// =========================
const langButtons = document.querySelectorAll('[data-l]');
let currentLang = 'es';

const applyLang = (lang) => {
  currentLang = lang;

  // Marcar botones activos (header + móvil)
  langButtons.forEach(btn => {
    const l = btn.getAttribute('data-l');
    if (!l) return;
    if (l === lang) {
      btn.classList.add('la');
    } else {
      btn.classList.remove('la');
    }
  });

  // Cambiar todos los elementos con data-es / data-en
  const translatable = document.querySelectorAll('[data-es][data-en]');
  translatable.forEach(el => {
    const text = el.getAttribute(`data-${lang}`);
    if (text) {
      el.textContent = text;
    }
  });
};

// Botón del header
const headerLangBtn = document.getElementById('lb');
if (headerLangBtn) {
  headerLangBtn.addEventListener('click', () => {
    const nextLang = currentLang === 'es' ? 'en' : 'es';
    applyLang(nextLang);
  });
}

// Botones del menú móvil
const mobLangBtns = document.querySelectorAll('.mob-lang [data-l]');
mobLangBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const lang = btn.getAttribute('data-l');
    if (!lang) return;
    applyLang(lang);
  });
});

// Idioma inicial
applyLang('es');

// =========================
// FADE IN ON SCROLL
// =========================
const fadeEls = document.querySelectorAll('.fade-in');

if ('IntersectionObserver' in window && fadeEls.length) {
  const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        fadeObserver.unobserve(entry.target);
      }
    });
  }, {
    threshold: 0.2
  });

  fadeEls.forEach(el => fadeObserver.observe(el));
} else {
  fadeEls.forEach(el => el.classList.add('in-view'));
}

// =========================
// LIGHTBOX MISCELLANEOUS
// =========================
const miscImages = document.querySelectorAll('.misc-img-wrap img');

let lightboxEl = null;
let lightboxImg = null;

const createLightbox = () => {
  lightboxEl = document.createElement('div');
  lightboxEl.className = 'lightbox-overlay';
  lightboxEl.innerHTML = `
    <div class="lightbox-inner">
      <button class="lightbox-close" aria-label="Cerrar">✕</button>
      <img class="lightbox-img" src="" alt="Preview">
    </div>
  `;
  document.body.appendChild(lightboxEl);

  lightboxImg = lightboxEl.querySelector('.lightbox-img');

  lightboxEl.addEventListener('click', (e) => {
    if (e.target === lightboxEl || e.target.classList.contains('lightbox-close')) {
      closeLightbox();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightboxEl.classList.contains('open')) {
      closeLightbox();
    }
  });
};

const openLightbox = (src, alt) => {
  if (!lightboxEl) createLightbox();
  lightboxImg.src = src;
  lightboxImg.alt = alt || '';
  lightboxEl.classList.add('open');
  lockScroll();
};

const closeLightbox = () => {
  if (!lightboxEl) return;
  lightboxEl.classList.remove('open');
  unlockScroll();
};

miscImages.forEach(img => {
  img.style.cursor = 'zoom-in';
  img.addEventListener('click', () => {
    openLightbox(img.src, img.alt);
  });
});

// =========================
// NAV LINK ACTIVO POR SECCIÓN
// =========================
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('nav .nl');

const setActiveNav = () => {
  let currentId = null;
  const offset = headerHeight() + 40;

  sections.forEach(sec => {
    const rect = sec.getBoundingClientRect();
    const top = rect.top - offset;
    const bottom = rect.bottom - offset;

    if (top <= 0 && bottom > 0) {
      currentId = sec.id;
    }
  });

  navLinks.forEach(link => {
    const href = link.getAttribute('href');
    if (!href || !href.startsWith('#')) return;
    const targetId = href.slice(1);

    if (targetId === currentId) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
};

window.addEventListener('scroll', setActiveNav);
window.addEventListener('load', setActiveNav);
window.addEventListener('resize', setActiveNav);