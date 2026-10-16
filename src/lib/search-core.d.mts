export const MARKET_LABELS: Record<string, string>;
export const TYPE_LABELS: Record<string, string>;
export const TYPE_CODES: Record<string, string>;
export interface SearchItem {
  name: string;
  href: string;
  brand?: string;
  slug?: string;
  market?: string;
  type?: string;
  keywords?: string;
  image?: string | null;
  category?: string;
  price?: string | null;
  discontinued?: boolean;
}
export interface PreparedSearchItem extends SearchItem {
  _name: string; _brand: string; _keywords: string; _text: string; _compactName: string;
}
export function normalizeSearch(value?: unknown): string;
export function productSearchKeywords(data: {
  category?: string; device_type?: string; slug?: string;
  normalized_specs?: { flow_max_lpm?: number };
  key_features?: Record<string, string>;
  spec_tables?: Record<string, Record<string, string>>;
}): string;
export function prepareSearchItem(item: SearchItem): PreparedSearchItem;
export function fromIndexItem(item: {
  m: string; t: string; n: string; h: string; b?: string; k?: string; p?: string; s?: boolean;
}): PreparedSearchItem;
export function rankSearch(items: PreparedSearchItem[], query: string, options?: {
  market?: string; resultType?: string;
}): PreparedSearchItem[];
export function loadSearchIndex(src: string, fetcher?: typeof fetch): Promise<PreparedSearchItem[]>;
