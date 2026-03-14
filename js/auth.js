/* ══════════════════════════════════════════════════════════════
     AUTH MODAL — Real Supabase Auth
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
    el.style.color = '';
    el.style.background = '';
    el.style.borderColor = '';
  }

  function showAuthSuccess(type, name) {
    // Hide form content
    document.getElementById('auth-tabs') && (document.querySelector('.auth-tabs').style.display = 'none');
    document.getElementById('auth-error').style.display = 'none';
    document.querySelectorAll('.auth-form-pane').forEach(p => p.style.display = 'none');

    const success = document.getElementById('auth-success');
    const text    = document.getElementById('auth-success-text');
    if (type === 'signin') {
      text.textContent = 'Welcome back! Redirecting you to your dashboard\u2026';
    } else {
      text.textContent = `Welcome, ${name || 'Athlete'}! Your free trial is ready. Setting up your personalized program\u2026`;
    }
    success.classList.add('show');
  }

  async function submitSignIn() {
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

    const btn = document.querySelector('#pane-signin .auth-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Signing in\u2026'; }

    if (typeof sb === 'undefined') {
      showAuthError('Connection error. Please refresh the page and try again.');
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In \u2192'; }
      return;
    }

    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Request timed out. Please try again.')), 10000));
    let result;
    try {
      result = await Promise.race([
        sb.auth.signInWithPassword({ email, password: pass }),
        timeout
      ]);
    } catch(e) {
      showAuthError(e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In \u2192'; }
      return;
    }

    const { data: signInData, error } = result;
    if (error) {
      showAuthError(error.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In \u2192'; }
      return;
    }

    if (!signInData || !signInData.session) {
      showAuthError('Sign in failed — no session created. Please try again.');
      if (btn) { btn.disabled = false; btn.textContent = 'Sign In \u2192'; }
      return;
    }

    showAuthSuccess('signin', email);
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
  }

  async function submitSignUp() {
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

    const btn = document.getElementById('su-submit');
    if (btn) { btn.disabled = true; btn.textContent = 'Creating account\u2026'; }

    if (typeof sb === 'undefined') {
      showAuthError('Connection error. Please refresh the page and try again.');
      if (btn) { btn.disabled = false; btn.textContent = 'Create Account \u2192'; }
      return;
    }

    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('Request timed out. Please try again.')), 10000));
    let result;
    try {
      result = await Promise.race([
        sb.auth.signUp({ email, password: pass, options: { data: { first_name: first, position: position } } }),
        timeout
      ]);
    } catch (e) {
      showAuthError(e.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Create Account \u2192'; }
      return;
    }

    const { data: signUpData, error } = result;
    if (error) {
      showAuthError(error.message);
      if (btn) { btn.disabled = false; btn.textContent = 'Create Account \u2192'; }
      return;
    }

    // If session is null, Supabase requires email confirmation before sign-in
    if (!signUpData || !signUpData.session) {
      if (btn) { btn.disabled = false; btn.textContent = 'Create Account \u2192'; }
      const el = document.getElementById('auth-error');
      el.textContent = '\u2709 Check your email to confirm your account, then sign in.';
      el.style.color = '#a8e063';
      el.style.background = 'rgba(168,224,99,0.08)';
      el.style.borderColor = 'rgba(168,224,99,0.2)';
      el.style.display = 'block';
      return;
    }

    showAuthSuccess('signup', first);
    setTimeout(() => { window.location.href = 'dashboard.html'; }, 1500);
  }

  async function signOut() {
    await sb.auth.signOut();
    window.location.href = 'index.html';
  }

  function socialAuth(provider) {
    showAuthError('Social login coming soon. Please use email and password.');
  }

  async function showForgot() {
    const email = document.getElementById('si-email').value.trim();
    if (!email || !email.includes('@')) {
      showAuthError('Enter your email address first.');
      return;
    }
    const { error } = await sb.auth.resetPasswordForEmail(email);
    if (error) { showAuthError(error.message); return; }
    const el = document.getElementById('auth-error');
    el.textContent = 'Password reset link sent! Check your inbox.';
    el.style.color = '#a8e063';
    el.style.background = 'rgba(168,224,99,0.08)';
    el.style.borderColor = 'rgba(168,224,99,0.2)';
    el.style.display = 'block';
  }

  // On landing page: check if already logged in, update nav
  (async function checkExistingSession() {
    let session;
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      session = data.session;
    } catch (e) {
      // Network errors (Failed to fetch) are not auth failures.
      // Only sign out on genuine auth errors.
      const isNetworkError = e instanceof TypeError ||
        (e && typeof e.message === 'string' && /fetch|network|load/i.test(e.message));
      if (!isNetworkError) {
        console.warn('Stale session cleared:', e);
        await sb.auth.signOut();
      } else {
        console.warn('Session check skipped (network error):', e);
      }
      return;
    }
    if (session) {
      // Update nav buttons if on landing page
      const navBtns = document.querySelector('.nav-buttons');
      if (navBtns && !document.getElementById('db-panel-log')) {
        navBtns.innerHTML = `
          <a href="dashboard.html" class="btn-cta" style="font-size:12px;padding:10px 22px;">DASHBOARD</a>
          <button onclick="signOut()" class="btn-hamburger" style="font-size:11px;color:var(--c-muted);background:none;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:8px 14px;cursor:pointer;">Sign Out</button>
        `;
      }
    }
  })();

/* ══════════════════════════════════════════════════════════════ */
