// Builds the hero portrait from a person cutout (transparent PNG).
// 1. swift scripts/segment.swift <photo.heic> cut.png   (macOS Vision person segmentation)
// 2. node scripts/portrait.mjs cut.png
import sharp from 'sharp';

const src = process.argv[2];
if (!src) throw new Error('usage: node scripts/portrait.mjs <cutout.png>');
for (const w of [560, 960]) {
  const out = `public/portrait/eddy-${w}.webp`;
  await sharp(src).resize(w).modulate({ saturation: 0.5 }).linear(1.08, -8).webp({ quality: 82, alphaQuality: 90 }).toFile(out);
  console.log('✓', out);
}
