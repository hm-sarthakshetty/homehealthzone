import partnerData from '../data/respiratory-partners.json' with { type: 'json' };

export interface RespiratoryPartner {
  slug: string;
  name: string;
  aliases?: string[];
  region: string;
  city: string | null;
  state: string;
  address: string | null;
  website: string | null;
  telephone: string | null;
  whatsapp: string | null;
  mapsUrl: string | null;
  businessLinks: { label: string; url: string }[];
  sources: { label: string; url: string; checkedAt: string }[];
  description: string;
  services: string[];
  identityConfidence: 'high' | 'medium' | 'unresolved';
}

export const regions = [
  { slug: 'tamil-nadu', name: 'Tamil Nadu' },
  { slug: 'andhra-pradesh-telangana', name: 'Andhra Pradesh & Telangana' },
  { slug: 'pune', name: 'Pune, Maharashtra' },
  { slug: 'kerala', name: 'Kerala' },
] as const;

export const serviceNames: Record<string, string> = {
  'home-setup': 'Home setup',
  'mask-fitting': 'Mask fitting',
  rentals: 'Rentals',
  repairs: 'Repairs',
  'staff-training': 'Staff training',
};

export const partners = partnerData as RespiratoryPartner[];
export const regionFor = (value: string) => regions.find((region) => region.slug === value || region.name === value);
export const partnersIn = (slug: string) => partners.filter((partner) => regionFor(partner.region)?.slug === slug);
export const partnerLocation = (partner: RespiratoryPartner) => [partner.city, partner.state].filter(Boolean).join(', ');
export const partnerPath = (partner: RespiratoryPartner) => `/in/respiratory-care-experts/${regionFor(partner.region)?.slug ?? partner.region}/${partner.slug}/`;
export const safeJson = (value: unknown) => JSON.stringify(value).replace(/</g, '\\u003c');
export const phoneHref = (value: string) => `tel:${value.replace(/[^+\d]/g, '')}`;
export const whatsappHref = (value: string) => /^https?:\/\//i.test(value) ? value : `https://wa.me/${value.replace(/\D/g, '')}`;

