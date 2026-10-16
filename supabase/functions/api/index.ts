/**
 * « Dehors ! » server: one Supabase Edge Function, routed by path.
 *
 *   POST /api/invoice  { product, initData }            → { url }  Stars invoice link
 *   POST /api/claim    { initData }                     → { products: [...] } purchases paid, not yet credited
 *   POST /api/events   { initData | anon, events: [] }  → { ok }   anonymous events
 *   POST /api/webhook  Telegram update (secret header)  → pre-checkout answer, payment record
 *   GET  /api/stats    header x-dashboard-token         → aggregates for the dashboard
 *   POST /api/setup    header x-dashboard-token         → registers the Telegram webhook
 *
 * Secrets: BOT_TOKEN (BotFather), WEBHOOK_SECRET, DASHBOARD_TOKEN, EVENT_SALT.
 * The bot token never leaves this file; the client only ever sees invoice links.
 * Prices below are the authoritative ones and must match `premium` in src/config/balance.ts
 * (tests/server.test.ts checks it).
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const BOT_TOKEN = Deno.env.get('BOT_TOKEN') ?? '';
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? '';
const DASHBOARD_TOKEN = Deno.env.get('DASHBOARD_TOKEN') ?? '';
const EVENT_SALT = Deno.env.get('EVENT_SALT') ?? 'dehors';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';

const db = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });

// PRODUCTS_BEGIN
const PRODUCTS: Record<string, { stars: number; title: string }> = {
  billets_s: { stars: 50, title: '50 billets' },
  billets_m: { stars: 200, title: '200 billets (+40)' },
  billets_l: { stars: 500, title: '500 billets (+175)' },
  pass: { stars: 250, title: 'Pass Racaille, 30 jours' },
  starter: { stars: 100, title: 'Pack de départ' },
};
// PRODUCTS_END

/** Stars a player may spend per day, mirrored from balance.ts: the client refuses first, the server last. */
const DAILY_STARS_CAP = 1000;
/** initData older than this is refused (seconds). */
const INIT_DATA_MAX_AGE = 24 * 3600;
const MAX_EVENTS_PER_CALL = 64;

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-dashboard-token',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...CORS } });
}

const enc = new TextEncoder();

async function hmac(key: ArrayBuffer | Uint8Array, message: string): Promise<ArrayBuffer> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return crypto.subtle.sign('HMAC', k, enc.encode(message));
}

function hex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text: string): Promise<string> {
  return hex(await crypto.subtle.digest('SHA-256', enc.encode(text)));
}

interface TgUser {
  id: number;
  language_code?: string;
}

/** Telegram Mini App initData check: HMAC-SHA256 chain keyed on "WebAppData" and the bot token. */
export async function verifyInitData(initData: string, botToken: string, now = Date.now()): Promise<TgUser | null> {
  if (!initData || !botToken) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const pairs = [...params.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)).map(([k, v]) => `${k}=${v}`);
  const secret = await hmac(enc.encode('WebAppData'), botToken);
  const expected = hex(await hmac(secret, pairs.join('\n')));
  if (expected.length !== hash.length) return null;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ hash.charCodeAt(i);
  if (diff !== 0) return null;
  const authDate = Number(params.get('auth_date') ?? 0);
  if (!authDate || now / 1000 - authDate > INIT_DATA_MAX_AGE) return null;
  try {
    const user = JSON.parse(params.get('user') ?? '') as TgUser;
    return typeof user.id === 'number' ? user : null;
  } catch {
    return null;
  }
}

async function telegram(method: string, body: unknown): Promise<{ ok: boolean; result?: unknown; description?: string }> {
  const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; result?: unknown; description?: string };
}

async function touchPlayer(user: TgUser, extra: Record<string, unknown> = {}): Promise<void> {
  await db.from('players').upsert({ tg_id: user.id, last_seen: new Date().toISOString(), lang: user.language_code?.slice(0, 2) ?? 'fr', ...extra }, { onConflict: 'tg_id' });
}

async function starsToday(tgId: number): Promise<number> {
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const { data } = await db.from('purchases').select('stars').eq('tg_id', tgId).gte('created_at', since.toISOString());
  return (data ?? []).reduce((a, r) => a + (r.stars as number), 0);
}

