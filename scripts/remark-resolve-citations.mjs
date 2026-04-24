/**
 * Remark plugin: resolve `[CITATION: ...]` markers to real links where the
 * source is a named, canonical, stable URL. Strip everything else.
 *
 * Design principle (per site editorial stance): link only credible third-party
 * sources (international standards, published clinical guidelines, named
 * research papers with stable PubMed search URLs, Indian government /
 * institutional bodies). Everything else — manufacturer brochures, dealer
 * lists, e-commerce listings, generic "industry lore" — is stripped. Those
 * claims are our opinion and should not be dressed as citations.
 *
 * Source MDX files keep the markers intact for future editorial backfill.
 */

// Patterns that force a strip regardless of any other match.
// These are "primary sources" we authored/scraped ourselves, or generic
// composite claims that can't be cited to anything authoritative.
const STRIP_PATTERNS = [
  /manufacturer\s+(?:brochure|catalog(?:ue)?|flyer|spec\s*sheet|monograph|product\s*sheet|technical\s*sheet|data\s*sheet|adherence\s+white\s+paper)/i,
  /product\s+(?:flyer|catalog(?:ue)?|sheet|monograph|datasheet|data\s*sheet)/i,
  /\buser\s+manual|\bservice\s+manual|\bowner's?\s+manual/i,
  /HM[- ](?:KV|KX|CV|BV|Pro)[- ]?(?:Flyer|Catalog|Product)/i,
  /Home\s*Medix.*(?:catalog|flyer|brochure|product\s*sheet)/i,
  /Philips.*(?:catalog|flyer|brochure|user\s*manual)/i,
  /Oxymed.*(?:catalog|flyer|brochure|spec\s*sheet|service\s*centre)/i,
  /Airsep.*(?:catalog|flyer|brochure|spec)/i,
  /Nidek.*(?:catalog|flyer|brochure|spec)/i,
  /BMC.*(?:catalog|flyer|brochure|spec|authori[sz]ed[- ]dealer)/i,
  /e[- ]?commerce\s+product\s+listing/i,
  /manufacturer\s+brochures?\s+and\s+e[- ]?commerce/i,
  /authori[sz]ed[- ]dealer\s+(?:list|data|directory|network|coverage)/i,
  /dealer\s+(?:list|data|directory|network|coverage|footprint)/i,
  /published\s+spec(?:ification)?\s*sheet/i,
  /publicly\s+published\s+specification/i,
  /scraped|surveyed|data\s+from\s+(?:oxygentimes|e-commerce)/i,
  /placeholder/i,
  /industry\s+(?:lore|convention|tracking|state)/i,
  /recall[- ]remediation\s+timeline/i,
  /operating\s+altitude\s+spec(?:ification)?/i,
  /AC\s+(?:input|voltage)\s+(?:specification|tolerance)/i,
  /power\s+spec(?:ification)?|certifications?\b.*published/i,
  /published\s+certifications?|per\s+(?:the\s+)?manufacturer/i,
];

