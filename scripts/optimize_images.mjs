#!/usr/bin/env node
/**
 * Generate WebP and AVIF variants of every JPG/PNG in public/images/products/
 * into public/images/opt/ alongside the originals. Skips images whose variants
 * are already up-to-date (by mtime).
 */
import sharp from 'sharp';
import { readdir, mkdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join, basename, extname, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const SITE = resolve(here, '..');

const SRC_DIR = join(SITE, 'public', 'images', 'products');
const OUT_DIR = join(SITE, 'public', 'images', 'opt');

const MAX_WIDTH = 900;
const QUALITY_WEBP = 80;
const QUALITY_AVIF = 55;

async function variantUpToDate(variantPath, srcStat) {
  try {
    const s = await stat(variantPath);
    return s.mtimeMs >= srcStat.mtimeMs;
  } catch {
    return false;
  }
}

async function processImage(filename) {
  const stem = basename(filename, extname(filename));
  const srcPath = join(SRC_DIR, filename);
  const webpPath = join(OUT_DIR, `${stem}.webp`);
  const avifPath = join(OUT_DIR, `${stem}.avif`);

  const srcStat = await stat(srcPath);
  const [webpOK, avifOK] = await Promise.all([
    variantUpToDate(webpPath, srcStat),
    variantUpToDate(avifPath, srcStat),
  ]);
  if (webpOK && avifOK) return { skipped: true };

  const img = sharp(srcPath);
  const meta = await img.metadata();
  const resized = (meta.width ?? 0) > MAX_WIDTH ? img.resize({ width: MAX_WIDTH }) : img;

  const jobs = [];
  if (!webpOK) jobs.push(resized.clone().webp({ quality: QUALITY_WEBP, effort: 4 }).toFile(webpPath));
  if (!avifOK) jobs.push(resized.clone().avif({ quality: QUALITY_AVIF, effort: 4 }).toFile(avifPath));
  await Promise.all(jobs);
  return { done: true };
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const all = await readdir(SRC_DIR);
  const files = all.filter((f) => /\.(jpe?g|png)$/i.test(f));
  console.log(`processing ${files.length} images → ${OUT_DIR}`);

  let done = 0, skipped = 0, errors = 0;
  const BATCH = 6;
  for (let i = 0; i < files.length; i += BATCH) {
    const chunk = files.slice(i, i + BATCH);
    const results = await Promise.allSettled(chunk.map(processImage));
    for (let j = 0; j < results.length; j++) {
      const r = results[j];
      if (r.status === 'rejected') {
        errors++;
        console.error(`  error ${chunk[j]}: ${r.reason?.message ?? r.reason}`);
      } else if (r.value.skipped) skipped++;
      else done++;
    }
    if ((i + BATCH) < files.length) {
      process.stdout.write(`  ${Math.min(i + BATCH, files.length)}/${files.length}\r`);
    }
  }
  console.log(`\n✓ generated ${done}, skipped ${skipped}, errors ${errors}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