// ---- routes ---------------------------------------------------------------------

async function invoice(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { product?: string; initData?: string };
  const product = PRODUCTS[body.product ?? ''];
  if (!product || !body.product) return json({ error: 'unknown_product' }, 400);
  const user = await verifyInitData(body.initData ?? '', BOT_TOKEN);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  if ((await starsToday(user.id)) + product.stars > DAILY_STARS_CAP) return json({ error: 'daily_cap' }, 429);
  await touchPlayer(user);
  const payload = `${body.product}:${user.id}:${crypto.randomUUID()}`;
  const { error } = await db.from('invoices').insert({ payload, tg_id: user.id, product: body.product, stars: product.stars });
  if (error) return json({ error: 'db' }, 500);
  const r = await telegram('createInvoiceLink', {
    title: product.title,
    description: 'Dehors ! — achat dans le jeu',
    payload,
    provider_token: '',
    currency: 'XTR',
    prices: [{ label: product.title, amount: product.stars }],
  });
  if (!r.ok || typeof r.result !== 'string') return json({ error: 'telegram', detail: r.description ?? '' }, 502);
  return json({ url: r.result });
}

async function claim(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as { initData?: string };
  const user = await verifyInitData(body.initData ?? '', BOT_TOKEN);
  if (!user) return json({ error: 'bad_init_data' }, 401);
  const { data } = await db.from('purchases').select('id, product').eq('tg_id', user.id).is('claimed_at', null);
  const rows = data ?? [];
  if (rows.length > 0) {
    await db
      .from('purchases')
      .update({ claimed_at: new Date().toISOString() })
      .in(
        'id',
        rows.map((r) => r.id),
      );
  }
  return json({ products: rows.map((r) => r.product as string) });
}

async function events(req: Request): Promise<Response> {
  const body = (await req.json().catch(() => ({}))) as {
    initData?: string;
    anon?: string;
    events?: { name?: string; at?: number; props?: Record<string, unknown> }[];
  };
  const list = Array.isArray(body.events) ? body.events.slice(0, MAX_EVENTS_PER_CALL) : [];
  if (list.length === 0) return json({ ok: true });
  let key: string;
  const user = body.initData ? await verifyInitData(body.initData, BOT_TOKEN) : null;
  if (user) {
    key = `tg:${user.id}`;
    const start = list.find((e) => e.name === 'session_start');
    const p = (start?.props ?? {}) as Record<string, unknown>;
    await touchPlayer(user, {
      ...(typeof p.level === 'number' ? { level: p.level } : {}),
      ...(typeof p.runs === 'number' ? { runs: p.runs } : {}),
    });
  } else if (typeof body.anon === 'string' && /^[a-z0-9-]{8,64}$/.test(body.anon)) {
    key = `anon:${body.anon}`;
  } else {
    return json({ error: 'no_identity' }, 400);
  }
  const playerHash = await sha256(`${EVENT_SALT}:${key}`);
  const rows = list
    .filter((e) => typeof e.name === 'string' && /^[a-z_]{1,40}$/.test(e.name))
    .map((e) => ({
      player_hash: playerHash,
      name: e.name,
      at: new Date(typeof e.at === 'number' && Number.isFinite(e.at) ? e.at : Date.now()).toISOString(),
      props: e.props && typeof e.props === 'object' ? e.props : {},
    }));
  if (rows.length > 0) await db.from('events').insert(rows);
  return json({ ok: true });
}

interface Update {
  pre_checkout_query?: { id: string; from: TgUser; invoice_payload: string; total_amount: number; currency: string };
  message?: {
    from?: TgUser;
    successful_payment?: { currency: string; total_amount: number; invoice_payload: string; telegram_payment_charge_id: string };
  };
}

