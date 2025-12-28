#!/usr/bin/env node
/**
 * UNBREAK ONE - Repository Health Check
 * Validates Node version, file structure, env vars, and hardcoded URLs
 * 
 * Usage: npm run healthcheck
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function checkMark(pass) {
  return pass ? '✅' : '❌';
}

// ============================================
// 1. Node Version Check
// ============================================
function checkNodeVersion() {
  log('\n📦 Checking Node.js Version...', 'cyan');
  
  const currentVersion = process.version;
  const majorVersion = parseInt(currentVersion.slice(1).split('.')[0]);
  
  log(`   Current: ${currentVersion}`, 'blue');
  
  if (majorVersion === 20) {
    log(`   ${checkMark(true)} Node 20.x LTS (recommended)`, 'green');
    return true;
  } else if (majorVersion > 20) {
    log(`   ${checkMark(false)} Node ${majorVersion}.x detected - Next.js 14 works best with Node 20.x`, 'yellow');
    log(`   💡 Run: nvm use 20`, 'yellow');
    return false;
  } else {
    log(`   ${checkMark(false)} Node ${majorVersion}.x is too old - upgrade to Node 20.x`, 'red');
    return false;
  }
}

// ============================================
// 2. File Structure Check
// ============================================
function checkFileStructure() {
  log('\n📂 Checking File Structure...', 'cyan');
  
  const criticalFiles = [
    'package.json',
    'next.config.js',
    '.nvmrc',
    'pages/shop.js',
    'pages/api/checkout/standard.js',
    'lib/supabase.js',
    'lib/stripe.js',
    'database/schema.sql',
  ];
  
  let allExist = true;
  
  criticalFiles.forEach(file => {
    const fullPath = join(ROOT, file);
    const exists = existsSync(fullPath);
    log(`   ${checkMark(exists)} ${file}`, exists ? 'green' : 'red');
    if (!exists) allExist = false;
  });
  
  // Check if /shop route exists
  const shopJsExists = existsSync(join(ROOT, 'pages', 'shop.js'));
  if (shopJsExists) {
    log(`   ${checkMark(true)} /shop route exists (pages/shop.js - Dynamic SSR)`, 'green');
  } else {
    log(`   ${checkMark(false)} /shop route missing - expected pages/shop.js`, 'red');
    allExist = false;
  }
  
  return allExist;
}

// ============================================
// 3. Hardcoded URL Check
// ============================================
function checkHardcodedUrls() {
  log('\n🔍 Scanning for Hardcoded URLs...', 'cyan');
  
  const bannedPatterns = [
    'shop.unbreak-one.com',
    'op.unbreak-one.com',
    'https://shop.',
  ];
  
  let foundIssues = false;
  
  bannedPatterns.forEach(pattern => {
    try {
      // Use git grep if available (faster), otherwise skip
      const result = execSync(
        `git grep -n "${pattern}" -- "*.js" "*.jsx" "*.ts" "*.tsx" "*.mjs" || exit 0`,
        { cwd: ROOT, encoding: 'utf8' }
      ).trim();
      
      if (result) {
        log(`   ${checkMark(false)} Found "${pattern}":`, 'red');
        result.split('\n').forEach(line => {
          if (line) log(`      ${line}`, 'red');
        });
        foundIssues = true;
      } else {
        log(`   ${checkMark(true)} No "${pattern}" found`, 'green');
      }
    } catch (err) {
      // git grep failed (not a git repo or no matches)
      log(`   ⚠️  Could not search for "${pattern}" (git not available)`, 'yellow');
    }
  });
  
  return !foundIssues;
}

// ============================================
// 4. Environment Variables Check
// ============================================
function checkEnvVars() {
  log('\n🔑 Checking Environment Variables...', 'cyan');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'STRIPE_SECRET_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  ];
  
  const optionalVars = [
    'NEXT_PUBLIC_SITE_URL',
    'STRIPE_WEBHOOK_SECRET',
  ];
  
  let allPresent = true;
  
  // Load .env.local if exists
  const envPath = join(ROOT, '.env.local');
  if (existsSync(envPath)) {
    log('   📄 Found .env.local', 'blue');
    try {
      const envContent = readFileSync(envPath, 'utf8');
      
      requiredVars.forEach(varName => {
        const regex = new RegExp(`^${varName}=.+`, 'm');
        const found = regex.test(envContent);
        log(`   ${checkMark(found)} ${varName}`, found ? 'green' : 'red');
        if (!found) allPresent = false;
      });
      
      log('   Optional:', 'blue');
      optionalVars.forEach(varName => {
        const regex = new RegExp(`^${varName}=.+`, 'm');
        const found = regex.test(envContent);
        log(`   ${found ? '✓' : '○'} ${varName}`, found ? 'green' : 'yellow');
      });
    } catch (err) {
      log(`   ${checkMark(false)} Error reading .env.local: ${err.message}`, 'red');
      return false;
    }
  } else {
    log(`   ${checkMark(false)} .env.local not found`, 'red');
    log(`   💡 Copy .env.example to .env.local and fill in values`, 'yellow');
    return false;
  }
  
  return allPresent;
}

// ============================================
// 5. Dependencies Check
// ============================================
function checkDependencies() {
  log('\n📚 Checking Dependencies...', 'cyan');
  
  try {
    const packageJson = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
    const nextVersion = packageJson.dependencies?.next || 'not found';
    
    log(`   Next.js: ${nextVersion}`, 'blue');
    
    if (nextVersion.includes('14.')) {
      log(`   ${checkMark(true)} Next.js 14 (compatible with Node 20.x)`, 'green');
      return true;
    } else if (nextVersion.includes('15.')) {
      log(`   ${checkMark(false)} Next.js 15 - may require Node 20.x or higher`, 'yellow');
      return true;
    } else {
      log(`   ${checkMark(false)} Next.js version not recognized: ${nextVersion}`, 'red');
      return false;
    }
  } catch (err) {
    log(`   ${checkMark(false)} Error reading package.json: ${err.message}`, 'red');
    return false;
  }
}

// ============================================
// 6. Build Artifact Check
// ============================================
function checkBuildArtifacts() {
  log('\n🏗️  Checking Build Artifacts...', 'cyan');
  
  const nextDir = join(ROOT, '.next');
  if (existsSync(nextDir)) {
    log(`   ${checkMark(true)} .next/ exists`, 'green');
    log(`   💡 Run "npm run clean:next" to clear build cache if issues persist`, 'yellow');
  } else {
    log(`   ℹ️  .next/ not found (clean slate)`, 'blue');
  }
  
  return true;
}

// ============================================
// Main Execution
// ============================================
function main() {
  log('═══════════════════════════════════════════════════════', 'cyan');
  log('🏥 UNBREAK ONE - Repository Health Check', 'cyan');
  log('═══════════════════════════════════════════════════════', 'cyan');
  
  const checks = [
    { name: 'Node Version', fn: checkNodeVersion },
    { name: 'File Structure', fn: checkFileStructure },
    { name: 'Hardcoded URLs', fn: checkHardcodedUrls },
    { name: 'Environment Variables', fn: checkEnvVars },
    { name: 'Dependencies', fn: checkDependencies },
    { name: 'Build Artifacts', fn: checkBuildArtifacts },
  ];
  
  const results = checks.map(check => ({
    name: check.name,
    passed: check.fn(),
  }));
  
  // Summary
  log('\n═══════════════════════════════════════════════════════', 'cyan');
  log('📊 Summary', 'cyan');
  log('═══════════════════════════════════════════════════════', 'cyan');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  
  results.forEach(result => {
    log(`   ${checkMark(result.passed)} ${result.name}`, result.passed ? 'green' : 'red');
  });
  
  log('');
  if (passed === total) {
    log(`✅ All checks passed (${passed}/${total})`, 'green');
    log('\n💡 Next steps:', 'cyan');
    log('   1. npm install (if node_modules missing)', 'blue');
    log('   2. npm run dev', 'blue');
    log('   3. Visit http://localhost:3000/shop\n', 'blue');
    process.exit(0);
  } else {
    log(`❌ ${total - passed} check(s) failed (${passed}/${total} passed)`, 'red');
    log('\n💡 Quick fixes:', 'cyan');
    log('   - Node version: nvm use 20', 'yellow');
    log('   - Missing .env.local: Copy .env.example', 'yellow');
    log('   - Build issues: npm run reinstall', 'yellow');
    log('   - Hardcoded URLs: Must be removed manually\n', 'yellow');
    process.exit(1);
  }
}

main();
