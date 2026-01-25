#!/usr/bin/env node
/**
 * Verify <picture> Elements
 * Checks for:
 * - No nested <picture> tags
 * - No duplicate image loading (JPG + WebP simultaneously)
 * - Proper AVIF → WebP → JPG/PNG fallback order
 * - Correct lazy/fetchpriority attributes
 */

import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, 'public');

let totalChecks = 0;
let totalWarnings = 0;
let totalErrors = 0;

function checkNestedPicture(content, filename) {
  // Check for <picture> tags that contain another <picture> before the closing </picture>
  const nestedRegex = /<picture[^>]*>(?:(?!<\/picture>)[\s\S])*?<picture[^>]*>/gi;
  const matches = content.match(nestedRegex);
  
  if (matches) {
    console.error(`  ❌ ERROR: Nested <picture> tags found in ${filename}`);
    console.error(`     Count: ${matches.length}`);
    matches.forEach((m, i) => {
      const preview = m.substring(0, 100).replace(/\n/g, ' ');
      console.error(`     ${i + 1}: ${preview}...`);
    });
    totalErrors++;
    return false;
  }
  
  totalChecks++;
  return true;
}

function checkPictureOrder(content, filename) {
  const pictureRegex = /<picture>([\s\S]*?)<\/picture>/gi;
  let match;
  let allCorrect = true;
  
  while ((match = pictureRegex.exec(content)) !== null) {
    const pictureContent = match[1];
    
    // Check source order: AVIF should come before WebP
    const avifPos = pictureContent.indexOf('type="image/avif"');
    const webpPos = pictureContent.indexOf('type="image/webp"');
    
    if (avifPos !== -1 && webpPos !== -1 && avifPos > webpPos) {
      console.error(`  ❌ ERROR: AVIF after WebP in ${filename}`);
      console.error(`     WebP should come after AVIF for optimal loading`);
      totalErrors++;
      allCorrect = false;
    }
    
    totalChecks++;
  }
  
  return allCorrect;
}

function checkDuplicateImageLoading(content, filename) {
  // Check if there are <img> tags loading JPG/PNG that have picture elements
  const pictureRegex = /<picture>([\s\S]*?)<\/picture>/gi;
  let match;
  const pictureImages = new Set();
  
  // Collect all images in <picture> elements
  while ((match = pictureRegex.exec(content)) !== null) {
    const pictureContent = match[1];
    const imgSrcMatch = pictureContent.match(/src=["']images\/([^"']+)["']/);
    if (imgSrcMatch) {
      pictureImages.add(imgSrcMatch[1]);
    }
  }
  
  // Check for standalone <img> tags with same src
  const standaloneImgRegex = /<img[^>]*src=["']images\/([^"']+)["'][^>]*>/gi;
  const allImgs = [];
  
  while ((match = standaloneImgRegex.exec(content)) !== null) {
    allImgs.push(match[1]);
  }
  
  // Check for duplicates
  const seenSrcs = new Set();
  let hasDuplicates = false;
  
  allImgs.forEach(src => {
    if (seenSrcs.has(src)) {
      console.warn(`  ⚠️  WARNING: Duplicate image loading: ${src} in ${filename}`);
      totalWarnings++;
      hasDuplicates = true;
    }
    seenSrcs.add(src);
  });
  
  if (!hasDuplicates) {
    totalChecks++;
  }
  
  return !hasDuplicates;
}

function checkHeroImage(content, filename) {
  // Hero image should have fetchpriority="high" and NO loading="lazy"
  const heroRegex = /<picture>[\s\S]*?images\/hero-cinematic[\s\S]*?<\/picture>/gi;
  const match = heroRegex.exec(content);
  
  if (match) {
    const heroContent = match[0];
    
    if (!heroContent.includes('fetchpriority="high"')) {
      console.warn(`  ⚠️  WARNING: Hero image missing fetchpriority="high" in ${filename}`);
      totalWarnings++;
      return false;
    }
    
    if (heroContent.includes('loading="lazy"')) {
      console.error(`  ❌ ERROR: Hero image has loading="lazy" in ${filename}`);
      console.error(`     Hero should NOT be lazy-loaded!`);
      totalErrors++;
      return false;
    }
    
    totalChecks++;
    return true;
  }
  
  return true; // No hero image in this file
}

function checkBadgeImage(content, filename) {
  // Badge should have loading="lazy" (not in viewport initially on mobile)
  const badgeRegex = /<picture>[\s\S]*?badge-made-in-germany[\s\S]*?<\/picture>/gi;
  const match = badgeRegex.exec(content);
  
  if (match) {
    const badgeContent = match[0];
    
    if (!badgeContent.includes('loading="lazy"')) {
      console.warn(`  ⚠️  WARNING: Badge missing loading="lazy" in ${filename}`);
      totalWarnings++;
      return false;
    }
    
    totalChecks++;
    return true;
  }
  
  return true; // No badge in this file
}

function verifyFile(filePath) {
  const filename = basename(filePath);
  console.log(`\n📄 Verifying: ${filename}`);
  
  const content = readFileSync(filePath, 'utf-8');
  
  let fileOk = true;
  
  fileOk = checkNestedPicture(content, filename) && fileOk;
  fileOk = checkPictureOrder(content, filename) && fileOk;
  fileOk = checkDuplicateImageLoading(content, filename) && fileOk;
  fileOk = checkHeroImage(content, filename) && fileOk;
  fileOk = checkBadgeImage(content, filename) && fileOk;
  
  if (fileOk) {
    console.log(`   ✅ All checks passed`);
  }
}

function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  <PICTURE> Element Verification');
  console.log('  Ensuring Optimal Image Loading');
  console.log('═══════════════════════════════════════════════════');
  
  const htmlFiles = readdirSync(PUBLIC_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => join(PUBLIC_DIR, f));
  
  console.log(`\n🔍 Checking ${htmlFiles.length} HTML files...\n`);
  
  for (const file of htmlFiles) {
    verifyFile(file);
  }
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  VERIFICATION COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');
  
  console.log(`📊 Results:`);
  console.log(`   Total checks: ${totalChecks}`);
  console.log(`   Warnings: ${totalWarnings}`);
  console.log(`   Errors: ${totalErrors}\n`);
  
  if (totalErrors > 0) {
    console.error('❌ VERIFICATION FAILED - Fix errors before deploying!\n');
    process.exit(1);
  } else if (totalWarnings > 0) {
    console.warn('⚠️  Verification passed with warnings\n');
    process.exit(0);
  } else {
    console.log('✅ All verifications passed! Ready to deploy.\n');
    process.exit(0);
  }
}

main();
