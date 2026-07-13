// delete-account — App Store requirement: users who can create an account
// must be able to delete it from inside the app.
//
// Flow: verify the caller's JWT with the anon client, then use the service
// role to wipe every row they own (explicit deletes — some legacy FKs lack
// ON DELETE CASCADE) and finally remove the auth user itself.
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Missing authorization' }, 401);
  }

  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) {
    return json({ error: 'Unauthorized' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Children before parents; profiles last of the tables.
  const tables = [
    'ai_shots',
    'ai_shot_sessions',
    'training_sessions',
    'training_weeks',
    'shot_sessions',
    'profiles',
  ];
  for (const table of tables) {
    const col = table === 'profiles' ? 'id' : 'user_id';
    const { error } = await admin.from(table).delete().eq(col, user.id);
    if (error) {
      return json({ error: `Failed clearing ${table}` }, 500);
    }
  }

  const { error: delError } = await admin.auth.admin.deleteUser(user.id);
  if (delError) {
    return json({ error: 'Failed deleting auth user' }, 500);
  }

  return json({ ok: true });
});
