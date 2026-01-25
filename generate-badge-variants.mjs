import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sizes = [64, 128, 256];
const inputImage = join(__dirname, 'public/images/badge-made-in-germany.png');

console.log('🎨 Generating badge variants...\n');

for (const size of sizes) {
  const outputAvif = join(__dirname, `public/images/badge-made-in-germany-${size}.avif`);
  const outputWebp = join(__dirname, `public/images/badge-made-in-germany-${size}.webp`);
  
  // Generate AVIF
  await sharp(inputImage)
    .resize(size)
    .avif({ quality: 80 })
    .toFile(outputAvif);
  
  const avifStats = await sharp(outputAvif).metadata();
  const avifSize = (await import('fs')).statSync(outputAvif).size;
  console.log(`✅ ${size}px AVIF: ${Math.round(avifSize / 1024)} KB`);
  
  // Generate WebP
  await sharp(inputImage)
    .resize(size)
    .webp({ quality: 85 })
    .toFile(outputWebp);
  
  const webpSize = (await import('fs')).statSync(outputWebp).size;
  console.log(`✅ ${size}px WebP: ${Math.round(webpSize / 1024)} KB`);
}

console.log('\n✨ Badge variants generated successfully!');
