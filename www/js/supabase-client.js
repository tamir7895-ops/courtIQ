/* ══════════════════════════════════════════════════════════════
   SUPABASE CLIENT
   ══════════════════════════════════════════════════════════════ */
const SUPABASE_URL = 'https://txnsuzlgfafjdipfqkqe.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR4bnN1emxnZmFmamRpcGZxa3FlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI1Mjc1ODEsImV4cCI6MjA4ODEwMzU4MX0.e0FeyvvMuodRDMlvx7gHWxtwhDiYLA_gx36OqZRBcX4';

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
