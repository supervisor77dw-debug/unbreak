#!/usr/bin/env node
/**
 * Quick Check - Verify no 404s for AVIF/WebP files
 * Ensures all referenced images exist in public/images/
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, 'public');
const IMAGES_DIR = join(PUBLIC_DIR, 'images');

let totalChecks = 0;
let missing = [];

function checkFile(filePath) {
  const filename = basename(filePath);
  let content = readFileSync(filePath, 'utf-8');
  
  // Remove HTML comments to avoid checking commented-out image references
  content = content.replace(/<!--[\s\S]*?-->/g, '');
  
  // Find all image references in srcset and src
  const srcsetRegex = /srcset=["']images\/([^"']+)["']/g;
  const srcRegex = /src=["']images\/([^"']+)["']/g;
  
  let match;
  const refs = new Set();
  
  while ((match = srcsetRegex.exec(content)) !== null) {
    refs.add(match[1]);
  }
  
  while ((match = srcRegex.exec(content)) !== null) {
    refs.add(match[1]);
  }
  
  refs.forEach(ref => {
    // Remove query parameters
    const cleanRef = ref.split('?')[0];
    const imagePath = join(IMAGES_DIR, cleanRef);
    
    if (!existsSync(imagePath)) {
      missing.push({ file: filename, image: cleanRef });
    }
    totalChecks++;
  });
}

function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Quick Check - Image References');
  console.log('  Verify No 404s');
  console.log('═══════════════════════════════════════════════════\n');
  
  const htmlFiles = readdirSync(PUBLIC_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => join(PUBLIC_DIR, f));
  
  for (const file of htmlFiles) {
    checkFile(file);
  }
  
  console.log(`📊 Checked ${totalChecks} image references in ${htmlFiles.length} HTML files\n`);
  
  if (missing.length === 0) {
    console.log('✅ All images found! No 404s expected.\n');
    process.exit(0);
  } else {
    console.error(`❌ Missing ${missing.length} images:\n`);
    missing.forEach(({ file, image }) => {
      console.error(`   ${file}: images/${image}`);
    });
    console.error('\n⚠️  These will cause 404 errors in production!\n');
    process.exit(1);
  }
}

main();
