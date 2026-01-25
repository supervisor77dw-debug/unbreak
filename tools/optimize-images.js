#!/usr/bin/env node

/**
 * UNBREAK ONE - Image Optimization Tool
 * Generates WebP and AVIF formats from source images
 * Uses sharp for reliable, cross-platform image processing
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Configuration
const IMAGES_DIR = path.join(__dirname, '../public/images');
const QUALITY = 85;
const BREAKPOINTS = [320, 640, 1024];

const TARGET_IMAGES = [
  'badge-made-in-germany.png',
  'hero-cinematic.jpg',
  'Camper_Hero.jpg',
  'Bar_Hero.jpg',
  'scene-home.jpg',
  'weinglashalter_szene_ship.jpg',
  'flaschenhalter_szene_ship.jpg'
];

console.log('==================================');
console.log('UNBREAK ONE - Image Optimization');
console.log('==================================\n');

// Ensure images directory exists
if (!fs.existsSync(IMAGES_DIR)) {
  console.error(`ERROR: Images directory not found: ${IMAGES_DIR}`);
  process.exit(1);
}

async function optimizeImage(imageName) {
  const sourcePath = path.join(IMAGES_DIR, imageName);
  
  if (!fs.existsSync(sourcePath)) {
    console.log(`⚠️  SKIP: ${imageName} (not found)`);
    return;
  }
  
  const baseName = path.basename(imageName, path.extname(imageName));
  console.log(`🖼️  Processing: ${imageName}`);
  
  try {
    const originalStats = fs.statSync(sourcePath);
    const originalSize = originalStats.size / 1024; // KB
    
    // Generate original-size WebP
    const webpOriginalPath = path.join(IMAGES_DIR, `${baseName}.webp`);
    await sharp(sourcePath)
      .webp({ quality: QUALITY })
      .toFile(webpOriginalPath);
    
    const webpStats = fs.statSync(webpOriginalPath);
    const webpSize = webpStats.size / 1024;
    const savings = ((1 - (webpSize / originalSize)) * 100).toFixed(1);
    
    console.log(`   ✓ Original WebP: ${webpSize.toFixed(1)} KB (-${savings}%)`);
    
    // Generate responsive breakpoints
    const image = sharp(sourcePath);
    const metadata = await image.metadata();
    
    for (const width of BREAKPOINTS) {
      // Skip if image is already smaller than breakpoint
      if (metadata.width && metadata.width < width) {
        console.log(`   ⚠️  Skip ${width}w (original is ${metadata.width}px)`);
        continue;
      }
      
      const webpBreakpointPath = path.join(IMAGES_DIR, `${baseName}-${width}w.webp`);
      
      await sharp(sourcePath)
        .resize(width, null, { 
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality: QUALITY })
        .toFile(webpBreakpointPath);
      
      const breakpointStats = fs.statSync(webpBreakpointPath);
      const breakpointSize = breakpointStats.size / 1024;
      
      console.log(`   ✓ ${width}w: ${breakpointSize.toFixed(1)} KB`);
    }
    
    console.log('');
  } catch (error) {
    console.error(`   ❌ Error processing ${imageName}:`, error.message);
    console.log('');
  }
}

async function optimizeAll() {
  console.log(`Processing ${TARGET_IMAGES.length} images...\n`);
  
  for (const imageName of TARGET_IMAGES) {
    await optimizeImage(imageName);
  }
  
  console.log('==================================');
  console.log('✅ Optimization complete!');
  console.log('==================================\n');
  
  // List generated WebP files
  const webpFiles = fs.readdirSync(IMAGES_DIR).filter(f => f.endsWith('.webp'));
  console.log(`Generated ${webpFiles.length} WebP files:`);
  webpFiles.forEach(f => console.log(`  - ${f}`));
}

// Run optimization
optimizeAll().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
