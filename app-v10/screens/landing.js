/* app-v10/screens/landing.js — the front door
   ============================================================
   The first thing a new player ever sees: real basketball rolling
   behind the brand, a language choice, and three ways in — create a
   profile, sign in, or try it first as a guest.

   The video is licensed footage (Pexels, free-to-use) compressed to
   under a megabyte and shipped IN the bundle, so the front door works
   on a court with no signal — the same rule as the fonts and models.
   If it ever fails to play, the poster gradient carries the screen;
   nothing here depends on the video existing.

   The auth form lives in a slide-up sheet on this same screen rather
   than a separate page, so the video never cuts away during the whole
   first-run flow. Guests skip straight to onboarding — the combine and
   avatar are the fun part, and asking for a password before showing
   any value is how apps lose people at the door.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, V12 = window.V12;

  function t(k) { return window.V12I18n ? window.V12I18n.t(k) : k; }

  /* ── the brand lockup, real logo ──────────────────────────────*/
  function brand() {
    return h('div', { class: 'ld12-brand' }, [
      /* light variant: the mark's hand is navy, invisible on the navy
         landing — this one wears cream so the whole logo reads */
      h('img', { src: 'assets/logomark-light.svg', alt: '', class: 'ld12-brand__mark' }),
      h('div', { class: 'ld12-brand__word' }, [
        document.createTextNode('COURT'), h('em', { text: 'IQ' })
      ]),
      h('div', { class: 'ld12-brand__tag', text: t('landing.tagline') })
    ]);
  }

  /* ── rotating value lines ─────────────────────────────────────*/
  function valueTicker() {
    var KEYS = ['landing.value.1', 'landing.value.2', 'landing.value.3'];
    var i = 0;
    var el = h('div', { class: 'ld12-value', text: t(KEYS[0]) });
    var timer = setInterval(function () {
      if (!el.isConnected) { clearInterval(timer); return; }
      i = (i + 1) % KEYS.length;
      el.classList.add('is-out');
      setTimeout(function () {
        el.textContent = t(KEYS[i]);
        el.classList.remove('is-out');
      }, 260);
    }, 3400);
    return el;
  }

  /* ── language chips ───────────────────────────────────────────*/
  function langPicker(onPick) {
    var wrap = h('div', { class: 'ld12-langs' });
    (window.V12I18n ? window.V12I18n.LANGS : []).forEach(function (l) {
      var active = window.V12I18n.current() === l.code;
      var chip = h('button', {
        class: 'ld12-lang' + (active ? ' is-on' : ''), type: 'button',
        onclick: function () {
          window.V12I18n.set(l.code);
          onPick();
        }
      }, [
        h('span', { class: 'ld12-lang__flag', text: l.flag }),
        h('span', { text: l.label })
      ]);
      wrap.appendChild(chip);
    });
    return wrap;
  }

  /* ── the auth sheet ───────────────────────────────────────────
     One sheet, two modes. Field-level validation happens before the
     network is touched, and every message speaks the chosen language. */
  function authSheet(ctx, mode, close) {
    var isUp = mode === 'signup';

    function field(labelKey, type, autocomplete, placeholder) {
      var input = h('input', {
        class: 'ld12-in', type: type, placeholder: placeholder || '',
        autocomplete: autocomplete, spellcheck: 'false'
      });
      return {
        el: h('div', { class: 'ld12-field' }, [
          h('label', { class: 'd-label', text: t(labelKey) }), input
        ]),
        input: input
      };
    }

    var nameF  = field('auth.name', 'text', 'given-name', 'Alex');
    var emailF = field('auth.email', 'email', 'email', 'you@hoops.com');
    var passF  = field('auth.password', 'password',
                       isUp ? 'new-password' : 'current-password', '••••••••');
    if (!isUp) nameF.el.style.display = 'none';

    var msg = h('div', { class: 'ld12-msg' });
    function setMsg(text, ok) {
      msg.textContent = text || '';
      msg.classList.toggle('is-ok', !!ok);
    }

    var cta = V12.btn({
      label: t(isUp ? 'auth.cta.signup' : 'auth.cta.signin'),
      icon: isUp ? 'ph-rocket-launch' : 'ph-sign-in',
      onClick: submit
    });

    var busy = false;
    function submit() {
      if (busy) return;
      var name = (nameF.input.value || '').trim();
      var email = (emailF.input.value || '').trim();
      var pass = passF.input.value || '';
      if (isUp && !name)                    { setMsg(t('auth.err.name')); nameF.input.focus(); return; }
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg(t('auth.err.email')); emailF.input.focus(); return; }
      if (pass.length < 6)                  { setMsg(t('auth.err.password')); passF.input.focus(); return; }

      busy = true; cta.setAttribute('disabled', 'true'); setMsg('');
      var call = isUp
        ? window.V10Auth.signUp(email, pass, { first_name: name })
        : window.V10Auth.signIn(email, pass);

      call.then(function (res) {
        busy = false; cta.removeAttribute('disabled');
        if (res && res.error) { setMsg(res.error.message || 'Something went wrong'); return; }
        /* A brand-new profile heads into the combine; a returning player
           goes home. courtiq_onboarded is the same flag bootstrap uses. */
        var onboarded = false;
        try { onboarded = !!localStorage.getItem('courtiq_onboarded'); } catch (e) {}
        ctx.go(!isUp && onboarded ? 'home' : 'onboarding');
      }).catch(function (e) {
        busy = false; cta.removeAttribute('disabled');
        setMsg((e && e.message) || 'Network error — try again');
      });
    }
    passF.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });

    var forgot = h('button', { class: 'ld12-link', type: 'button', text: t('auth.forgot') });
    forgot.style.display = isUp ? 'none' : '';
    forgot.addEventListener('click', function () {
      var email = (emailF.input.value || '').trim();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { setMsg(t('auth.err.email')); return; }
      window.V10Auth.resetPassword(email).then(function () { setMsg(t('auth.reset.sent'), true); });
    });

    var swtch = h('button', {
      class: 'ld12-link', type: 'button',
      text: t(isUp ? 'auth.switch.tosignin' : 'auth.switch.tosignup')
    });

    var sheet = h('div', { class: 'ld12-sheet' }, [
      h('div', { class: 'ld12-sheet__grab' }),
      h('div', { class: 'ld12-sheet__t', text: t(isUp ? 'auth.title.signup' : 'auth.title.signin') }),
      h('div', { class: 'ld12-sheet__s', text: t(isUp ? 'auth.sub.signup' : 'auth.sub.signin') }),
      nameF.el, emailF.el, passF.el, msg, cta,
      h('div', { class: 'ld12-sheet__links' }, [forgot, swtch]),
      h('button', { class: 'ld12-link ld12-back', type: 'button', text: t('auth.back'),
        onclick: function () { close(); } })
    ]);

    swtch.addEventListener('click', function () {
      close();
      openSheet(ctx, isUp ? 'signin' : 'signup');
    });

    return sheet;
  }

  var sheetHost = null;
  function openSheet(ctx, mode) {
    closeSheet();
    var scrim = h('div', { class: 'ld12-scrim', onclick: closeSheet });
    var sheet = authSheet(ctx, mode, closeSheet);
    sheetHost = h('div', { class: 'ld12-sheethost' }, [scrim, sheet]);
    document.body.appendChild(sheetHost);
    /* next frame so the slide-up transition actually runs */
    setTimeout(function () { if (sheetHost) sheetHost.classList.add('is-open'); }, 20);
  }
  function closeSheet() {
    if (!sheetHost) return;
    var el = sheetHost; sheetHost = null;
    el.classList.remove('is-open');
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;

    /* Signed-in players never see the front door — unless they asked
       for it from Settings ("Redo intro & setup"), which leaves a
       one-visit pass. */
    var redo = false;
    try {
      redo = sessionStorage.getItem('courtiq_redo_intro') === '1';
      if (redo) sessionStorage.removeItem('courtiq_redo_intro');
    } catch (e) {}
    if (!redo && window.V10Auth && window.V10Auth.user()) { ctx.go('home'); return; }

    function paint() {
      while (host.firstChild) host.removeChild(host.firstChild);

      var video = h('video', {
        class: 'ld12-video', src: 'assets/court-loop.mp4',
        autoplay: 'autoplay', muted: 'muted', loop: 'loop',
        playsinline: 'playsinline', 'aria-hidden': 'true'
      });
      /* Attributes are not enough for iOS WebViews — the properties must
         be set before play() or autoplay is refused. */
      video.muted = true;
      video.setAttribute('muted', '');
      var tryPlay = function () {
        var p = video.play();
        if (p && p.catch) p.catch(function () { /* poster carries it */ });
      };
      video.addEventListener('loadeddata', tryPlay);

      host.appendChild(h('div', { class: 'ld12' }, [
        video,
        h('div', { class: 'ld12-shade' }),
        h('div', { class: 'ld12-content' }, [
          langPicker(paint),
          brand(),
          valueTicker(),
          h('div', { class: 'ld12-ctas' }, [
            V12.btn({ label: t('landing.create'), icon: 'ph-rocket-launch',
              onClick: function () { openSheet(ctx, 'signup'); } }),
            h('button', {
              class: 'd-btn d-btn--ghost ld12-ghost', type: 'button',
              onclick: function () { openSheet(ctx, 'signin'); }
            }, [h('i', { class: 'ph-bold ph-sign-in' }), h('span', { text: t('landing.signin') })]),
            h('button', {
              class: 'ld12-guest', type: 'button',
              onclick: function () { ctx.go('onboarding'); }
            }, [h('span', { text: t('landing.guest') }), h('i', { class: 'ph-bold ph-arrow-right' })])
          ])
        ])
      ]));
    }

    paint();
  }

  window.app.register('landing', render);
})();
