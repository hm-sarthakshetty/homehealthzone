import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const normalizedSpecsSchema = z
  .object({
    weight_kg: z.number().optional(),
    flow_min_lpm: z.number().optional(),
    flow_max_lpm: z.number().optional(),
    purity_min: z.number().optional(),
    purity_max: z.number().optional(),
    noise_db: z.number().optional(),
    power_w: z.number().optional(),
    pressure_min_cmh2o: z.number().optional(),
    pressure_max_cmh2o: z.number().optional(),
    has_humidifier: z.boolean().optional(),
    has_pulse_flow: z.boolean().optional(),
    has_opi: z.boolean().optional(),
    faa_approved: z.boolean().optional(),
    ce_certified: z.boolean().optional(),
    indian_voltage: z.boolean().optional(),
    warranty_years: z.number().optional(),
    altitude_ft: z.number().optional(),
  })
  .default({});

const productSchema = z.object({
  slug: z.string(),
  source_url: z.string(),
  product_name: z.string(),
  brand: z.string().default(''),
  brand_href: z.string().nullable().optional(),
  category: z.string().default(''),
  price_current: z.string().nullable().optional(),
  price_mrp: z.string().nullable().optional(),
  price_symbol: z.string().default('₹'),
  rating_value: z.string().nullable().optional(),
  rating_count: z.string().nullable().optional(),
  stock: z.string().default(''),
  images: z
    .array(
      z.object({
        src: z.string(),
        alt: z.string(),
        original: z.string().optional(),
      })
    )
    .default([]),
  key_features: z.record(z.string(), z.string()).default({}),
  spec_tables: z.record(z.string(), z.record(z.string(), z.string())).default({}),
  faqs: z
    .array(
      z.object({
        q: z.string(),
        a: z.string(),
      })
    )
    .default([]),
  description_text: z.string().default(''),
  related_links: z.array(z.string()).default([]),
  normalized_specs: normalizedSpecsSchema,
});

const cpapBipapSchema = productSchema.extend({
  device_type: z.enum(['cpap', 'bipap']).default('cpap'),
});

const comparisonSchema = z.object({
  slug: z.string(),
  source_url: z.string(),
  productA_slug: z.string(),
  productA_name: z.string(),
  productB_slug: z.string(),
  productB_name: z.string(),
  comparison_score: z.number().default(0),
  title: z.string(),
});

const editorialSchema = z.object({
  title: z.string(),
  description: z.string(),
  lastReviewed: z.string().optional(),
  nextReview: z.string().optional(),
  author: z.string().optional(),
  reviewedBy: z.string().optional(),
  credentials: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const productReviewSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  lastReviewed: z.string(),
  nextReview: z.string().optional(),
  author: z.string().default('HHZ Editorial'),
  reviewedBy: z.string().optional(),
  credentials: z.string().optional(),
  verdict: z.string().optional(),
  pros: z.array(z.string()).default([]),
  cons: z.array(z.string()).default([]),
  score: z.number().optional(),
  tags: z.array(z.string()).default([]),
});

const comparisonWriteupSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  lastReviewed: z.string(),
  nextReview: z.string().optional(),
  author: z.string().default('HHZ Editorial'),
  reviewedBy: z.string().optional(),
  verdict: z.string().optional(),
  winner: z.enum(['A', 'B', 'tie']).optional(),
  tags: z.array(z.string()).default([]),
});

const products = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/products' }),
  schema: productSchema,
});

const cpapBipap = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/cpap-bipap' }),
  schema: cpapBipapSchema,
});

const comparisons = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/comparisons' }),
  schema: comparisonSchema,
});

const guides = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/guides' }),
  schema: editorialSchema,
});

const clinical = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/clinical' }),
  schema: editorialSchema,
});

const productReviews = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/product-reviews' }),
  schema: productReviewSchema,
});

const cpapBipapReviews = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/cpap-bipap-reviews' }),
  schema: productReviewSchema,
});

const comparisonWriteups = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/comparison-writeups' }),
  schema: comparisonWriteupSchema,
});

export const collections = {
  products,
  'cpap-bipap': cpapBipap,
  comparisons,
  guides,
  clinical,
  'product-reviews': productReviews,
  'cpap-bipap-reviews': cpapBipapReviews,
  'comparison-writeups': comparisonWriteups,
};
