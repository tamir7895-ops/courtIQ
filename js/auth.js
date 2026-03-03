     AUTH MODAL
  ══════════════════════════════════════════════════════════════ */
  function openAuth(mode, plan) {
    const overlay = document.getElementById('authOverlay');
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    switchAuthTab(mode || 'signup');

    // Pre-select plan context in submit button
    if (plan && mode === 'signup') {
      const planLabels = { starter: 'Start Free Trial', pro: 'Start Pro Free Trial →', elite: 'Go Elite' };
      const btn = document.getElementById('su-submit');
      if (btn) btn.textContent = planLabels[plan] || 'Create Account →';
    }

    // Set focus
    setTimeout(() => {
      const firstInput = overlay.querySelector('.auth-form-pane.active .auth-input');
      if (firstInput) firstInput.focus();
    }, 350);
  }

  function closeAuth() {
    document.getElementById('authOverlay').classList.remove('active');
    document.body.style.overflow = '';
    // Reset error state
    document.getElementById('auth-error').style.display = 'none';
    document.querySelectorAll('.auth-input').forEach(i => i.classList.remove('error'));
    // Hide success, show forms
    document.getElementById('auth-success').classList.remove('show');
    document.querySelectorAll('.auth-form-pane, .auth-tabs, .auth-error-msg').forEach(el => {
      if (el.tagName !== 'DIV' || !el.classList.contains('auth-error-msg')) {
        el.style.display = '';
      }
    });
  }

  function handleAuthOverlayClick(e) {
    if (e.target === document.getElementById('authOverlay')) closeAuth();
  }

  function switchAuthTab(tab) {
    const isSignin = tab === 'signin';

    document.getElementById('tab-signin').classList.toggle('active', isSignin);
    document.getElementById('tab-signup').classList.toggle('active', !isSignin);
    document.getElementById('tab-signin').setAttribute('aria-selected', isSignin);
    document.getElementById('tab-signup').setAttribute('aria-selected', !isSignin);

    document.getElementById('pane-signin').classList.toggle('active', isSignin);
    document.getElementById('pane-signup').classList.toggle('active', !isSignin);

    document.getElementById('auth-modal-title').textContent = isSignin ? 'Welcome Back' : 'Create Account';
    document.getElementById('auth-modal-sub').textContent  = isSignin
      ? 'Sign in to your CourtIQ account'
      : 'Start your free trial today — no card required';

    document.getElementById('auth-error').style.display = 'none';
    document.querySelectorAll('.auth-input').forEach(i => i.classList.remove('error'));
  }

  function showAuthError(msg) {
    const el = document.getElementById('auth-error');
    el.textContent = msg;
    el.style.display = 'block';
  }

  function submitSignIn() {
    const email = document.getElementById('si-email').value.trim();
    const pass  = document.getElementById('si-password').value;
    let valid = true;

    document.getElementById('auth-error').style.display = 'none';
    document.getElementById('si-email').classList.remove('error');
    document.getElementById('si-password').classList.remove('error');

    if (!email || !email.includes('@')) {
      document.getElementById('si-email').classList.add('error');
      valid = false;
    }
    if (!pass || pass.length < 6) {
      document.getElementById('si-password').classList.add('error');
      valid = false;
    }
    if (!valid) { showAuthError('Please check your email and password.'); return; }

    // Simulate sign in
    showAuthSuccess('signin', email);
  }

  function submitSignUp() {
    const first    = document.getElementById('su-first').value.trim();
    const email    = document.getElementById('su-email').value.trim();
    const pass     = document.getElementById('su-password').value;
    const position = document.getElementById('su-position').value;
    let valid = true;

    document.getElementById('auth-error').style.display = 'none';
    ['su-first','su-email','su-password'].forEach(id => document.getElementById(id).classList.remove('error'));

    if (!first) { document.getElementById('su-first').classList.add('error'); valid = false; }
    if (!email || !email.includes('@')) { document.getElementById('su-email').classList.add('error'); valid = false; }
    if (!pass || pass.length < 8) { document.getElementById('su-password').classList.add('error'); valid = false; }
    if (!valid) { showAuthError('Please fill in all required fields correctly.'); return; }

    showAuthSuccess('signup', first);
  }

  function showAuthSuccess(type, name) {
    // Hide form content
    document.getElementById('auth-tabs') && (document.querySelector('.auth-tabs').style.display = 'none');
    document.getElementById('auth-error').style.display = 'none';
    document.querySelectorAll('.auth-form-pane').forEach(p => p.style.display = 'none');

    const success = document.getElementById('auth-success');
    const text    = document.getElementById('auth-success-text');
    if (type === 'signin') {
      text.textContent = `Welcome back! Redirecting you to your dashboard…`;
    } else {
      text.textContent = `Welcome, ${name || 'Athlete'}! Your free trial is ready. Setting up your personalized program…`;
    }
    success.classList.add('show');

    // Auto-close after 3s
    setTimeout(() => closeAuth(), 3200);
  }

  function socialAuth(provider) {
    showAuthSuccess('signup', '');
    document.getElementById('auth-success-text').textContent =
      `Connecting with ${provider === 'google' ? 'Google' : 'Apple'}…`;
  }

  function showForgot() {
    showAuthError('Password reset link sent! Check your inbox.');
    document.getElementById('auth-error').style.color = '#a8e063';
    document.getElementById('auth-error').style.background = 'rgba(168,224,99,0.08)';
    document.getElementById('auth-error').style.borderColor = 'rgba(168,224,99,0.2)';
    document.getElementById('auth-error').style.display = 'block';
  }

  // Combined keydown already declared above

  /* ══════════════════════════════════════════════════════════════
