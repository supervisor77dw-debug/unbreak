#!/usr/bin/env node
/**
 * Update <img> to <picture> elements
 * Ersetzt alle <img src="images/*.jpg"> mit optimierten <picture> Elementen
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname, basename, extname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, 'public');
const IMAGES_DIR = join(PUBLIC_DIR, 'images');

// Files that MUST stay as <img> (no picture element)
const SKIP_CONVERSIONS = [
  'logo.png',           // Header logo - needs to stay simple
  'logo_alt.png'        // Alt logo
];

// Hero image gets special treatment (fetchpriority="high", no lazy)
const HERO_IMAGE = 'hero-cinematic.jpg';

function getImageFiles() {
  const files = readdirSync(IMAGES_DIR);
  const images = new Map();
  
  files.forEach(file => {
    const ext = extname(file).toLowerCase();
    const base = basename(file, ext);
    
    if (ext === '.jpg' || ext === '.jpeg' || ext === '.png') {
      if (!images.has(base)) {
        images.set(base, { original: file, webp: false, avif: false });
      }
    } else if (ext === '.webp') {
      if (!images.has(base)) {
        images.set(base, { original: null, webp: file, avif: false });
      } else {
        images.get(base).webp = file;
      }
    } else if (ext === '.avif') {
      if (!images.has(base)) {
        images.set(base, { original: null, webp: false, avif: file });
      } else {
        images.get(base).avif = file;
      }
    }
  });
  
  return images;
}

function createPictureElement(imgTag, imageFiles) {
  // Extract attributes from original img tag
  const srcMatch = imgTag.match(/src=["']([^"']+)["']/);
  if (!srcMatch) return imgTag; // Skip if no src
  
  const src = srcMatch[1];
  
  // Extract image filename from src (handle both "images/file.jpg" and "./images/file.jpg")
  const srcFilename = src.replace(/^\.?\/?(images\/)?/, '');
  const ext = extname(srcFilename).toLowerCase();
  const base = basename(srcFilename, ext);
  
  // Skip if in skip list
  if (SKIP_CONVERSIONS.some(skip => srcFilename.includes(skip))) {
    console.log(`  ⏭️  Skipping ${srcFilename} (in skip list)`);
    return imgTag;
  }
  
  // Get available formats
  const formats = imageFiles.get(base);
  if (!formats || (!formats.avif && !formats.webp)) {
    console.log(`  ⚠️  No WebP/AVIF found for ${srcFilename}`);
    return imgTag; // Keep original if no optimized versions
  }
  
  // Extract all other attributes
  const altMatch = imgTag.match(/alt=["']([^"']*)["']/);
  const classMatch = imgTag.match(/class=["']([^"']*)["']/);
  const styleMatch = imgTag.match(/style=["']([^"']*)["']/);
  const widthMatch = imgTag.match(/width=["']?(\d+)["']?/);
  const heightMatch = imgTag.match(/height=["']?(\d+)["']?/);
  const dataI18nAltMatch = imgTag.match(/data-i18n-alt=["']([^"']*)["']/);
  
  const alt = altMatch ? altMatch[1] : '';
  const classAttr = classMatch ? ` class="${classMatch[1]}"` : '';
  const styleAttr = styleMatch ? ` style="${styleMatch[1]}"` : '';
  const widthAttr = widthMatch ? ` width="${widthMatch[1]}"` : '';
  const heightAttr = heightMatch ? ` height="${heightMatch[1]}"` : '';
  const dataI18nAttr = dataI18nAltMatch ? ` data-i18n-alt="${dataI18nAltMatch[1]}"` : '';
  
  // Determine loading and fetchpriority
  const isHero = srcFilename.includes(HERO_IMAGE);
  const loadingAttr = isHero ? '' : ' loading="lazy"';
  const fetchPriorityAttr = isHero ? ' fetchpriority="high"' : '';
  const decodingAttr = ' decoding="async"';
  
  // Build <picture> element
  let picture = '<picture>\n';
  
  if (formats.avif) {
    picture += `    <source type="image/avif" srcset="images/${base}.avif">\n`;
  }
  
  if (formats.webp) {
    picture += `    <source type="image/webp" srcset="images/${base}.webp">\n`;
  }
  
  picture += `    <img src="${src}"${classAttr}${styleAttr}${widthAttr}${heightAttr} alt="${alt}"${dataI18nAttr}${loadingAttr}${fetchPriorityAttr}${decodingAttr}>\n`;
  picture += '  </picture>';
  
  return picture;
}

function processHtmlFile(filePath, imageFiles) {
  console.log(`\n📄 Processing: ${basename(filePath)}`);
  
  let content = readFileSync(filePath, 'utf-8');
  let changes = 0;
  
  // Find all <img> tags that reference images/ directory
  const imgRegex = /<img[^>]*src=["'][^"']*images\/[^"']*\.(jpg|jpeg|png)[^>]*>/gi;
  
  content = content.replace(imgRegex, (match) => {
    const newTag = createPictureElement(match, imageFiles);
    if (newTag !== match) {
      changes++;
      return newTag;
    }
    return match;
  });
  
  if (changes > 0) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`   ✅ Updated ${changes} <img> tag(s) to <picture>`);
  } else {
    console.log(`   ⏭️  No changes needed`);
  }
  
  return changes;
}

function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  IMG → PICTURE Element Converter');
  console.log('  Optimized Loading with AVIF + WebP');
  console.log('═══════════════════════════════════════════════════');
  
  // Get all available image formats
  console.log('\n🔍 Scanning images directory...');
  const imageFiles = getImageFiles();
  console.log(`   Found ${imageFiles.size} unique images`);
  
  // Find all HTML files in public/
  const htmlFiles = readdirSync(PUBLIC_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => join(PUBLIC_DIR, f));
  
  console.log(`   Found ${htmlFiles.length} HTML files\n`);
  
  let totalChanges = 0;
  
  // Process each HTML file
  for (const file of htmlFiles) {
    const changes = processHtmlFile(file, imageFiles);
    totalChanges += changes;
  }
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  CONVERSION COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');
  
  console.log(`📊 Total changes: ${totalChanges} <img> tags converted to <picture>`);
  console.log('\n✅ All HTML files updated!');
  console.log('\n📋 Next steps:');
  console.log('   1. git add public/*.html');
  console.log('   2. Test locally: npm run dev');
  console.log('   3. Check DevTools Network: Should load AVIF/WebP only');
  console.log('   4. Verify no double-loading (JPG + WebP simultaneously)\n');
}

main();
