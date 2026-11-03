interface SpecProduct {
  key_features?: Record<string, string>;
  spec_tables?: Record<string, Record<string, string>>;
  manufacturer_name?: string;
  model?: string;
  country_of_origin?: string;
  prices?: { IN?: { configuration?: string } };
}
export interface ComparisonSpecRow { key: string; a: string; b: string; section: string; }
export function buildComparisonSpecRows(productA: SpecProduct, productB: SpecProduct): ComparisonSpecRow[];
