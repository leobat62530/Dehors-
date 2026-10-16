import { PAYMENTS_URL } from '../config/links';
import type { StarsProductId } from '../game/premium';
import type { TelegramWebApp } from './webapp';

/**
 * Telegram Stars payments. The invoice comes from our server (it holds the bot token and verifies
 * `initData`); the client only opens it and reports the result. Without a server address the
 * shop shows the prices and says payment is coming.
 */
export type PurchaseResult = 'paid' | 'cancelled' | 'failed' | 'unavailable';

interface InvoiceApp extends TelegramWebApp {
  openInvoice?(url: string, callback: (status: string) => void): void;
}

export function paymentsAvailable(app: TelegramWebApp | null): boolean {
  return Boolean(PAYMENTS_URL && app && (app as InvoiceApp).openInvoice);
}

/** Ask the server for an invoice link for `product`, open it, resolve with Telegram's status. */
export async function requestPurchase(app: TelegramWebApp | null, product: StarsProductId): Promise<PurchaseResult> {
  if (!paymentsAvailable(app)) return 'unavailable';
  const a = app as InvoiceApp;
  let url: string;
  try {
    const res = await fetch(`${PAYMENTS_URL}/invoice`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ product, initData: a.initData }),
    });
    if (!res.ok) return 'failed';
    const body = (await res.json()) as { url?: string };
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
