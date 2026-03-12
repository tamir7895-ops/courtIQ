/* ══════════════════════════════════════════════════════════════
   SUPABASE CLIENT
   ══════════════════════════════════════════════════════════════ */
const SUPABASE_URL = 'https://txnsuzlgfafjdipfqkqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bnN1emxnZmFmamRpcGZxa3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc1ODEsImV4cCI6MjA4ODEwMzU4MX0.e0FeyvvMuodRDMlvx7gHWxtwhDiYLA_gx36OqZRBcX4';

let sb;
try {
  if (window.supabase && window.supabase.createClient) {
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } else {
    console.error('Supabase SDK not loaded — auth features unavailable');
    sb = {
      auth: {
        getSession: () => Promise.resolve({ data: { session: null }, error: null }),
        signInWithPassword: () => Promise.resolve({ error: { message: 'Supabase SDK failed to load. Please refresh the page.' } }),
        signUp: () => Promise.resolve({ error: { message: 'Supabase SDK failed to load. Please refresh the page.' } }),
        signOut: () => Promise.resolve({}),
        resetPasswordForEmail: () => Promise.resolve({ error: { message: 'Supabase SDK failed to load. Please refresh the page.' } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
      }
    };
  }
} catch (e) {
  console.error('Supabase init failed:', e);
}
