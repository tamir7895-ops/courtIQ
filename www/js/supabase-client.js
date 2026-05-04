/* ══════════════════════════════════════════════════════════════
   SUPABASE CLIENT
   ══════════════════════════════════════════════════════════════ */
const SUPABASE_URL = 'https://txnsuzlgfafjdipfqkqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bnN1emxnZmFmamRpcGZxa3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc1ODEsImV4cCI6MjA4ODEwMzU4MX0.e0FeyvvMuodRDMlvx7gHWxtwhDiYLA_gx36OqZRBcX4';

/* The Supabase CDN script is loaded synchronously in <head>,
   so window.supabase SHOULD be available by the time this runs.
   If it isn't, the CDN failed — log the error clearly. */
var sb;
if (window.supabase && window.supabase.createClient) {
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
