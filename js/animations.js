/* ═══════════════════════════════════════════════════════════════
   COURTIQ — PREMIUM ANIMATIONS ENGINE
   Inspired by Unicorn Studio interactive design patterns
   ─────────────────────────────────────────────────────────────
   Modules:
     1. Page Loader
     2. Custom Cursor (spring-physics trailing ring)
     3. Hero Particle Canvas (floating dots + connections)
     4. Stats Counter Animation
     5. 3D Card Tilt (step cards)
     6. Magnetic Buttons
     7. Hero Section Mouse Parallax
     8. Scroll-reveal quality-of-life improvements
═══════════════════════════════════════════════════════════════ */

(function () {
  'use strict';

  const IS_MOBILE   = window.innerWidth < 768;
  const IS_REDUCED  = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const raf         = requestAnimationFrame.bind(window);

  /* ═══════════════════════════════════════════════════════════
     1. PAGE LOADER
  ═══════════════════════════════════════════════════════════ */
  const loader = document.getElementById('page-loader');
  if (loader) {
    const hide = () => loader.classList.add('loaded');
    if (document.readyState === 'complete') {
      setTimeout(hide, 350);
    } else {
      window.addEventListener('load', () => setTimeout(hide, 350));
    }
    // Failsafe: hide after 3.5 seconds no matter what
    setTimeout(hide, 3500);
  }

  /* ═══════════════════════════════════════════════════════════
     2. CUSTOM CURSOR
     Dot snaps instantly; ring follows with spring-lag
  ═══════════════════════════════════════════════════════════ */
  if (!IS_MOBILE && !IS_REDUCED) {
    const dot  = document.getElementById('cursor');
    const ring = document.getElementById('cursor-ring');

    if (dot && ring) {
      let mx = -200, my = -200; // start offscreen
      let rx = -200, ry = -200;

      document.addEventListener('mousemove', (e) => {
        mx = e.clientX;
        my = e.clientY;
        dot.style.left = mx + 'px';
        dot.style.top  = my + 'px';
      });

      // Spring-physics ring loop
      (function animRing() {
        rx += (mx - rx) * 0.13;
        ry += (my - ry) * 0.13;
        ring.style.left = rx + 'px';
        ring.style.top  = ry + 'px';
        raf(animRing);
      })();

      // Hover state: expand cursor
      const interactiveSelector =
        'a, button, [role="tab"], [role="button"], label, .pos-btn, .nav-btn';
      document.querySelectorAll(interactiveSelector).forEach((el) => {
        el.addEventListener('mouseenter', () => {
          dot.classList.add('cursor-hover');
          ring.classList.add('cursor-hover');
        });
        el.addEventListener('mouseleave', () => {
          dot.classList.remove('cursor-hover');
          ring.classList.remove('cursor-hover');
        });
      });

      // Hide when mouse leaves window
      document.addEventListener('mouseleave', () => {
        dot.style.opacity  = '0';
        ring.style.opacity = '0';
      });
      document.addEventListener('mouseenter', () => {
        dot.style.opacity  = '1';
        ring.style.opacity = '1';
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     3. HERO PARTICLE CANVAS
     Drifting dots with amber connection lines
  ═══════════════════════════════════════════════════════════ */
  if (!IS_MOBILE && !IS_REDUCED) {
    const canvas = document.getElementById('hero-particles');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      let W, H, particles = [];

      const COLORS = ['#f5a623', '#3a86ff', 'rgba(240,237,230,0.85)', '#c77dff'];

      function resize() {
        const hero = canvas.closest('.hero');
        W = canvas.width  = hero ? hero.offsetWidth  : window.innerWidth;
        H = canvas.height = hero ? hero.offsetHeight : window.innerHeight;
      }

      function spawn() {
        particles = [];
        const count = Math.min(55, Math.floor((W * H) / 15000));
        for (let i = 0; i < count; i++) {
          particles.push({
            x:  Math.random() * W,
            y:  Math.random() * H,
            vx: (Math.random() - 0.5) * 0.22,
            vy: (Math.random() - 0.5) * 0.22,
            r:  Math.random() * 1.6 + 0.5,
            a:  Math.random() * 0.35 + 0.08,
            c:  COLORS[Math.floor(Math.random() * COLORS.length)],
          });
        }
      }

      function draw() {
        ctx.clearRect(0, 0, W, H);

        // Update + draw particles
        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x = (p.x + p.vx + W) % W;
          p.y = (p.y + p.vy + H) % H;

          ctx.globalAlpha = p.a;
          ctx.fillStyle   = p.c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
          ctx.fill();

          // Draw connections to nearby particles
          for (let j = i + 1; j < particles.length; j++) {
            const q = particles[j];
            const dx = p.x - q.x;
            const dy = p.y - q.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 115) {
              ctx.globalAlpha = 0.055 * (1 - dist / 115);
              ctx.strokeStyle = '#f5a623';
              ctx.lineWidth   = 0.6;
              ctx.beginPath();
              ctx.moveTo(p.x, p.y);
              ctx.lineTo(q.x, q.y);
              ctx.stroke();
            }
          }
        }

        ctx.globalAlpha = 1;
        raf(draw);
      }

      resize();
      spawn();
      draw();

      window.addEventListener('resize', () => { resize(); spawn(); });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     4. STATS COUNTER ANIMATION
     Triggers when stats bar enters viewport
  ═══════════════════════════════════════════════════════════ */
  function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

  function animateCount(el, rawTarget, duration) {
    // Parse numeric value + suffix separately
    const num    = parseFloat(rawTarget.replace(/[^\d.]/g, ''));
    const suffix = rawTarget.replace(/[\d.]/g, '').trim();
    if (isNaN(num)) return;

    const isDecimal = rawTarget.includes('.');
    const t0 = performance.now();

    (function tick(now) {
      const progress = Math.min((now - t0) / duration, 1);
      const eased    = easeOutCubic(progress);
      const current  = num * eased;
      el.textContent = (isDecimal ? current.toFixed(1) : Math.floor(current)) + suffix;
      if (progress < 1) raf(tick);
      else el.textContent = rawTarget; // exact final value
    })(t0);
  }

  const statNums = document.querySelectorAll('.stats-bar-number');
  if (statNums.length) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          const el = e.target;
          const original = el.dataset.orig || el.textContent.trim();
          el.dataset.orig = original;
          animateCount(el, original, 1900);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.6 });
    statNums.forEach((el) => io.observe(el));
  }

  /* ═══════════════════════════════════════════════════════════
     5. 3D CARD TILT — Step Cards
     Gives a depth/perspective feel on mouse movement
  ═══════════════════════════════════════════════════════════ */
  if (!IS_MOBILE && !IS_REDUCED) {
    document.querySelectorAll('.step-card').forEach((card) => {
      let rect;

      card.addEventListener('mouseenter', () => {
        rect = card.getBoundingClientRect();
        card.style.transition = 'transform 0.05s linear, box-shadow 0.4s ease, border-color 0.4s ease, background 0.25s ease';
      });

      card.addEventListener('mousemove', (e) => {
        if (!rect) return;
        const xPct = (e.clientX - rect.left) / rect.width  - 0.5; // -0.5 → 0.5
        const yPct = (e.clientY - rect.top)  / rect.height - 0.5;
        const xRot =  yPct * -10; // tilt X axis (vertical mouse → X rotation)
        const yRot =  xPct *  10; // tilt Y axis (horizontal mouse → Y rotation)
        card.style.transform = `perspective(700px) rotateX(${xRot}deg) rotateY(${yRot}deg) translateY(-6px) scale(1.02)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform  = '';
        card.style.transition = 'transform 0.6s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease, background 0.25s ease';
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     6. MAGNETIC BUTTONS
     Primary CTA buttons slightly follow the cursor
  ═══════════════════════════════════════════════════════════ */
  if (!IS_MOBILE && !IS_REDUCED) {
    document.querySelectorAll('.btn-primary, .nav-btn').forEach((btn) => {
      btn.addEventListener('mouseenter', () => {
        btn.style.transition = 'transform 0.12s ease, box-shadow 0.2s ease, background 0.2s ease';
      });
      btn.addEventListener('mousemove', (e) => {
        const r  = btn.getBoundingClientRect();
        const dx = ((e.clientX - r.left) / r.width  - 0.5) * 20;
        const dy = ((e.clientY - r.top)  / r.height - 0.5) * 12;
        btn.style.transform = `translate(${dx}px, ${dy}px)`;
      });
      btn.addEventListener('mouseleave', () => {
        btn.style.transform  = '';
        btn.style.transition = 'transform 0.55s cubic-bezier(0.16,1,0.3,1), box-shadow 0.2s ease, background 0.2s ease';
      });
    });
  }

  /* ═══════════════════════════════════════════════════════════
     7. HERO SECTION MOUSE PARALLAX
     Card gently drifts with cursor movement
  ═══════════════════════════════════════════════════════════ */
  if (!IS_MOBILE && !IS_REDUCED) {
    const heroSection = document.querySelector('.hero');
    const heroVisual  = document.querySelector('.hero-visual');

    if (heroSection && heroVisual) {
      heroSection.addEventListener('mousemove', (e) => {
        const r  = heroSection.getBoundingClientRect();
        const nx = (e.clientX - r.left) / r.width  - 0.5; // -0.5 → 0.5
        const ny = (e.clientY - r.top)  / r.height - 0.5;
        heroVisual.style.transform  = `translate(${nx * 14}px, ${ny * 9}px)`;
        heroVisual.style.transition = 'transform 0.5s ease';
      });
      heroSection.addEventListener('mouseleave', () => {
        heroVisual.style.transform  = '';
        heroVisual.style.transition = 'transform 1.2s cubic-bezier(0.16,1,0.3,1)';
      });
    }
  }

  /* ═══════════════════════════════════════════════════════════
     8. SCROLL-BASED PROGRESS GLOW
     The scroll indicator fades out once user starts scrolling
  ═══════════════════════════════════════════════════════════ */
  const scrollInd = document.querySelector('.scroll-indicator');
  if (scrollInd) {
    window.addEventListener('scroll', () => {
      const scrolled = window.scrollY > 80;
      scrollInd.style.opacity    = scrolled ? '0' : '';
      scrollInd.style.transition = 'opacity 0.4s ease';
    }, { passive: true });
  }

  /* ═══════════════════════════════════════════════════════════
     UTILITY: Log init complete
  ═══════════════════════════════════════════════════════════ */
  if (typeof console !== 'undefined') {
    console.log('%c⚡ CourtIQ Animations Ready', 'color:#f5a623;font-weight:700;font-size:13px;');
  }

})();
