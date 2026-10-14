import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = new URL('../assets/', import.meta.url);
mkdirSync(root, { recursive: true });
const mark = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="#244E3D"/><path d="M720 205 C740 268 739 300 713 340 C668 318 654 275 660 226 C685 246 702 268 713 291 C715 258 716 231 720 205Z" fill="#D6AE76"/><path d="M743 335 C797 344 825 369 836 411 C781 418 751 393 743 335Z" fill="#D6AE76"/><path d="M649 285 C600 298 577 328 580 371 C632 370 654 337 649 285Z" fill="#D6AE76"/><text x="493" y="672" text-anchor="middle" font-family="Georgia,serif" font-size="375" font-weight="bold" letter-spacing="-15" fill="#F5F4EE">PA</text><path d="M295 747 H730" stroke="#D6AE76" stroke-width="13" stroke-linecap="round"/></svg>`;
writeFileSync(new URL('icon.svg', root), mark);
await sharp(Buffer.from(mark))
  .png()
  .toFile(fileURLToPath(new URL('icon.png', root)));
await sharp(Buffer.from(mark))
  .resize(256)
  .png()
  .toFile(fileURLToPath(new URL('splash.png', root)));
