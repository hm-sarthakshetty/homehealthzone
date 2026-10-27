import type { APIRoute } from 'astro';
import { partners, partnerPath, regions, serviceNames } from '../../lib/respiratory-partners';

export const GET: APIRoute = () => {
  const site = new URL(import.meta.env.SITE);
  const absolute = (path: string) => new URL(path, site).toString();
  return new Response(JSON.stringify({
    schema_version: '1.0',
    name: 'Home Medix respiratory equipment dealer and service partners in India',
    updated_at: '2026-10-28',
    canonical_url: absolute('/in/respiratory-care-experts/'),
    manufacturer_profile_url: absolute('/manufacturers/home-medix/'),
    provenance: 'Partner identities, Home Medix dealer relationships and service categories supplied by Home Medix. Public business links are listed with their check dates. Local availability is by arrangement.',
    service_brand: { name: 'Home Medix', url: 'https://www.homemedix.in/' },
    record_count: partners.length,
    records: partners.map(({ identityConfidence: _internal, ...partner }) => ({
      ...partner,
      canonical_url: absolute(partnerPath(partner)),
      region_name: regions.find(region => region.slug === partner.region)?.name,
      country: 'IN',
      services: partner.services.map(key => ({ key, name: serviceNames[key], brand: 'Home Medix' })),
    })),
  }, null, 2), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
};
