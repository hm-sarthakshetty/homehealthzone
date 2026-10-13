/**
 * Single source of truth for reading and formatting product prices.
 *
 * Transition model:
 *  - `prices.{IN,US,GB}` (numeric, per-country) is the new canonical store and
 *    the target for automated price updates.
 *  - Legacy `price_current` / `price_mrp` / `price_symbol` text fields are still
 *    read for India so existing pages render byte-identical output. When a
 *    legacy string exists for IN it is displayed verbatim (same as before);
 *    every other country is formatted with Intl.NumberFormat.
 */

export type Country = 'IN' | 'US' | 'GB' | 'SG' | 'AU' | 'CA' | 'NZ';
export type Currency = 'INR' | 'USD' | 'GBP' | 'SGD' | 'AUD' | 'CAD' | 'NZD';

export const COUNTRY_CURRENCY: Record<Country, Currency> = {
  IN: 'INR', US: 'USD', GB: 'GBP', SG: 'SGD', AU: 'AUD', CA: 'CAD', NZ: 'NZD',
};
export const COUNTRY_LOCALE: Record<Country, string> = {
  IN: 'en-IN', US: 'en-US', GB: 'en-GB', SG: 'en-SG', AU: 'en-AU', CA: 'en-CA', NZ: 'en-NZ',
};
/** Display symbols. Dollar markets carry a prefix so prices are unambiguous (S$, A$, C$, NZ$). */
export const CURRENCY_SYMBOL: Record<Currency, string> = {
  INR: '₹', USD: '$', GBP: '£', SGD: 'S$', AUD: 'A$', CAD: 'C$', NZD: 'NZ$',
};

const SYMBOL_CURRENCY: Record<string, Currency> = { '₹': 'INR', $: 'USD', '£': 'GBP' };

export interface PriceEntry {
  amount: number;
  currency: Currency;
  mrp?: number;
  source_url?: string;
  checked_at?: string;
}

/** Minimal shape shared by `products` and `cpap-bipap` entries. */
export interface PricedProduct {
  price_current?: string | null;
  price_mrp?: string | null;
  price_symbol?: string;
  prices?: Partial<Record<Country, PriceEntry>>;
}

export interface ResolvedPrice {
  country: Country;
  currency: Currency | undefined;
  symbol: string;
  amount: number | null;
  mrp: number | null;
  /** Legacy display text (IN only), kept so India output does not change. */
  rawCurrent: string | null;
  rawMrp: string | null;
  source_url?: string;
  checked_at?: string;
}

const clean = (v: string | null | undefined): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

/** Parse a legacy price string like "134,400.00" or "₹45,984" into a number. */
export function parsePriceText(v: string | null | undefined): number | null {
  const s = clean(v);
  if (!s) return null;
  const n = Number(s.replace(/[^\d.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function resolvePrice(data: PricedProduct, country: Country = 'IN'): ResolvedPrice {
  const entry = data.prices?.[country];
  if (country === 'IN') {
    const symbol = data.price_symbol || CURRENCY_SYMBOL.INR;
    const rawCurrent = clean(data.price_current);
    const rawMrp = clean(data.price_mrp);
    return {
      country,
      currency: entry?.currency ?? SYMBOL_CURRENCY[symbol],
      symbol,
      amount: entry?.amount ?? parsePriceText(rawCurrent),
      mrp: entry?.mrp ?? parsePriceText(rawMrp),
      rawCurrent,
      rawMrp,
      source_url: entry?.source_url,
      checked_at: entry?.checked_at,
    };
  }
  const currency = entry?.currency ?? COUNTRY_CURRENCY[country];
  return {
    country,
    currency,
    symbol: CURRENCY_SYMBOL[currency],
    amount: entry?.amount ?? null,
    mrp: entry?.mrp ?? null,
    rawCurrent: null,
    rawMrp: null,
    source_url: entry?.source_url,
    checked_at: entry?.checked_at,
  };
}

/** Plain number formatting in the country's locale (no currency symbol). */
export function formatAmount(n: number, country: Country = 'IN'): string {
  return n.toLocaleString(COUNTRY_LOCALE[country]);
}

export function formatMoney(amount: number, currency: Currency, country: Country): string {
  const fractional = Math.round(amount * 100) % 100 !== 0;
  const digits = { minimumFractionDigits: fractional ? 2 : 0, maximumFractionDigits: fractional ? 2 : 0 };
  if (currency === 'INR' || currency === 'USD' || currency === 'GBP') {
    return new Intl.NumberFormat(COUNTRY_LOCALE[country], { style: 'currency', currency, ...digits }).format(amount);
  }
  // Local Intl output for these is a bare "$"; prefix the explicit symbol instead.
  return `${CURRENCY_SYMBOL[currency]}${new Intl.NumberFormat(COUNTRY_LOCALE[country], digits).format(amount)}`;
}

/**
 * Display a price.
 *  - 'badge': legacy text with trailing ".00" stripped (PriceBadge behaviour).
 *  - 'raw':   legacy text verbatim, symbol-prefixed (comparison tables).
 *  - 'bare':  legacy text verbatim, no symbol (legacy MRP table cell).
 * Returns null when there is no price for that field.
 */
export function formatPrice(
  p: ResolvedPrice,
  field: 'current' | 'mrp' = 'current',
  style: 'badge' | 'raw' | 'bare' = 'badge'
): string | null {
  const raw = field === 'current' ? p.rawCurrent : p.rawMrp;
  if (raw) {
    if (style === 'bare') return raw;
    const text = style === 'badge' ? raw.replace(/\.0+$/, '') : raw;
    if (/[₹$€£]/.test(text)) return text;
    return `${p.symbol}${text}`;
  }
  const amount = field === 'current' ? p.amount : p.mrp;
  if (amount === null || !p.currency) return null;
  const money = formatMoney(amount, p.currency, p.country);
  if (style === 'bare') return money.replace(/[^\d.,]/g, '');
  return money;
}

/** schema.org Offer price + currency. Legacy IN strings keep their exact digits. */
export function schemaOfferPrice(p: ResolvedPrice): { price: string; priceCurrency: Currency | undefined } | null {
  const legacy = p.rawCurrent?.replace(/,/g, '').trim();
  if (legacy) {
    if (!/^\d+(?:\.\d+)?$/.test(legacy)) return null;
    return { price: legacy, priceCurrency: p.currency };
  }
  if (p.amount === null) return null;
  return { price: String(p.amount), priceCurrency: p.currency };
}

export function currencyForCountry(country: Country): Currency {
  return COUNTRY_CURRENCY[country];
}
