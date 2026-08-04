#!/usr/bin/env node

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, dirname, resolve } from 'node:path';

function argument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  const source = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        field += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === ',' && !quoted) {
      row.push(field);
      field = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && source[i + 1] === '\n') i += 1;
      row.push(field);
      if (row.some((value) => value.length)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }

  const [headers, ...values] = rows;
  return values.map((valuesRow) =>
    Object.fromEntries(headers.map((header, index) => [header.trim(), valuesRow[index] ?? '']))
  );
}

function queryCluster(query) {
  const value = query.toLowerCase();
  if (/leak|mask seal|mouth leak/.test(value)) return 'CPAP leaks and masks';
  if (/cpap|apap|airview|icode|resmed|sleep report|ahi/.test(value)) return 'CPAP therapy and data';
  if (/bipap|niv|hypercap|backup rate|pressure support/.test(value)) return 'BiPAP and NIV';
  if (/concentrator|oxygen machine|home oxygen/.test(value)) return 'Oxygen concentrators';
  if (/venturi|nasal cannula|oxygen mask|flow meter/.test(value)) return 'Oxygen delivery';
  if (/ayushman|reimburse|insurance|cghs/.test(value)) return 'Payment and reimbursement';
  return 'Other respiratory';
}

function pageSection(page) {
  try {
    const first = new URL(page).pathname.split('/').filter(Boolean)[0];
    return first || 'home';
  } catch {
    return 'other';
  }
}

function groupSum(rows, keyFn, valueFn) {
  const totals = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    totals.set(key, (totals.get(key) ?? 0) + valueFn(row));
  }
  return [...totals.entries()]
    .map(([name, citations]) => ({ name, citations }))
    .sort((a, b) => b.citations - a.citations);
}

function percent(value, total) {
  return total ? `${((value / total) * 100).toFixed(1)}%` : '0.0%';
}

function markdown(report) {
  const lines = [
    `# AI visibility scorecard — ${report.report_date}`,
    '',
    `Source files: \`${report.sources.queries}\` and \`${report.sources.pages}\`.`,
    '',
    `- Query citations: **${report.totals.query_citations.toLocaleString()}** across ${report.totals.queries} reported queries`,
    `- Page citations: **${report.totals.page_citations.toLocaleString()}** across ${report.totals.pages} cited URLs`,
    `- Top 10 page concentration: **${report.concentration.top_10_share}**`,
    `- Top 20 page concentration: **${report.concentration.top_20_share}**`,
    '',
    '## Query clusters',
    '',
    '| Cluster | Citations | Share |',
    '|---|---:|---:|',
    ...report.query_clusters.map((row) => `| ${row.name} | ${row.citations} | ${row.share} |`),
    '',
    '## Cited page sections',
    '',
    '| Section | Citations | Share |',
    '|---|---:|---:|',
    ...report.page_sections.map((row) => `| ${row.name} | ${row.citations} | ${row.share} |`),
    '',
    '## Highest-cited pages',
    '',
    '| Page | Citations | Share |',
    '|---|---:|---:|',
    ...report.top_pages.map(
      (row) => `| [${new URL(row.page).pathname}](${row.page}) | ${row.citations} | ${row.share} |`
    ),
    '',
    '## Highest-cited grounding queries',
    '',
    '| Query | Cluster | Citations | Reported citation share |',
    '|---|---|---:|---:|',
    ...report.top_queries.map(
      (row) => `| ${row.query} | ${row.cluster} | ${row.citations} | ${row.reported_share || '—'} |`
    ),
    '',
    '## Weekly interpretation',
    '',
    '- Protect pages already earning citations: update them carefully and preserve their canonical URLs.',
    '- Expand clusters where a broad commercial query has citations but HHZ citation share is weak.',
    '- Diagnose drops at both cluster and URL level before publishing near-duplicate pages.',
    '- Use the prompt matrix for qualitative checks; AI answers are stochastic, so record evidence and repeat runs.',
    '',
  ];
  return lines.join('\n');
}

const queriesPath = argument('--queries');
const pagesPath = argument('--pages');
const outputBase = argument('--out');
const reportDate = argument('--date') ?? new Date().toISOString().slice(0, 10);

if (!queriesPath || !pagesPath) {
  console.error(
    'Usage: node scripts/ai-visibility-report.mjs --queries queries.csv --pages pages.csv [--out reports/ai-visibility/YYYY-MM-DD] [--date YYYY-MM-DD]'
  );
  process.exit(1);
}

const queryRows = parseCsv(readFileSync(resolve(queriesPath), 'utf8'));
const pageRows = parseCsv(readFileSync(resolve(pagesPath), 'utf8'));
const queryCitations = queryRows.reduce((sum, row) => sum + Number(row.Citations || 0), 0);
const pageCitations = pageRows.reduce((sum, row) => sum + Number(row.Citations || 0), 0);
const sortedPages = pageRows
  .map((row) => ({ page: row.Page, citations: Number(row.Citations || 0) }))
  .sort((a, b) => b.citations - a.citations);
const addShare = (rows, total) => rows.map((row) => ({ ...row, share: percent(row.citations, total) }));

const report = {
  report_date: reportDate,
  sources: { queries: basename(queriesPath), pages: basename(pagesPath) },
  totals: {
    queries: queryRows.length,
    query_citations: queryCitations,
    pages: pageRows.length,
    page_citations: pageCitations,
  },
  concentration: {
    top_10_share: percent(sortedPages.slice(0, 10).reduce((sum, row) => sum + row.citations, 0), pageCitations),
    top_20_share: percent(sortedPages.slice(0, 20).reduce((sum, row) => sum + row.citations, 0), pageCitations),
  },
  query_clusters: addShare(
    groupSum(queryRows, (row) => queryCluster(row['Grounding Query']), (row) => Number(row.Citations || 0)),
    queryCitations
  ),
  page_sections: addShare(
    groupSum(pageRows, (row) => pageSection(row.Page), (row) => Number(row.Citations || 0)),
    pageCitations
  ),
  top_pages: addShare(sortedPages.slice(0, 20), pageCitations),
  top_queries: queryRows
    .map((row) => ({
      query: row['Grounding Query'],
      cluster: queryCluster(row['Grounding Query']),
      citations: Number(row.Citations || 0),
      reported_share: row['Citation Share'],
    }))
    .sort((a, b) => b.citations - a.citations),
};

if (outputBase) {
  const base = resolve(outputBase);
  mkdirSync(dirname(base), { recursive: true });
  writeFileSync(`${base}.json`, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(`${base}.md`, markdown(report));
  console.log(`Wrote ${base}.json and ${base}.md`);
} else {
  process.stdout.write(markdown(report));
}
