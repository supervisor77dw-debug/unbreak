#!/usr/bin/env node
/**
 * V3 LCP Fix - Verification Script
 * Prüft alle Anforderungen vor dem Deployment
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CHECKS = {
  passed: [],
  failed: [],
  warnings: []
};

function check(name, condition, errorMsg) {
  if (condition) {
    CHECKS.passed.push(`✅ ${name}`);
    return true;
  } else {
    CHECKS.failed.push(`❌ ${name}: ${errorMsg}`);
    return false;
  }
}

function warn(name, message) {
  CHECKS.warnings.push(`⚠️  ${name}: ${message}`);
}

console.log('═══════════════════════════════════════════════════');
console.log('  V3 LCP FIX - VERIFICATION');
console.log('═══════════════════════════════════════════════════\n');

// 1. Check image files exist
console.log('📁 Checking image files...\n');

const imgDir = join(__dirname, 'public', 'images');
const avifPath = join(imgDir, 'hero-cinematic.avif');
const webpPath = join(imgDir, 'hero-cinematic.webp');
const jpgPath = join(imgDir, 'hero-cinematic.jpg');

check(
  'AVIF exists',
  existsSync(avifPath),
  'hero-cinematic.avif not found'
);

check(
  'WebP exists',
  existsSync(webpPath),
  'hero-cinematic.webp not found'
);

check(
  'JPG exists',
  existsSync(jpgPath),
  'hero-cinematic.jpg not found'
);

// 2. Check file sizes
console.log('\n📊 Checking file sizes...\n');

if (existsSync(avifPath)) {
  const avifSize = statSync(avifPath).size;
  const avifKB = Math.round(avifSize / 1024);
  console.log(`   AVIF: ${avifKB} KB`);
  
  check(
    'AVIF size OK',
    avifSize < 150 * 1024,
    `AVIF too large: ${avifKB} KB (should be < 150 KB)`
  );
  
  // Verify it's real AVIF (not JPG copy)
  const avifBytes = readFileSync(avifPath);
  const isRealAVIF = avifBytes.toString('hex', 4, 8).includes('66747970'); // 'ftyp'
  
  check(
    'AVIF format valid',
    isRealAVIF,
    'AVIF is not a real AVIF file (might be JPG copy)'
  );
}

if (existsSync(webpPath)) {
  const webpSize = statSync(webpPath).size;
  const webpKB = Math.round(webpSize / 1024);
  console.log(`   WebP: ${webpKB} KB`);
  
  check(
    'WebP size OK',
    webpSize < 200 * 1024,
    `WebP too large: ${webpKB} KB (should be < 200 KB)`
  );
  
  // Verify it's real WebP (not JPG copy)
  const webpBytes = readFileSync(webpPath);
  const isRealWebP = webpBytes.toString('hex', 0, 4) === '52494646'; // 'RIFF'
  
  check(
    'WebP format valid',
    isRealWebP,
    'WebP is not a real WebP file (might be JPG copy)'
  );
}

if (existsSync(jpgPath)) {
  const jpgSize = statSync(jpgPath).size;
  const jpgKB = Math.round(jpgSize / 1024);
  console.log(`   JPG:  ${jpgKB} KB (fallback)`);
}

// 3. Check HTML structure
console.log('\n📄 Checking HTML structure...\n');

const htmlPath = join(__dirname, 'public', 'index.html');
if (existsSync(htmlPath)) {
  const html = readFileSync(htmlPath, 'utf-8');
  
  // Check for <picture> with correct order
  const hasPicture = html.includes('<picture>');
  check(
    'Picture element exists',
    hasPicture,
    'No <picture> element found in HTML'
  );
  
  // Check AVIF source
  const hasAVIF = html.includes('hero-cinematic.avif');
  check(
    'AVIF source in HTML',
    hasAVIF,
    'hero-cinematic.avif not referenced in HTML'
  );
  
  // Check WebP source
  const hasWebP = html.includes('hero-cinematic.webp');
  check(
    'WebP source in HTML',
    hasWebP,
    'hero-cinematic.webp not referenced in HTML'
  );
  
  // Check correct source order (AVIF before WebP)
  if (hasAVIF && hasWebP) {
    const avifIndex = html.indexOf('hero-cinematic.avif');
    const webpIndex = html.indexOf('hero-cinematic.webp');
    check(
      'Source order correct',
      avifIndex < webpIndex,
      'AVIF must come before WebP in <picture> sources'
    );
  }
  
  // Check width/height attributes
  const hasWidthHeight = html.match(/width="\d+".*?height="\d+"/s) || html.match(/height="\d+".*?width="\d+"/s);
  check(
    'Width/height attributes set',
    hasWidthHeight,
    'Image missing width/height (causes CLS)'
  );
  
  // Check NO video in initial DOM
  const hasVideoTag = html.match(/<video[^>]*src="[^"]*hero[^"]*\.mp4"/);
  check(
    'No hero video in initial DOM',
    !hasVideoTag,
    'Hero video found in initial HTML (should be injected via JS)'
  );
  
  // Check sentinel exists
  const hasSentinel = html.includes('hero-scroll-sentinel');
  check(
    'Sentinel element exists',
    hasSentinel,
    'Sentinel element not found (needed for lazy video loading)'
  );
  
  // Check fetchpriority
  const hasFetchPriority = html.includes('fetchpriority="high"');
  check(
    'fetchpriority="high" set',
    hasFetchPriority,
    'LCP image should have fetchpriority="high"'
  );
}

// 4. Check JavaScript
console.log('\n⚙️  Checking JavaScript...\n');

const jsPath = join(__dirname, 'public', 'hero-lazy-video.js');
if (existsSync(jsPath)) {
  const js = readFileSync(jsPath, 'utf-8');
  
  // Check for user interaction detection
  const hasUserInteraction = js.includes('userHasInteracted');
  check(
    'User interaction detection',
    hasUserInteraction,
    'hero-lazy-video.js missing user interaction logic'
  );
  
  // Check for sentinel observer
  const hasSentinelObserver = js.includes('hero-scroll-sentinel');
  check(
    'Sentinel observer implemented',
    hasSentinelObserver,
    'hero-lazy-video.js not observing sentinel element'
  );
  
  // Check rootMargin is 0px (no preload)
  const hasZeroMargin = js.includes("rootMargin: '0px'") || js.includes('rootMargin: "0px"');
  check(
    'rootMargin = 0px (no preload)',
    hasZeroMargin,
    'IntersectionObserver should have rootMargin: 0px'
  );
  
  // Check createElement for video
  const usesCreateElement = js.includes('createElement(\'video\')') || js.includes('createElement("video")');
  check(
    'Dynamic video creation',
    usesCreateElement,
    'Video should be created with createElement()'
  );
}

// Summary
console.log('\n═══════════════════════════════════════════════════');
console.log('  VERIFICATION RESULTS');
console.log('═══════════════════════════════════════════════════\n');

CHECKS.passed.forEach(msg => console.log(msg));

if (CHECKS.warnings.length > 0) {
  console.log('');
  CHECKS.warnings.forEach(msg => console.log(msg));
}

if (CHECKS.failed.length > 0) {
  console.log('');
  CHECKS.failed.forEach(msg => console.log(msg));
  console.log('\n❌ VERIFICATION FAILED!');
  console.log('   Fix the issues above before deployment.\n');
  process.exit(1);
} else {
  console.log('\n🎉 ALL CHECKS PASSED!');
  console.log('\n📋 Ready for deployment:');
  console.log('   1. git add -A');
  console.log('   2. git commit -m "fix(lcp): Add real AVIF/WebP hero images"');
  console.log('   3. git push origin lcp-fix-v3-sentinel');
  console.log('   4. Test on Vercel preview URL');
  console.log('   5. Run Lighthouse (expect LCP < 3s)\n');
  process.exit(0);
}