// Ordered source map — first match wins. More specific patterns come first.
const SOURCE_MAP = [
  // ==== International standards ====
  { match: /ISO\s*80601[- ]?2[- ]?69/i, label: 'ISO 80601-2-69', url: 'https://www.iso.org/standard/73645.html' },
  { match: /ISO\s*80601[- ]?2[- ]?70/i, label: 'ISO 80601-2-70', url: 'https://www.iso.org/standard/73644.html' },
  { match: /ISO\s*80601[- ]?2[- ]?74/i, label: 'ISO 80601-2-74', url: 'https://www.iso.org/standard/77561.html' },
  { match: /ISO\s*80601[- ]?2[- ]?79/i, label: 'ISO 80601-2-79', url: 'https://www.iso.org/standard/73690.html' },
  { match: /ISO\s*13485/i, label: 'ISO 13485', url: 'https://www.iso.org/iso-13485-medical-devices.html' },
  { match: /ISO\s*9001/i, label: 'ISO 9001', url: 'https://www.iso.org/iso-9001-quality-management.html' },
  { match: /ISO\s*14971/i, label: 'ISO 14971', url: 'https://www.iso.org/standard/72704.html' },
  { match: /IEC\s*60601[- ]?1[- ]?8/i, label: 'IEC 60601-1-8', url: 'https://webstore.iec.ch/publication/2590' },
  { match: /IEC\s*60601[- ]?1[- ]?2/i, label: 'IEC 60601-1-2', url: 'https://webstore.iec.ch/publication/2590' },
  { match: /IEC\s*60601/i, label: 'IEC 60601', url: 'https://webstore.iec.ch/publication/2590' },

  // ==== US Federal / FAA ====
  { match: /14\s*CFR\s*§?\s*121\.574/i, label: '14 CFR §121.574', url: 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-G/part-121/subpart-K/section-121.574' },
  { match: /14\s*CFR/i, label: '14 CFR', url: 'https://www.ecfr.gov/current/title-14' },
  { match: /21\s*CFR/i, label: '21 CFR', url: 'https://www.accessdata.fda.gov/scripts/cdrh/cfdocs/cfcfr/CFRSearch.cfm' },
  { match: /FAA\s*SFAR\s*106/i, label: 'FAA SFAR 106', url: 'https://www.faa.gov/regulations_policies/rulemaking/sfar' },
  { match: /FAA.*(?:POC|portable\s+oxygen)/i, label: 'FAA POC acceptance list', url: 'https://www.faa.gov/hazmat/resources/medical_portable_oxygen_concentrators' },
  { match: /US\s*FDA|\bFDA\s+510|\bFDA\s+guidance/i, label: 'US FDA', url: 'https://www.fda.gov/medical-devices' },

  // ==== Clinical practice guidelines ====
  { match: /AASM\s*scoring\s*manual/i, label: 'AASM Scoring Manual', url: 'https://aasm.org/clinical-resources/scoring-manual/' },
  { match: /AASM/i, label: 'AASM Practice Guidelines', url: 'https://aasm.org/clinical-resources/practice-standards/practice-guidelines/' },
  { match: /GOLD\s*(?:20\d\d|copd|initiative|report|guideline)/i, label: 'GOLD Report', url: 'https://goldcopd.org/' },
  { match: /BTS\s*\/?\s*ATS\s*(?:home\s*)?NIV|BTS\/ATS\s*NIV/i, label: 'BTS/ATS home NIV statement', url: 'https://thorax.bmj.com/content/77/Suppl_1' },
  { match: /\bBTS\b/i, label: 'British Thoracic Society', url: 'https://www.brit-thoracic.org.uk/quality-improvement/guidelines/' },
  { match: /ATS\s*\/\s*ERS/i, label: 'ATS/ERS statement', url: 'https://www.atsjournals.org/' },
  { match: /\bATS\b(?!\/)/i, label: 'American Thoracic Society', url: 'https://www.thoracic.org/statements/' },
  { match: /\bERS\b(?!NET)/i, label: 'European Respiratory Society', url: 'https://www.ersnet.org/guidelines-and-publications/' },
  { match: /AANEM/i, label: 'AANEM', url: 'https://www.aanem.org/practice/clinical-guidelines' },
  { match: /ASA\s+(?:perioperative|practice)/i, label: 'ASA practice guideline', url: 'https://pubs.asahq.org/anesthesiology/pages/practice-guidelines' },
  { match: /Indian\s*Chest\s*Society|\bICS\s+(?:COPD|LTOT|consensus|guideline)/i, label: 'Indian Chest Society', url: 'https://www.indianchestsociety.in/' },
  { match: /Indian\s*Sleep\s*Disorders/i, label: 'Indian Sleep Disorders Association', url: 'https://isda-india.org/' },

  // ==== Indian regulatory / institutional ====
  { match: /CDSCO\s+Medical\s+Device\s+Registry|CDSCO\s+registry/i, label: 'CDSCO Medical Device Registry', url: 'https://cdscomdonline.gov.in/NewMedDev/Homepage' },
  { match: /CDSCO/i, label: 'CDSCO', url: 'https://cdsco.gov.in/opencms/opencms/en/Medical-Device-Diagnostics/Medical-Device-Diagnostics/' },
  { match: /CGHS/i, label: 'CGHS', url: 'https://cghs.gov.in/' },
  { match: /ESIC|Employees['’]?\s*State\s*Insurance/i, label: 'ESIC', url: 'https://www.esic.gov.in/' },
  { match: /\bECHS\b/i, label: 'ECHS', url: 'https://echs.gov.in/' },
  { match: /\bDGCA\b/i, label: 'DGCA India', url: 'https://www.dgca.gov.in/' },
  { match: /\bBIS\b.*(?:IS\s*12360|IS\s*60601)|IS\s*12360/i, label: 'BIS IS 12360', url: 'https://bis.gov.in/' },
  { match: /\bBIS\b/i, label: 'Bureau of Indian Standards', url: 'https://bis.gov.in/' },
  { match: /\bICMR\b/i, label: 'ICMR', url: 'https://www.icmr.gov.in/' },
  { match: /\bCEA\b\s*(?:20\d\d|report|order|regulation)/i, label: 'CEA', url: 'https://cea.nic.in/notifications/' },
  { match: /MeitY|IT\s+Rules\s+2021|Intermediary\s+Guidelines/i, label: 'India IT Rules 2021', url: 'https://www.meity.gov.in/content/notification-dated-25th-february-2021-gsr-139e-information-technology-intermediary' },
  { match: /IRDAI/i, label: 'IRDAI', url: 'https://www.irdai.gov.in/' },
  { match: /IMD\s+climatolog/i, label: 'India Meteorological Department', url: 'https://www.imdpune.gov.in/Clim_Pred_LRF_New/Climatology.html' },
  { match: /IATA\s+DGR/i, label: 'IATA Dangerous Goods Regulations', url: 'https://www.iata.org/en/publications/dgr/' },

  // ==== Specific research papers — PubMed search URLs ====
  { match: /Masa\s+JF.*(?:Pickwick|Lancet\s*2019)/i, label: 'Masa JF et al, Pickwick trial (Lancet 2019)', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Masa+JF+Pickwick+Lancet+2019' },
  { match: /Murphy\s+PB.*JAMA\s*2017|Murphy.*hypercapnic\s*COPD/i, label: 'Murphy PB et al, JAMA 2017', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Murphy+PB+JAMA+2017+home+NIV+COPD' },
  { match: /Azarbarzin\s+A.*Eur\s+Heart\s+J\s*2019/i, label: 'Azarbarzin A et al, Eur Heart J 2019', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Azarbarzin+Eur+Heart+J+2019+hypoxic+burden' },
  { match: /Sawyer\s+AM.*Sleep\s+Med\s+Rev\s*2011/i, label: 'Sawyer AM et al, Sleep Med Rev 2011', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Sawyer+AM+Sleep+Med+Rev+2011+CPAP+adherence' },
  { match: /Berry\s+RB.*Sleep\s+Breath\s*2013/i, label: 'Berry RB et al, Sleep Breath 2013', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Berry+RB+Sleep+Breath+2013' },
  { match: /Stradling\s+JR.*Thorax/i, label: 'Stradling JR et al, Thorax', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Stradling+JR+Thorax+CPAP' },
  { match: /Weaver\s+TE.*Sleep/i, label: 'Weaver TE et al, Sleep', url: 'https://pubmed.ncbi.nlm.nih.gov/?term=Weaver+TE+Sleep+CPAP+adherence' },

  // ==== Web standards ====
  { match: /WCAG\s*2\.?2|WCAG/i, label: 'WCAG 2.2', url: 'https://www.w3.org/TR/WCAG22/' },
];

function classify(citationText) {
  // Strip if any explicit strip pattern matches.
  for (const p of STRIP_PATTERNS) {
    if (p.test(citationText)) return null;
  }
  // Link if any source-map entry matches.
  for (const entry of SOURCE_MAP) {
    if (entry.match.test(citationText)) {
      return { label: entry.label, url: entry.url };
    }
  }
  // Default: strip (treat as our opinion rather than a citation).
  return null;
}

const CITATION_REGEX = /\s*\[CITATION:([^\]]*)\]/g;

/**
 * Walk MDAST children and replace/remove citation markers in text nodes.
 * Citations inside inlineCode nodes are stripped wholesale (they can't
 * contain links).
 */
function processChildren(parent) {
  if (!Array.isArray(parent.children)) return;
  const newChildren = [];
  for (const child of parent.children) {
    if (child.type === 'inlineCode') {
      if (typeof child.value === 'string' && child.value.includes('[CITATION:')) {
        child.value = child.value.replace(CITATION_REGEX, '').trim();
        if (!child.value) continue; // drop now-empty inline code
      }
      newChildren.push(child);
      continue;
    }
    if (child.type === 'text' && typeof child.value === 'string' && child.value.includes('[CITATION:')) {
      const value = child.value;
      let lastEnd = 0;
      let m;
      const parts = [];
      CITATION_REGEX.lastIndex = 0;
      while ((m = CITATION_REGEX.exec(value)) !== null) {
        if (m.index > lastEnd) {
          parts.push({ type: 'text', value: value.slice(lastEnd, m.index) });
        }
        const cite = m[1].trim();
        const resolved = classify(cite);
        if (resolved) {
          parts.push({ type: 'text', value: ' (' });
          parts.push({
            type: 'link',
            url: resolved.url,
            title: null,
            children: [{ type: 'text', value: resolved.label }],
          });
          parts.push({ type: 'text', value: ')' });
        }
        lastEnd = m.index + m[0].length;
      }
      if (lastEnd < value.length) {
        parts.push({ type: 'text', value: value.slice(lastEnd) });
      }
      // Merge adjacent text nodes
      const merged = [];
      for (const p of parts) {
        if (p.type === 'text' && merged.length && merged[merged.length - 1].type === 'text') {
          merged[merged.length - 1].value += p.value;
        } else {
          merged.push(p);
        }
      }
      // Drop text nodes that became empty after splitting
      for (const p of merged) {
        if (p.type === 'text' && p.value === '') continue;
        newChildren.push(p);
      }
      continue;
    }
    // Recurse into container nodes
    if (child.children) processChildren(child);
    newChildren.push(child);
  }
  parent.children = newChildren;
}

export default function remarkResolveCitations() {
  return (tree) => {
    processChildren(tree);
  };
}
