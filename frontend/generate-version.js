import fs from 'fs';
import { execSync } from 'child_process';

// Generate a unique build ID based on the current timestamp
const buildId = Date.now().toString();

// 1. Write the BUILD_ID to the src/version.js file so the frontend bundle knows its local version
fs.writeFileSync('src/version.js', `export const BUILD_ID = "${buildId}";\n`);
console.log(`[Version Generator] Created src/version.js with BUILD_ID: ${buildId}`);

// 2. Execute the actual Vite build
try {
  console.log('[Version Generator] Running vite build...');
  // Use npx to run vite build directly
  execSync('npx vite build', { stdio: 'inherit' });
} catch (error) {
  console.error('[Version Generator] Vite build failed:', error);
  process.exit(1);
}

// 3. Write the matching build ID to dist/version.json so the deployed server serves the latest version
fs.writeFileSync('dist/version.json', JSON.stringify({ version: buildId }, null, 2));
console.log(`[Version Generator] Created dist/version.json with version: ${buildId}`);
