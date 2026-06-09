import sharp from 'sharp';
import { writeFile } from 'node:fs/promises';

// PATAPIM mark redrawn as vector paths (no font dependency).
// Terminal prompt: heavy chevron "❯" + underscore cursor "_", brand gold on dark.
const BG = '#0f0f10';
const FG = '#d4a574';
const S = 1024;
const r = 192;          // corner radius (matches favicon 6/32 ratio)
const sw = 74;          // stroke width

// Chevron vertices (points right), vertically centered, slight left bias to balance underscore.
const chev = `M297 372 L467 512 L297 652`;
// Underscore cursor aligned to chevron baseline.
const usX1 = 512, usX2 = 727, usY = 652;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
  <rect width="${S}" height="${S}" rx="${r}" fill="${BG}"/>
  <g fill="none" stroke="${FG}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">
    <path d="${chev}"/>
    <path d="M${usX1} ${usY} L${usX2} ${usY}"/>
  </g>
</svg>`;

await writeFile('brand/patapim-logo.svg', svg);

const sizes = [1024, 512, 256, 180, 64];
for (const sz of sizes) {
  await sharp(Buffer.from(svg)).resize(sz, sz).png().toFile(`brand/patapim-logo-${sz}.png`);
}
// Transparent-background 1024 variant (mark only), in case it's useful.
const svgT = svg.replace(`<rect width="${S}" height="${S}" rx="${r}" fill="${BG}"/>`, '');
await writeFile('brand/patapim-logo-transparent.svg', svgT);
await sharp(Buffer.from(svgT)).resize(1024, 1024).png().toFile('brand/patapim-logo-1024-transparent.png');

console.log('done');
