/* ══════════════════════════════════════════════════════════════
   GSAP ANIMATIONS — CourtIQ micro-interactions & transitions
   ══════════════════════════════════════════════════════════════ */

window.CourtIQAnimations = (function () {
  'use strict';

  function hasGSAP() { return typeof gsap !== 'undefined'; }

  /* ── Tab panel entrance ──────────────────────────────────── */
  function tabIn(panel) {
    if (!hasGSAP() || !panel) return;

    gsap.fromTo(panel,
      { opacity: 0, y: 18 },
      { opacity: 1, y: 0, duration: 0.45, ease: 'expo.out' }
    );

    // Stagger child cards
    var cards = panel.querySelectorAll('.db-card, .db-kpi, .card-stat, .card-interactive');
    if (cards.length) {
      gsap.fromTo(cards,
        { opacity: 0, y: 14, scale: 0.97 },
        { opacity: 1, y: 0, scale: 1, duration: 0.4, stagger: 0.06, ease: 'back.out(1.4)', delay: 0.08 }
      );
    }
  }

  /* ── Animate counter 0 → target ─────────────────────────── */
  function counter(el, target, suffix) {
    if (!hasGSAP() || !el) return;
    suffix = suffix || '';
    var obj = { val: 0 };
    gsap.to(obj, {
      val: target,
      duration: 1.2,
      ease: 'expo.out',
      onUpdate: function () {
        el.textContent = Math.round(obj.val) + suffix;
      }
    });
  }

  /* ── KPI card stagger entrance ──────────────────────────── */
  function kpiCards() {
    if (!hasGSAP()) return;
    var kpis = document.querySelectorAll('.db-kpi');
    if (!kpis.length) return;
    gsap.fromTo(kpis,
      { opacity: 0, y: 20, scale: 0.95 },
      { opacity: 1, y: 0, scale: 1, duration: 0.5, stagger: 0.08, ease: 'back.out(1.7)' }
    );
  }

  /* ── Generic card entrance stagger ──────────────────────── */
  function cardEntrance(selector) {
    if (!hasGSAP()) return;
    var cards = document.querySelectorAll(selector);
    if (!cards.length) return;
    gsap.fromTo(cards,
      { opacity: 0, y: 24 },
      { opacity: 1, y: 0, duration: 0.45, stagger: 0.07, ease: 'expo.out' }
    );
  }

  /* ── New session card slide-in ──────────────────────────── */
  function sessionCard(el) {
    if (!hasGSAP() || !el) return;
    gsap.fromTo(el,
      { opacity: 0, x: -30, scale: 0.96 },
      { opacity: 1, x: 0, scale: 1, duration: 0.5, ease: 'back.out(1.4)' }
    );
  }

  /* ── List item stagger ─────────────────────────────────── */
  function listStagger(items) {
    if (!hasGSAP() || !items || !items.length) return;
    gsap.fromTo(items,
      { opacity: 0, x: -12 },
      { opacity: 1, x: 0, duration: 0.35, stagger: 0.04, ease: 'power2.out' }
    );
  }

  /* ── Sidebar entrance (on page load) ───────────────────── */
  function sidebarEntrance() {
    if (!hasGSAP()) return;
    var sidebar = document.getElementById('db-sidebar');
    if (!sidebar) return;
    gsap.fromTo(sidebar,
      { x: -20, opacity: 0 },
      { x: 0, opacity: 1, duration: 0.6, ease: 'expo.out' }
    );
    var items = sidebar.querySelectorAll('.db-sidebar-item');
    if (items.length) {
      gsap.fromTo(items,
        { opacity: 0, x: -10 },
        { opacity: 1, x: 0, duration: 0.35, stagger: 0.03, ease: 'power2.out', delay: 0.15 }
      );
    }
  }

  /* ── Page load entrance ────────────────────────────────── */
  function pageEntrance() {
    if (!hasGSAP()) return;
    sidebarEntrance();
    // Slight delay for main content
    var main = document.querySelector('.db-main-inner');
    if (main) {
      gsap.fromTo(main,
        { opacity: 0 },
        { opacity: 1, duration: 0.5, ease: 'power2.out', delay: 0.2 }
      );
    }
    // KPI cards stagger
    setTimeout(kpiCards, 300);
  }

  // Auto-run page entrance on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', pageEntrance);
  } else {
    setTimeout(pageEntrance, 50);
  }

  return {
    tabIn: tabIn,
    counter: counter,
    kpiCards: kpiCards,
    cardEntrance: cardEntrance,
    sessionCard: sessionCard,
    listStagger: listStagger,
    sidebarEntrance: sidebarEntrance,
    pageEntrance: pageEntrance
  };
})();
