/**
 * Generate build-info.json with Git commit hash and build timestamp
 * Run at build time to capture deployment metadata
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function getBuildInfo() {
  let gitSha = 'unknown';
  let gitShort = 'unknown';
  
  try {
    gitSha = execSync('git rev-parse HEAD').toString().trim();
    gitShort = execSync('git rev-parse --short HEAD').toString().trim();
  } catch (err) {
    console.warn('⚠️ Could not get git commit hash:', err.message);
  }

  const buildInfo = {
    gitSha,
    gitShort,
    buildTime: new Date().toISOString(),
    buildTimestamp: Date.now(),
  };

  const outputPath = path.join(__dirname, '..', 'public', 'build-info.json');
  fs.writeFileSync(outputPath, JSON.stringify(buildInfo, null, 2));

  console.log('✅ Build info generated:', buildInfo);
  return buildInfo;
}

getBuildInfo();
