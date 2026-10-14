import { readFileSync, writeFileSync } from 'node:fs';
const app = JSON.parse(readFileSync('app.json', 'utf8'));
delete app.expo.splash;
app.expo.icon = './assets/icon.png';
app.expo.web.favicon = './assets/icon.png';
app.expo.plugins = app.expo.plugins.filter(
  (x) => (Array.isArray(x) ? x[0] : x) !== 'expo-splash-screen',
);
app.expo.plugins.push([
  'expo-splash-screen',
  { image: './assets/splash.png', imageWidth: 160, backgroundColor: '#F5F4EE' },
]);
writeFileSync('app.json', JSON.stringify(app, null, 2) + '\n');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
for (const group of ['dependencies', 'devDependencies'])
  for (const name of Object.keys(pkg[group] ?? {}))
    pkg[group][name] = JSON.parse(
      readFileSync(`node_modules/${name}/package.json`, 'utf8'),
    ).version;
pkg.scripts['build:ios'] = 'expo export --platform ios --output-dir dist-ios';
pkg.scripts['test:ui'] = 'playwright test';
writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
