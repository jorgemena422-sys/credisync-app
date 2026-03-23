import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const templatePath = path.join(rootDir, 'public', 'sw-template.js');
const outputPath = path.join(rootDir, 'public', 'sw.js');
const buildVersion = `${new Date().toISOString().replace(/[-:.TZ]/g, '')}-${Math.random().toString(36).slice(2, 8)}`;

const template = fs.readFileSync(templatePath, 'utf8');

if (!template.includes('__SW_VERSION__')) {
  throw new Error('Service worker template is missing the __SW_VERSION__ placeholder.');
}

fs.writeFileSync(outputPath, template.replace(/__SW_VERSION__/g, buildVersion), 'utf8');

console.log(`[generate-sw] Generated public/sw.js (${buildVersion})`);
