/* ══════════════════════════════════════════════════════════════
   SUPABASE CLIENT
   Credentials come from js/env.js (window.COURTIQ_ENV) — the single
   source of truth. Never hardcode keys here or anywhere else.
   ══════════════════════════════════════════════════════════════ */
const SUPABASE_URL = (window.COURTIQ_ENV || {}).SUPABASE_URL;
const SUPABASE_ANON_KEY = (window.COURTIQ_ENV || {}).SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('[supabase-client] COURTIQ_ENV missing — load js/env.js before this script');
}

/* The Supabase CDN script is loaded synchronously in <head>,
   so window.supabase SHOULD be available by the time this runs.
   If it isn't, the CDN failed — log the error clearly. */
var sb;
if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase && window.supabase.createClient) {
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} else {
  console.error('[supabase-client] window.supabase is undefined — CDN script failed to load');
  /* Provide a stub that returns clear errors instead of crashing */
  sb = {
    auth: {
      getSession: function() { return Promise.resolve({ data: { session: null }, error: { message: 'Supabase SDK failed to load' } }); },
      signInWithPassword: function() { return Promise.resolve({ error: { message: 'Supabase SDK failed to load. Please refresh the page.' } }); },
      signUp: function() { return Promise.resolve({ error: { message: 'Supabase SDK failed to load. Please refresh the page.' } }); },
      signOut: function() { return Promise.resolve({}); },
      resetPasswordForEmail: function() { return Promise.resolve({ error: { message: 'Supabase SDK failed to load. Please refresh the page.' } }); },
      onAuthStateChange: function() { return { data: { subscription: { unsubscribe: function() {} } } }; }
    },
    from: function() { return { select: function() { return Promise.resolve({ data: null, error: { message: 'SDK not loaded' } }); } }; }
  };
}
