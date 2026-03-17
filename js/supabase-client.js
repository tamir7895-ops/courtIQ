/* ══════════════════════════════════════════════════════════════
   SUPABASE CLIENT
   ══════════════════════════════════════════════════════════════ */
const SUPABASE_URL = 'https://txnsuzlgfafjdipfqkqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bnN1emxnZmFmamRpcGZxa3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc1ODEsImV4cCI6MjA4ODEwMzU4MX0.e0FeyvvMuodRDMlvx7gHWxtwhDiYLA_gx36OqZRBcX4';

function _initSupabase() {
  if (window.supabase && window.supabase.createClient) {
    return window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return null;
}

let sb = _initSupabase();

if (!sb) {
  console.warn('Supabase SDK not ready — will retry on DOMContentLoaded');
  // Temporary fallback
  sb = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ error: { message: 'Supabase SDK failed to load. Please refresh the page.' } }),
      signUp: () => Promise.resolve({ error: { message: 'Supabase SDK failed to load. Please refresh the page.' } }),
      signOut: () => Promise.resolve({}),
      resetPasswordForEmail: () => Promise.resolve({ error: { message: 'Supabase SDK failed to load. Please refresh the page.' } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
    },
    from: () => ({ select: () => Promise.resolve({ data: null, error: { message: 'SDK not loaded' } }) })
  };

  // Retry when DOM is ready (CDN script may have loaded by then)
  document.addEventListener('DOMContentLoaded', function () {
    var real = _initSupabase();
    if (real) {
      sb = real;
      console.log('Supabase SDK loaded on retry');
    } else {
      console.error('Supabase SDK failed to load after retry');
    }
  });
}
