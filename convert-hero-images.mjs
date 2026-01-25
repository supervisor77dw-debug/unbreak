#!/usr/bin/env node
/**
 * Hero Image Converter - AVIF & WebP
 * Erstellt optimierte next-gen Formate aus hero-cinematic.jpg
 */

import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SOURCE_IMAGE = join(__dirname, 'public', 'images', 'hero-cinematic.jpg');
const OUTPUT_DIR = join(__dirname, 'public', 'images');

const FORMATS = {
  avif: {
    quality: 65,
    effort: 6,
    targetSize: 100 * 1024, // ~100 KB
    outputFile: 'hero-cinematic.avif'
  },
  webp: {
    quality: 80,
    effort: 6,
    targetSize: 150 * 1024, // ~150 KB
    outputFile: 'hero-cinematic.webp'
  }
};

async function convertImage(format, options) {
  const outputPath = join(OUTPUT_DIR, options.outputFile);
  
  console.log(`\n🎨 Converting to ${format.toUpperCase()}...`);
  console.log(`   Source: ${SOURCE_IMAGE}`);
  console.log(`   Output: ${outputPath}`);
  console.log(`   Quality: ${options.quality}, Effort: ${options.effort}`);
  
  try {
    const image = sharp(SOURCE_IMAGE);
    const metadata = await image.metadata();
    
    console.log(`   Dimensions: ${metadata.width}x${metadata.height}`);
    
    let pipeline = image;
    
    if (format === 'avif') {
      pipeline = pipeline.avif({
        quality: options.quality,
        effort: options.effort,
        chromaSubsampling: '4:2:0'
      });
    } else if (format === 'webp') {
      pipeline = pipeline.webp({
        quality: options.quality,
        effort: options.effort,
        smartSubsample: true
      });
    }
    
    await pipeline.toFile(outputPath);
    
    // Verify output
    const stats = await sharp(outputPath).metadata();
    const fileSize = (await import('fs')).statSync(outputPath).size;
    const fileSizeKB = Math.round(fileSize / 1024);
    
    console.log(`   ✅ Success!`);
    console.log(`   Size: ${fileSizeKB} KB (target: ~${Math.round(options.targetSize / 1024)} KB)`);
    console.log(`   Format: ${stats.format}, ${stats.width}x${stats.height}`);
    
    // Warning if size too large
    if (fileSize > options.targetSize * 1.5) {
      console.log(`   ⚠️  Warning: File larger than target (${fileSizeKB} KB > ${Math.round(options.targetSize / 1024)} KB)`);
    }
    
    return { success: true, size: fileSize, path: outputPath };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  UNBREAK ONE - Hero Image Converter');
  console.log('  AVIF & WebP Generation');
  console.log('═══════════════════════════════════════════════════');
  
  // Check source exists
  if (!existsSync(SOURCE_IMAGE)) {
    console.error(`\n❌ Source image not found: ${SOURCE_IMAGE}`);
    process.exit(1);
  }
  
  const sourceStats = (await import('fs')).statSync(SOURCE_IMAGE);
  console.log(`\n📁 Source JPG: ${Math.round(sourceStats.size / 1024)} KB`);
  
  // Convert to AVIF
  const avifResult = await convertImage('avif', FORMATS.avif);
  
  // Convert to WebP
  const webpResult = await convertImage('webp', FORMATS.webp);
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  CONVERSION COMPLETE');
  console.log('═══════════════════════════════════════════════════');
  
  const originalSizeKB = Math.round(sourceStats.size / 1024);
  
  if (avifResult.success) {
    const avifSizeKB = Math.round(avifResult.size / 1024);
    const avifSavings = Math.round((1 - avifResult.size / sourceStats.size) * 100);
    console.log(`✅ AVIF: ${avifSizeKB} KB (${avifSavings}% smaller than JPG)`);
  }
  
  if (webpResult.success) {
    const webpSizeKB = Math.round(webpResult.size / 1024);
    const webpSavings = Math.round((1 - webpResult.size / sourceStats.size) * 100);
    console.log(`✅ WebP: ${webpSizeKB} KB (${webpSavings}% smaller than JPG)`);
  }
  
  console.log(`📊 Original JPG: ${originalSizeKB} KB`);
  
  if (avifResult.success && webpResult.success) {
    console.log('\n🎉 All conversions successful!');
    console.log('\n📋 Next steps:');
    console.log('   1. Verify images in public/images/');
    console.log('   2. git add public/images/hero-cinematic.{avif,webp}');
    console.log('   3. Test locally: npm run dev');
    console.log('   4. Check DevTools Network: Should load AVIF (~100 KB)');
    process.exit(0);
  } else {
    console.error('\n❌ Some conversions failed!');
    process.exit(1);
  }
}

main().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
