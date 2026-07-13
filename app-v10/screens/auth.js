/* app-v10/screens/auth.js
   SIGN IN / SIGN UP — email+password via Supabase, v10 magazine styling.
   Anonymous use stays possible everywhere (localStorage fallback); this
   screen exists so sessions and XP survive across devices.
   ============================================================ */
(function () {
  'use strict';
  var h = window.V10UI.h, icon = window.V10UI.icon;

  function field(opts) {
    var input = h('input', {
      type: opts.type || 'text',
      placeholder: opts.placeholder || '',
      autocomplete: opts.autocomplete || 'off',
      style: {
        width: '100%', padding: '13px 14px',
        border: '2.5px solid var(--ink)', borderRadius: '10px',
        background: 'var(--cream)', color: 'var(--ink)',
        fontFamily: 'var(--font-mono)', fontSize: '14px',
        outline: 'none', boxShadow: '2px 2px 0 var(--ink)'
      }
    });
    input.addEventListener('focus', function () { input.style.boxShadow = '2px 2px 0 var(--tomato)'; });
    input.addEventListener('blur',  function () { input.style.boxShadow = '2px 2px 0 var(--ink)'; });
    var wrap = h('div', { style: { display: 'flex', flexDirection: 'column', gap: '5px' } }, [
      h('label', {
        style: { fontFamily: 'var(--font-display)', fontWeight: '800', fontSize: '11px', letterSpacing: '0.08em' },
        text: opts.label
      }),
      input
    ]);
    return { el: wrap, input: input };
  }

  function render(args) {
    var host = args.host, ctx = args.ctx;
    var mode = 'signin';   // 'signin' | 'signup'

    host.style.display = 'flex';
    host.style.flexDirection = 'column';
    host.style.minHeight = '100%';

    // Already signed in → straight to the profile.
    if (window.V10Auth && window.V10Auth.user()) { ctx.go('me'); return; }

    var title  = h('div', {
      style: { fontFamily: 'var(--font-display)', fontWeight: '900', fontSize: '30px', letterSpacing: '0.03em', margin: '6px 0 2px' },
      text: 'SIGN IN'
    });
    var sub = h('div', {
      style: { fontFamily: 'var(--font-body)', fontStyle: 'italic', fontSize: '13.5px', opacity: '0.75', marginBottom: '14px' },
      text: 'Your sessions, XP and streaks — on every device.'
    });

    var nameF  = field({ label: 'FIRST NAME', placeholder: 'Alex', autocomplete: 'given-name' });
    var emailF = field({ label: 'EMAIL', type: 'email', placeholder: 'you@hoops.com', autocomplete: 'email' });
    var passF  = field({ label: 'PASSWORD', type: 'password', placeholder: '••••••••', autocomplete: 'current-password' });
    nameF.el.style.display = 'none';

    var msg = h('div', {
      style: { minHeight: '18px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--tomato)', margin: '4px 0' }
    });
    function setMsg(text, ok) {
      msg.textContent = text || '';
      msg.style.color = ok ? '#3D7A53' : 'var(--tomato)';
    }

    var busy = false;
    var mainBtn = ctx.ui.cta({
      variant: 'orange',
      icon: 'ph-sign-in',
      label: 'SIGN IN',
      onClick: submit
    });

    function submit() {
      if (busy) return;
      var email = emailF.input.value.trim();
      var pass  = passF.input.value;
      if (!email || !pass) { setMsg('Email and password are required.'); return; }
      if (mode === 'signup' && pass.length < 6) { setMsg('Password needs at least 6 characters.'); return; }
      busy = true; setMsg(mode === 'signup' ? 'Creating account…' : 'Signing in…', true);

      var call = mode === 'signup'
        ? window.V10Auth.signUp(email, pass, nameF.input.value.trim())
        : window.V10Auth.signIn(email, pass);

      call.then(function (res) {
        busy = false;
        if (res.error) { setMsg(res.error.message || 'Something went wrong.'); return; }
        var session = res.data && res.data.session;
        if (!session && mode === 'signup') {
          // Email confirmations are ON in this project — no session until
          // the link in the mail is clicked.
          setMsg('Check your email to confirm the account, then sign in.', true);
          switchMode('signin');
          return;
        }
        setMsg('Welcome!', true);
        setTimeout(function () { ctx.go('me'); }, 250);
      }).catch(function (e) {
        busy = false;
        setMsg((e && e.message) || 'Network error — try again.');
      });
    }

    var switchRow = h('div', {
      style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px' }
    });
    var switchBtn = h('button', {
      style: { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '12px', textDecoration: 'underline', color: 'var(--ink)' },
      text: 'New here? Create account'
    });
    var forgotBtn = h('button', {
      style: { background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '12px', textDecoration: 'underline', color: 'var(--ink)', opacity: '0.75' },
      text: 'Forgot password?'
    });
    switchRow.appendChild(switchBtn);
    switchRow.appendChild(forgotBtn);

    function switchMode(next) {
      mode = next;
      var signup = mode === 'signup';
      title.textContent = signup ? 'CREATE ACCOUNT' : 'SIGN IN';
      nameF.el.style.display = signup ? '' : 'none';
      passF.input.autocomplete = signup ? 'new-password' : 'current-password';
      switchBtn.textContent = signup ? 'Have an account? Sign in' : 'New here? Create account';
      var lbl = mainBtn.querySelector ? mainBtn.querySelector('.v10-cta__label') : null;
      if (lbl) lbl.textContent = signup ? 'CREATE ACCOUNT' : 'SIGN IN';
      else mainBtn.textContent = signup ? 'CREATE ACCOUNT' : 'SIGN IN';
      setMsg('');
    }
    switchBtn.addEventListener('click', function () {
      switchMode(mode === 'signin' ? 'signup' : 'signin');
    });
    forgotBtn.addEventListener('click', function () {
      var email = emailF.input.value.trim();
      if (!email) { setMsg('Type your email first, then tap "Forgot password".'); return; }
      window.V10Auth.resetPassword(email).then(function (res) {
        if (res.error) setMsg(res.error.message);
        else setMsg('Reset link sent — check your email.', true);
      });
    });
    passF.input.addEventListener('keydown', function (e) { if (e.key === 'Enter') submit(); });

    // Back chip
    host.appendChild(h('div', { class: 'v10-chips' }, [
      h('button', {
        class: 'v10-chip',
        style: { flex: '0 0 auto', minWidth: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' },
        onclick: function () { ctx.go('me'); }
      }, [icon('ph-arrow-left'), h('span', { text: 'BACK' })]),
      h('div', { class: 'v10-chip', style: { flex: 1, background: 'var(--ink)', color: 'var(--cream)' }, text: 'ACCOUNT' })
    ]));

    host.appendChild(title);
    host.appendChild(sub);
    host.appendChild(h('div', { style: { display: 'flex', flexDirection: 'column', gap: '12px' } }, [
      nameF.el, emailF.el, passF.el
    ]));
    host.appendChild(msg);
    host.appendChild(h('div', { style: { marginTop: '6px' } }, [mainBtn]));
    host.appendChild(switchRow);
    host.appendChild(h('div', { style: { flex: '1 1 auto' } }));
    host.appendChild(h('div', {
      style: { fontFamily: 'var(--font-mono)', fontSize: '10.5px', opacity: '0.55', textAlign: 'center', paddingBottom: '8px' },
      text: 'You can keep using CourtIQ without an account — data stays on this device only.'
    }));
  }

  window.app.register('auth', render);
})();
