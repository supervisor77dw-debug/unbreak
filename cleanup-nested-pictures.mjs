#!/usr/bin/env node
/**
 * Cleanup Nested Picture Tags
 * Removes old responsive <picture> wrappers and keeps only AVIF/WebP versions
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PUBLIC_DIR = join(__dirname, 'public');

function cleanupNestedPictures(content, filename) {
  let changed = false;
  
  // Pattern: <picture> with responsive WebP sources containing another <picture> with AVIF/WebP/img
  // We want to keep only the inner <picture> with AVIF/WebP/img
  
  const nestedPattern = /<picture>\s*<source[^>]*srcset="[^"]*-320w\.webp[^>]*>[\s\S]*?<picture>([\s\S]*?)<\/picture>\s*<\/picture>/gi;
  
  const newContent = content.replace(nestedPattern, (match, innerContent) => {
    changed = true;
    console.log(`  🔧 Removing nested <picture> wrapper`);
    return `<picture>${innerContent}</picture>`;
  });
  
  return { content: newContent, changed };
}

function processFile(filePath) {
  const filename = basename(filePath);
  console.log(`\n📄 Processing: ${filename}`);
  
  const originalContent = readFileSync(filePath, 'utf-8');
  const { content, changed } = cleanupNestedPictures(originalContent, filename);
  
  if (changed) {
    writeFileSync(filePath, content, 'utf-8');
    console.log(`   ✅ File updated`);
    return 1;
  } else {
    console.log(`   ⏭️  No nested pictures found`);
    return 0;
  }
}

function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Cleanup Nested <picture> Tags');
  console.log('═══════════════════════════════════════════════════');
  
  const htmlFiles = readdirSync(PUBLIC_DIR)
    .filter(f => f.endsWith('.html'))
    .map(f => join(PUBLIC_DIR, f));
  
  console.log(`\n🔍 Scanning ${htmlFiles.length} HTML files...\n`);
  
  let totalChanges = 0;
  
  for (const file of htmlFiles) {
    totalChanges += processFile(file);
  }
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log('  CLEANUP COMPLETE');
  console.log('═══════════════════════════════════════════════════\n');
  
  console.log(`📊 Files modified: ${totalChanges}`);
  console.log('\n✅ Nested pictures removed!\n');
}

main();
