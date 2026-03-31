  /* ══════════════════════════════════════════════════════════════
     NAVBAR SCROLL
  ══════════════════════════════════════════════════════════════ */
  const navbar = document.getElementById('navbar');
  const backToTop = document.getElementById('back-to-top');
  const scrollProgress = document.getElementById('scroll-progress');
  let ticking = false;

  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const scrollY = window.scrollY;
        const docH = document.documentElement.scrollHeight - window.innerHeight;

        // Navbar scroll class
        navbar.classList.toggle('scrolled', scrollY > 30);

        // Back to top visibility
        backToTop && backToTop.classList.toggle('visible', scrollY > 400);

        // Scroll progress bar
        if (scrollProgress) scrollProgress.style.width = (docH > 0 ? (scrollY / docH) * 100 : 0) + '%';

        ticking = false;
      });
      ticking = true;
    }
  });

  /* ══════════════════════════════════════════════════════════════
     TOAST HELPER
  ══════════════════════════════════════════════════════════════ */
  let toastTimer = null;
  function showToast(msg, isError) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = (isError ? '⚠ ' : '✓ ') + msg;
    t.classList.toggle('error', !!isError);
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
  }

  /* ══════════════════════════════════════════════════════════════
     SCROLL REVEAL
  ══════════════════════════════════════════════════════════════ */
  const reveals = document.querySelectorAll('.reveal');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
  reveals.forEach(el => revealObserver.observe(el));
  document.querySelectorAll('.hero .reveal, .hero-content *').forEach(el => el.classList.add('visible'));

  /* ══════════════════════════════════════════════════════════════
     MOBILE NAV — proper drawer, no inline style hacks
  ══════════════════════════════════════════════════════════════ */
  const mobileToggle = document.getElementById('mobileToggle');
  const mobileDrawer = document.getElementById('mobileDrawer');
  let navOpen = false;

  function closeMobileNav() {
    navOpen = false;
    mobileDrawer.classList.remove('open');
    mobileToggle.classList.remove('open');
    mobileToggle.setAttribute('aria-expanded', 'false');
    mobileToggle.setAttribute('aria-label', 'Open menu');
  }

  if (mobileToggle && mobileDrawer) {
    mobileToggle.addEventListener('click', () => {
      navOpen = !navOpen;
      mobileDrawer.classList.toggle('open', navOpen);
      mobileToggle.classList.toggle('open', navOpen);
      mobileToggle.setAttribute('aria-expanded', String(navOpen));
      mobileToggle.setAttribute('aria-label', navOpen ? 'Close menu' : 'Open menu');
    });

    // Close drawer when clicking outside
    document.addEventListener('click', (e) => {
      if (navOpen && !mobileToggle.contains(e.target) && !mobileDrawer.contains(e.target)) {
        closeMobileNav();
      }
    });

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && navOpen) closeMobileNav();
    });
  }

  /* ══════════════════════════════════════════════════════════════
     SMOOTH SCROLL
  ══════════════════════════════════════════════════════════════ */
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const t = document.querySelector(a.getAttribute('href'));
      if (t) { e.preventDefault(); t.scrollIntoView({ behavior:'smooth', block:'start' }); }
    });
  });

  /* ══════════════════════════════════════════════════════════════
     STATS COUNTER
  ══════════════════════════════════════════════════════════════ */
  const statNumbers = document.querySelectorAll('.stats-bar-number');
  const statsData = [
    { target:12400, suffix:'K+', divisor:1000 },
    { target:500,   suffix:'+',  divisor:1 },
    { target:94,    suffix:'%',  divisor:1 },
    { target:5,     suffix:'',   divisor:1 },
  ];
  let statsAnimated = false;
  new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting && !statsAnimated) {
      statsAnimated = true;
      statNumbers.forEach((el, i) => {
        const d = statsData[i], steps = 60, dur = 1800;
        let cur = 0;
        const iv = setInterval(() => {
          cur = Math.min(cur + d.target / steps, d.target);
          el.textContent = i === 0 ? Math.round(cur/1000)+'K+' : Math.round(cur)+d.suffix;
          if (cur >= d.target) clearInterval(iv);
        }, dur / steps);
      });
    }
  }, { threshold:0.5 }).observe(document.querySelector('.stats-bar') || document.createElement('div'));

