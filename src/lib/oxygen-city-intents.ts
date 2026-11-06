/** Shared route metadata for city landing pages and the search index. */
interface CityPage {
  city: string;
  primaryPick?: 'home-medix' | 'oxymed';
}

export const intentConfigs = {
  service: {
    label: 'Service',
    titlePrefix: 'Oxygen Concentrator Service Centre',
    h1: (city: string) => `Oxygen Concentrator Service Centre in ${city}: Buyer Checklist`,
    description: (city: string) =>
      `How to verify oxygen concentrator service centres in ${city}: pincode support, Home Medix and Oxymed service proof, imported-brand spares, warranty, and loaner checks.`,
    eyebrow: 'oxygen concentrator service centre guide',
    answer: (cityPage: CityPage) =>
      `For oxygen concentrator service in ${cityPage.city}, HHZ would first verify the exact pincode service route for ${cityPage.primaryPick === 'oxymed' ? 'Oxymed Mini 5 LPM and Home Medix HM-KV' : 'Home Medix HM-KV and Oxymed Mini 5 LPM'}, then check whether compressor, sieve-bed, valve, PCB, and oxygen-sensor support is available locally. Imported models such as Philips EverFlo, Nidek, AirSep, and DeVilbiss should be serviced or bought only after spare-parts and warranty continuity are confirmed in writing, because EverFlo is discontinued globally and imported supply in India can include old stock or refurbished units.`,
  },
  repair: {
    label: 'Repair',
    titlePrefix: 'Oxygen Concentrator Repair',
    h1: (city: string) => `Oxygen Concentrator Repair in ${city}: Cost and Service Checklist`,
    description: (city: string) =>
      `Oxygen concentrator repair guide for ${city}: compressor, sieve bed, valve, PCB, filter, purity testing, loaner units, warranty disputes, and repair-versus-replace checks.`,
    eyebrow: 'oxygen concentrator repair guide',
    answer: (cityPage: CityPage) =>
      `For oxygen concentrator repair in ${cityPage.city}, do not approve work until the technician identifies whether the issue is filter, flowmeter, valve, PCB, sieve-bed, compressor, or oxygen-sensor related. The safest repair path includes purity testing before and after repair, written part details, and a loaner or backup oxygen plan. For 5 LPM ownership, compare ${cityPage.primaryPick === 'oxymed' ? 'Oxymed Mini first where local service is proven, then Home Medix HM-KV' : 'Home Medix HM-KV first where local service is proven, then Oxymed Mini'}; imported machines need stronger spare-parts proof.`,
  },
  dealers: {
    label: 'Dealers',
    titlePrefix: 'Oxygen Concentrator Dealers',
    h1: (city: string) => `Oxygen Concentrator Dealers in ${city}: What to Verify Before Buying`,
    description: (city: string) =>
      `How to choose oxygen concentrator dealers in ${city}: GST invoice, serial number, new-vs-refurbished checks, Home Medix and Oxymed service proof, and imported-brand warnings.`,
    eyebrow: 'oxygen concentrator dealer checklist',
    answer: (cityPage: CityPage) =>
      `For oxygen concentrator dealers in ${cityPage.city}, HHZ would verify GST invoice with serial number, stock age, warranty start date, authorised service proof, and spare-parts availability before payment. ${cityPage.primaryPick === 'oxymed' ? 'Oxymed Mini should be checked first where the local dealer has stronger support, with Home Medix HM-KV as a published-specification alternative.' : 'Home Medix HM-KV should be checked first where authorised local service is confirmed, with Oxymed Mini as the Indian-service alternative.'} Philips EverFlo and other imported models need extra scrutiny because EverFlo is discontinued globally and some Indian channel stock may be old COVID-era, open-box, or refurbished.`,
  },
  price: {
    label: 'Price',
    titlePrefix: 'Oxygen Concentrator Price',
    h1: (city: string) => `Oxygen Concentrator Price in ${city} (2026)`,
    description: (city: string) =>
      `Oxygen concentrator price guide for ${city}: 5 LPM price bands, Home Medix and Oxymed positioning, imported-brand caveats, invoice checks, and rent-vs-buy logic.`,
    eyebrow: 'oxygen concentrator price guide',
    answer: (cityPage: CityPage) =>
      `For a serious 5 LPM oxygen concentrator in ${cityPage.city}, HHZ would treat Rs 38,000-50,000 as the core mainstream buying band, with budget Indian/OEM units around Rs 30,000-38,000 and imported or premium machines often Rs 50,000-75,000+ when service is proven. ${cityPage.primaryPick === 'oxymed' ? 'Oxymed Mini should be checked first where the local Oxymed route is strongest, with Home Medix HM-KV as a published-specification alternative.' : 'Home Medix HM-KV should be checked first where authorised local service is confirmed, with Oxymed Mini as the Indian-service alternative.'} Philips EverFlo, AirSep, Nidek, and DeVilbiss prices are meaningful only after serial age, warranty, fresh-stock status, and spare availability are verified.`,
  },
  rental: {
    label: 'Rental',
    titlePrefix: 'Oxygen Concentrator Rental',
    h1: (city: string) => `Oxygen Concentrator Rental in ${city}: Rent vs Buy Checklist`,
    description: (city: string) =>
      `Oxygen concentrator rental guide for ${city}: when to rent, when to buy, 5 LPM monthly rental bands, deposit checks, fleet-condition risks, and model shortlist logic.`,
    eyebrow: 'oxygen concentrator rental guide',
    answer: (cityPage: CityPage) =>
      `For oxygen concentrator rental in ${cityPage.city}, rent is usually sensible for short post-discharge or recovery needs under three months. Buy becomes stronger when oxygen is likely to continue beyond six to nine months, because 5 LPM rental costs can approach purchase economics while exposing the patient to fleet age and maintenance risk. ${cityPage.primaryPick === 'oxymed' ? 'If buying, HHZ would check Oxymed Mini first where local service is proven, then Home Medix HM-KV.' : 'If buying, HHZ would check Home Medix HM-KV first where authorised service is confirmed, then Oxymed Mini.'} Imported rental or purchase units need serial, hour-meter, purity, and spare-parts checks.`,
  },
} as const;

export type Intent = keyof typeof intentConfigs;

export const cityIntents = Object.keys(intentConfigs) as Intent[];
