/**
 * Market registry for the regional sections. India is the unprefixed default
 * and the US has its own hand-built section under /us/. The markets below share
 * one generic hub, guides index and guide route under /{code}/.
 *
 * `live` controls whether a market is built and shown in the switcher. Flip it
 * only when the market has published guides.
 */
import type { Country, Currency } from '../lib/price';

export interface Market {
  /** URL prefix, e.g. 'uk' -> /uk/ */
  code: string;
  country: Country;
  currency: Currency;
  lang: string;
  label: string;
  /** Short label for the switcher. */
  short: string;
  live: boolean;
  hubTitle: string;
  hubDescription: string;
  hubLead: string;
  guidesTitle: string;
  guidesDescription: string;
  guidesLead: string;
  /** Guide cluster order on the guides index (frontmatter `cluster`). */
  clusters: string[];
}

export const INTL_MARKETS: Market[] = [
  {
    code: 'uk', country: 'GB', currency: 'GBP', lang: 'en-GB', label: 'United Kingdom', short: 'UK', live: true,
    hubTitle: 'Respiratory equipment guides for the UK',
    hubDescription: 'HHZ for UK buyers: NHS home oxygen and CPAP routes, VAT relief, DVLA rules, and equipment buying guides with GBP price examples.',
    hubLead: 'How home oxygen and CPAP work in the UK, through the NHS and privately. Prices are in pounds sterling, taken from the named retailer listing on the date shown in each guide.',
    guidesTitle: 'UK buyer’s guides',
    guidesDescription: 'UK guides to home oxygen and CPAP: NHS routes, VAT relief, MHRA rules, travel, masks, machines and troubleshooting, with GBP prices from named retailers.',
    guidesLead: 'Plain-English guides to getting, buying and using respiratory equipment in the UK. Every guide is reviewed and timestamped.',
    clusters: ['NHS and funding', 'Home oxygen', 'CPAP', 'Travel and power'],
  },
  {
    code: 'sg', country: 'SG', currency: 'SGD', lang: 'en-SG', label: 'Singapore', short: 'Singapore', live: true,
    hubTitle: 'Respiratory equipment guides for Singapore',
    hubDescription: 'HHZ for Singapore: MOH subsidies, MediSave and MediFund, HSA device rules, and equipment buying guides with SGD price examples.',
    hubLead: 'How home oxygen and CPAP are funded and regulated in Singapore. Prices are in Singapore dollars, taken from the named retailer listing on the date shown in each guide.',
    guidesTitle: 'Singapore buyer’s guides',
    guidesDescription: 'Singapore guides to home oxygen and CPAP: subsidies, MediSave, HSA rules, travel, masks, machines and troubleshooting, with SGD prices.',
    guidesLead: 'Plain-English guides to getting, paying for and using respiratory equipment in Singapore. Every guide is reviewed and timestamped.',
    clusters: ['Subsidies and schemes', 'CPAP', 'Oxygen', 'Regulation', 'Travel and power'],
  },
  {
    code: 'au', country: 'AU', currency: 'AUD', lang: 'en-AU', label: 'Australia', short: 'Australia', live: true,
    hubTitle: 'Respiratory equipment guides for Australia',
    hubDescription: 'HHZ for Australia: state equipment schemes, Medicare, TGA rules, and equipment buying guides with AUD price examples.',
    hubLead: 'How home oxygen and CPAP are funded and regulated in Australia. Prices are in Australian dollars, taken from the named retailer listing on the date shown in each guide.',
    guidesTitle: 'Australia buyer’s guides',
    guidesDescription: 'Australian guides to home oxygen and CPAP: state schemes, Medicare, TGA rules, travel, masks, machines and troubleshooting, with AUD prices.',
    guidesLead: 'Plain-English guides to getting, paying for and using respiratory equipment in Australia. Every guide is reviewed and timestamped.',
    clusters: ['Funding and tax', 'CPAP', 'Oxygen', 'Regulation', 'Travel and power'],
  },
  {
    code: 'ca', country: 'CA', currency: 'CAD', lang: 'en-CA', label: 'Canada', short: 'Canada', live: true,
    hubTitle: 'Respiratory equipment guides for Canada',
    hubDescription: 'HHZ for Canada: provincial programmes such as Ontario ADP, Health Canada rules, and equipment buying guides with CAD price examples.',
    hubLead: 'How home oxygen and CPAP are funded and regulated in Canada, province by province. Prices are in Canadian dollars, taken from the named retailer listing on the date shown in each guide.',
    guidesTitle: 'Canada buyer’s guides',
    guidesDescription: 'Canadian guides to home oxygen and CPAP: Ontario, BC and Alberta funding, Health Canada licences, flying, masks and machines, with CAD prices.',
    guidesLead: 'Plain-English guides to getting, paying for and using respiratory equipment in Canada. Every guide is reviewed and timestamped.',
    clusters: ['Provincial funding', 'CPAP', 'Oxygen', 'Regulation', 'Travel and power'],
  },
  {
    code: 'nz', country: 'NZ', currency: 'NZD', lang: 'en-NZ', label: 'New Zealand', short: 'New Zealand', live: true,
    hubTitle: 'Respiratory equipment guides for New Zealand',
    hubDescription: 'HHZ for New Zealand: Health NZ home oxygen and CPAP routes, ACC, Medsafe rules, and equipment buying guides with NZD price examples.',
    hubLead: 'How home oxygen and CPAP are funded and regulated in New Zealand. Prices are in New Zealand dollars, taken from the named retailer listing on the date shown in each guide.',
    guidesTitle: 'New Zealand buyer’s guides',
    guidesDescription: 'New Zealand guides to home oxygen and CPAP: Health NZ routes, ACC, Medsafe, travel, masks, machines and troubleshooting, with NZD prices.',
    guidesLead: 'Plain-English guides to getting, paying for and using respiratory equipment in New Zealand. Every guide is reviewed and timestamped.',
    clusters: ['Funding', 'CPAP', 'Oxygen', 'Regulation', 'Travel and power'],
  },
];

export const LIVE_MARKETS = INTL_MARKETS.filter((m) => m.live);

export function marketByCode(code: string): Market | undefined {
  return INTL_MARKETS.find((m) => m.code === code);
}

/** Market for a URL path, or undefined for India and the US. */
export function marketForPath(path: string): Market | undefined {
  const first = path.split('/')[1];
  return LIVE_MARKETS.find((m) => m.code === first);
}
