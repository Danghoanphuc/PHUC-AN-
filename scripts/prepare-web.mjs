import { cpSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Pages ignores node_modules even inside Expo's exported assets directory.
// Keep Expo's hashed bundle intact and serve those URLs via public/_redirects.
const source = resolve('dist/assets/node_modules');
const destination = resolve('dist/assets/vendor');
if (existsSync(source)) cpSync(source, destination, { recursive: true });

const htmlPath = resolve('dist/index.html');
const html = readFileSync(htmlPath, 'utf8').replace('<html lang="en">', '<html lang="vi">');
writeFileSync(htmlPath, html);
