import { describe, expect, it } from 'vitest';
import { BALANCE } from '../src/config/balance';
import { PAYMENTS_URL } from '../src/config/links';
import admin from '../public/admin.html?raw';
import source from '../supabase/functions/api/index.ts?raw';

/** The Edge Function holds the authoritative prices: they must be the ones the shop shows. */
describe('server catalogue', () => {

  function serverProducts(): Record<string, number> {
    const block = source.slice(source.indexOf('// PRODUCTS_BEGIN'), source.indexOf('// PRODUCTS_END'));
    const out: Record<string, number> = {};
    for (const m of block.matchAll(/^\s*(\w+): \{ stars: (\d+)/gm)) out[m[1]!] = Number(m[2]);
    return out;
  }

  it('sells the same Stars products at the same prices as balance.ts', () => {
    const server = serverProducts();
    const client: Record<string, number> = {};
    for (const p of BALANCE.premium.billetPacks) client[p.id] = p.stars;
    client[BALANCE.premium.pass.id] = BALANCE.premium.pass.stars;
    client[BALANCE.premium.starter.id] = BALANCE.premium.starter.stars;
    expect(server).toEqual(client);
  });

  it('applies the same daily Stars cap', () => {
    const m = source.match(/const DAILY_STARS_CAP = (\d+)/);
    expect(Number(m?.[1])).toBe(BALANCE.premium.dailyStarsCap);
  });

  it('is the address the client talks to', () => {
    expect(PAYMENTS_URL.startsWith('https://')).toBe(true);
    expect(PAYMENTS_URL.endsWith('/functions/v1/api')).toBe(true);
    expect(admin).toContain(`const API = '${PAYMENTS_URL}'`);
  });
});
