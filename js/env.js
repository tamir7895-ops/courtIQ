/* ══════════════════════════════════════════════════════════════
   COURTIQ ENV — the ONLY place runtime configuration lives.

   The Supabase publishable/anon key is public by design (it ships
   in every client bundle); the security boundary is RLS on every
   table. Keeping it here — one file — means rotation is a one-line
   change, and no other file may hardcode it (enforced by review:
   grep for 'supabase.co' should hit this file only).

   Load order: this file must be the FIRST script in every HTML
   entry point, before supabase-client.js.
   ══════════════════════════════════════════════════════════════ */
window.COURTIQ_ENV = {
  SUPABASE_URL: 'https://txnsuzlgfafjdipfqkqe.supabase.co',
  // Modern publishable key (sb_publishable_*) — rotatable from the
  // Supabase dashboard at any time without invalidating user sessions.
  // The legacy JWT anon key that lived in git history should be
  // disabled in the dashboard once this deploy is verified.
  SUPABASE_KEY: 'sb_publishable_vooqplUC4PXdYSUnJ3xDHg_rVGBs-e4',
};