async function webhook(req: Request): Promise<Response> {
  if (!WEBHOOK_SECRET || req.headers.get('x-telegram-bot-api-secret-token') !== WEBHOOK_SECRET) return json({ error: 'forbidden' }, 403);
  const update = (await req.json().catch(() => ({}))) as Update;
  if (update.pre_checkout_query) {
    const q = update.pre_checkout_query;
    const { data } = await db.from('invoices').select('stars, tg_id').eq('payload', q.invoice_payload).maybeSingle();
    const ok = Boolean(data) && data!.stars === q.total_amount && q.currency === 'XTR' && data!.tg_id === q.from.id;
    await telegram('answerPreCheckoutQuery', { pre_checkout_query_id: q.id, ok, error_message: ok ? undefined : 'Facture inconnue, réessaie depuis le jeu.' });
    return json({ ok: true });
  }
  const paid = update.message?.successful_payment;
  const from = update.message?.from;
  if (paid && from) {
    const { data } = await db.from('invoices').select('product, stars').eq('payload', paid.invoice_payload).maybeSingle();
    if (data) {
      await db.from('players').upsert({ tg_id: from.id, last_seen: new Date().toISOString() }, { onConflict: 'tg_id' });
      await db.from('purchases').upsert(
        { tg_id: from.id, product: data.product, stars: data.stars, telegram_charge_id: paid.telegram_payment_charge_id, invoice_payload: paid.invoice_payload },
        { onConflict: 'telegram_charge_id', ignoreDuplicates: true },
      );
    }
  }
  return json({ ok: true });
}

function dashboardAllowed(req: Request): boolean {
  return Boolean(DASHBOARD_TOKEN) && req.headers.get('x-dashboard-token') === DASHBOARD_TOKEN;
}

async function stats(req: Request): Promise<Response> {
  if (!dashboardAllowed(req)) return json({ error: 'forbidden' }, 403);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [daily, stages, purchases, players] = await Promise.all([
    db.from('daily_stats').select('*').limit(30),
    db.from('events').select('props').eq('name', 'run_end').gte('at', weekAgo).limit(5000),
    db.from('purchases').select('product, stars, created_at').order('created_at', { ascending: false }).limit(200),
    db.from('players').select('tg_id', { count: 'exact', head: true }),
  ]);
  const byStage: Record<string, number> = {};
  for (const row of stages.data ?? []) {
    const stage = String((row.props as Record<string, unknown>).stage ?? '?');
    byStage[stage] = (byStage[stage] ?? 0) + 1;
  }
  const starsByDay: Record<string, number> = {};
  for (const p of purchases.data ?? []) {
    const day = String(p.created_at).slice(0, 10);
    starsByDay[day] = (starsByDay[day] ?? 0) + (p.stars as number);
  }
  return json({ players: players.count ?? 0, daily: daily.data ?? [], runsByStage: byStage, starsByDay, purchases: (purchases.data ?? []).slice(0, 50) });
}

async function setup(req: Request): Promise<Response> {
  if (!dashboardAllowed(req)) return json({ error: 'forbidden' }, 403);
  if (!BOT_TOKEN || !WEBHOOK_SECRET) return json({ error: 'missing_secrets' }, 500);
  const url = `${SUPABASE_URL}/functions/v1/api/webhook`;
  const r = await telegram('setWebhook', { url, secret_token: WEBHOOK_SECRET, allowed_updates: ['message', 'pre_checkout_query'] });
  return json({ ok: r.ok, url, description: r.description ?? '' });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const path = new URL(req.url).pathname.replace(/\/+$/, '');
  const route = path.slice(path.lastIndexOf('/') + 1);
  try {
    if (req.method === 'POST' && route === 'invoice') return await invoice(req);
    if (req.method === 'POST' && route === 'claim') return await claim(req);
    if (req.method === 'POST' && route === 'events') return await events(req);
    if (req.method === 'POST' && route === 'webhook') return await webhook(req);
    if (req.method === 'GET' && route === 'stats') return await stats(req);
    if (req.method === 'POST' && route === 'setup') return await setup(req);
    if (req.method === 'GET' && route === 'health') return json({ ok: true, bot: Boolean(BOT_TOKEN), webhook: Boolean(WEBHOOK_SECRET) });
  } catch (e) {
    return json({ error: 'internal', detail: String(e) }, 500);
  }
  return json({ error: 'not_found' }, 404);
});
