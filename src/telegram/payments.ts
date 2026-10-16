import { PAYMENTS_URL } from '../config/links';
import type { AnalyticsEvent, AnalyticsSink } from '../core/analytics';
import type { StarsProductId } from '../game/premium';
import type { TelegramWebApp } from './webapp';

/**
 * Telegram Stars payments and the event sink. The invoice comes from our server (it holds the bot
 * token and verifies `initData`); the client only opens it and then asks the server what was paid.
 * Without a server address the shop shows the prices and says payment is coming.
 */
export type PurchaseResult = 'paid' | 'cancelled' | 'failed' | 'unavailable';

interface InvoiceApp extends TelegramWebApp {
  openInvoice?(url: string, callback: (status: string) => void): void;
}

export function paymentsAvailable(app: TelegramWebApp | null): boolean {
  return Boolean(PAYMENTS_URL && app && app.initData && (app as InvoiceApp).openInvoice);
}

async function post(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(`${PAYMENTS_URL}/${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} ${res.status}`);
  return res.json();
}

/** Ask the server for an invoice link for `product`, open it, resolve with Telegram's status. */
export async function requestPurchase(app: TelegramWebApp | null, product: StarsProductId): Promise<PurchaseResult> {
  if (!paymentsAvailable(app)) return 'unavailable';
  const a = app as InvoiceApp;
  let url: string;
  try {
    const body = (await post('invoice', { product, initData: a.initData })) as { url?: string };
    if (!body.url) return 'failed';
    url = body.url;
  } catch {
    return 'failed';
  }
  return new Promise((resolve) => {
    try {
      a.openInvoice!(url, (status) => resolve(status === 'paid' ? 'paid' : status === 'cancelled' ? 'cancelled' : 'failed'));
    } catch {
      resolve('failed');
    }
  });
}

/** Purchases Telegram confirmed that the game has not credited yet. The server marks them claimed. */
export async function claimPurchases(app: TelegramWebApp | null): Promise<StarsProductId[]> {
  if (!paymentsAvailable(app)) return [];
  try {
    const body = (await post('claim', { initData: app!.initData })) as { products?: string[] };
    return (body.products ?? []) as StarsProductId[];
  } catch {
    return [];
  }
}

/** Anonymous id for players outside Telegram, kept in local storage. */
function anonId(): string {
  try {
    const key = 'dehors.anon';
    let id = localStorage.getItem(key);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(key, id);
    }
    return id;
  } catch {
    return 'no-storage-0000';
  }
}

/** Event sink: batches go to the server with the Telegram identity or the anonymous id. Best effort. */
export function createEventSink(app: TelegramWebApp | null): AnalyticsSink | null {
  if (!PAYMENTS_URL) return null;
  const identity = app?.initData ? { initData: app.initData } : { anon: anonId() };
  return (events: AnalyticsEvent[]) => {
    const body = JSON.stringify({ ...identity, events });
    try {
      void fetch(`${PAYMENTS_URL}/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body, keepalive: true }).catch(() => undefined);
    } catch {
      // Offline: the batch is dropped, the game never waits on it.
    }
  };
}
