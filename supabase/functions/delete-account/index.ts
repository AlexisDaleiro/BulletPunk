import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  try {
    const authorization = request.headers.get('Authorization') ?? '';
    if (!authorization.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401);
    const text = await request.text();
    if (text.length > 1024) return json({ error: 'Invalid request' }, 400);
    const body = JSON.parse(text);
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    // getUser verifies the token against Auth; never trust a decoded JWT or body owner alone.
    const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !user || body.owner !== user.id) return json({ error: 'Unauthorized' }, 401);
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return json({ error: 'Unable to delete account' }, 500);
    return json({ deleted: true });
  } catch { return json({ error: 'Invalid request' }, 400); }
});
