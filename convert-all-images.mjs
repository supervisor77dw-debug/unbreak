#!/usr/bin/env node
/**
 * COMPLETE Image Optimization - AVIF & WebP
 * Konvertiert ALLE JPG/PNG Bilder in public/images zu WebP und AVIF
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join, basename, extname } from 'path';
import { existsSync, readdirSync, statSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOURCE_DIR = join(__dirname, 'public', 'images');

const CONVERSION_CONFIGS = {
  webp: {
    quality: 80,
    effort: 6
  },
  avif: {
    quality: 60,
    effort: 6
  }
};

// Skip these files (already converted or not needed)
const SKIP_FILES = [
  'hero-cinematic.avif',
  'hero-cinematic.webp',
  'poster-yacht.avif',
  'poster-yacht.webp'
];

async function convertImage(sourcePath, format) {
  const ext = extname(sourcePath);
  const base = basename(sourcePath, ext);
  const outputExt = format === 'avif' ? '.avif' : '.webp';
  const outputPath = join(dirname(sourcePath), base + outputExt);

  // Skip if output already exists and is newer than source
  if (existsSync(outputPath)) {
    const sourceStats = statSync(sourcePath);
    const outputStats = statSync(outputPath);
    if (outputStats.mtime > sourceStats.mtime) {
      console.log(`  ⏭️  Skipping ${basename(outputPath)} (already up-to-date)`);
      return { success: true, skipped: true };
    }
  }

  console.log(`  🎨 Converting to ${format.toUpperCase()}: ${basename(sourcePath)}`);

  try {
    const config = CONVERSION_CONFIGS[format];
    let pipeline = sharp(sourcePath);

    if (format === 'avif') {
      pipeline = pipeline.avif({
        quality: config.quality,
        effort: config.effort,
        chromaSubsampling: '4:2:0'
      });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({
        quality: config.quality,
        effort: config.effort,
        smartSubsample: true
      });
    }

    await pipeline.toFile(outputPath);

    const sourceSize = statSync(sourcePath).size;
    const outputSize = statSync(outputPath).size;
    const savings = Math.round((1 - outputSize / sourceSize) * 100);

    console.log(`     ✅ ${basename(outputPath)}: ${Math.round(outputSize / 1024)} KB (${savings}% smaller)`);

    return { success: true, size: outputSize, savings };
  } catch (error) {
    console.error(`     ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function processDirectory() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  COMPLETE IMAGE OPTIMIZATION');
  console.log('  WebP + AVIF Generation for ALL Images');
  console.log('═══════════════════════════════════════════════════\n');

  if (!existsSync(SOURCE_DIR)) {
    console.error(`❌ Source directory not found: ${SOURCE_DIR}`);
    process.exit(1);
  }

  const files = readdirSync(SOURCE_DIR);
  const sourceImages = files.filter(f => {
    const ext = extname(f).toLowerCase();
    return (ext === '.jpg' || ext === '.jpeg' || ext === '.png') && !SKIP_FILES.includes(f);
  });

  console.log(`📁 Found ${sourceImages.length} source images to convert\n`);

  let totalOriginal = 0;
  let totalWebP = 0;
  let totalAVIF = 0;
  let convertedCount = 0;

  for (const file of sourceImages) {
    const sourcePath = join(SOURCE_DIR, file);
    const sourceSize = statSync(sourcePath).size;
    totalOriginal += sourceSize;

    console.log(`\n📄 ${file} (${Math.round(sourceSize / 1024)} KB)`);

    // Convert to WebP
    const webpResult = await convertImage(sourcePath, 'webp');
    if (webpResult.success && !webpResult.skipped) {
      totalWebP += webpResult.size;
      convertedCount++;
    }

    // Convert to AVIF
    const avifResult = await convertImage(sourcePath, 'avif');
    if (avifResult.success && !avifResult.skipped) {
      totalAVIF += avifResult.size;
      convertedCount++;
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log('  CONVERSION COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');

  console.log(`📊 STATISTICS:`);
  console.log(`   Source images: ${sourceImages.length}`);
  console.log(`   Conversions: ${convertedCount}`);
  console.log(`   Original total: ${Math.round(totalOriginal / 1024 / 1024)} MB`);
  console.log(`   WebP total: ${Math.round(totalWebP / 1024 / 1024)} MB (${Math.round((1 - totalWebP / totalOriginal) * 100)}% smaller)`);
  console.log(`   AVIF total: ${Math.round(totalAVIF / 1024 / 1024)} MB (${Math.round((1 - totalAVIF / totalOriginal) * 100)}% smaller)`);

  console.log('\n✅ All images converted!');
  console.log('\n📋 Next steps:');
  console.log('   1. git add public/images/*.{webp,avif}');
  console.log('   2. Update HTML to use <picture> elements');
  console.log('   3. Verify no double-loading in DevTools\n');
}

processDirectory().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
