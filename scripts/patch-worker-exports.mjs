// Post-build patch: re-export Durable Object classes from dist/_worker.js/index.js.
// Astro's Cloudflare adapter bundles them into internal chunks but doesn't
// propagate named exports to the final entry that Wrangler reads, so Wrangler
// refuses to bind DO classes it "can't find". This script adds the missing
// re-exports deterministically.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const DO_CLASSES = ['TelegramInstance'];
const ENTRY = resolve('dist/_worker.js/index.js');
const ADAPTER_RE_EXPORT_MODULE = './_@astrojs-ssr-adapter.mjs';

let source = readFileSync(ENTRY, 'utf8');
const missing = DO_CLASSES.filter(cls => !new RegExp(`\\b${cls}\\b`).test(source));

if (missing.length === 0) {
  console.log('[patch-worker-exports] all DO classes already re-exported');
  process.exit(0);
}

const appendix = `\nexport { ${missing.join(', ')} } from '${ADAPTER_RE_EXPORT_MODULE}';\n`;
writeFileSync(ENTRY, source + appendix);
console.log('[patch-worker-exports] re-exported:', missing.join(', '));
