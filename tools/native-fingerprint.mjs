// LT-608: a fingerprint of what the native app is made of - Capacitor and its
// native plugins at the versions the lockfile resolved, capacitor.config.ts,
// and the native projects' own code and settings (version numbers left out).
// The dashboard bundle carries the fingerprint it was built with; an app
// takes an over-the-air bundle only when the bundle's fingerprint equals its
// own, so a bundle that needs a native change never reaches an app without it.
// Used by vite.config.ts (baked into the bundle) and deploy.sh (published with it).
import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const NATIVE_PACKAGE = /^(@capacitor\/(?!cli$)|@capacitor-firebase\/|@capawesome\/|@revenuecat\/)/;

/** Native files that decide what the JavaScript may call, with each one's version lines dropped. */
const NATIVE_FILES = [
  { file: 'capacitor.config.ts' },
  { file: 'android/variables.gradle' },
  { file: 'android/build.gradle' },
  { file: 'android/app/build.gradle', drop: /^\s*(versionCode|versionName)\b/ },
  { file: 'android/app/src/main/AndroidManifest.xml' },
  { dir: 'android/app/src/main/java', ext: /\.(java|kt)$/ },
  { dir: 'ios/App/App', ext: /\.(swift|plist|entitlements)$/, skip: /^(public|GoogleService-Info\.plist|capacitor\.config\.json|config\.xml)$/ },
  { file: 'ios/App/App.xcodeproj/project.pbxproj', drop: /\b(MARKETING_VERSION|CURRENT_PROJECT_VERSION)\b/ },
];

const walk = (root, dir, ext, skip) => {
  const full = path.join(root, dir);
  if (!fs.existsSync(full)) return [];
  return fs.readdirSync(full, { withFileTypes: true })
    .filter((e) => !(skip && skip.test(e.name)))
    .flatMap((e) => (e.isDirectory() ? walk(root, path.join(dir, e.name), ext, skip) : ext.test(e.name) ? [path.join(dir, e.name)] : []))
    .sort();
};

export const nativeFingerprint = (root) => {
  const hash = createHash('sha256');
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  const packages = Object.entries(lock.packages ?? {})
    .map(([key, value]) => [key.replace(/^node_modules\//, ''), value.version])
    .filter(([name]) => !name.includes('node_modules/') && NATIVE_PACKAGE.test(name))
    .sort(([a], [b]) => a.localeCompare(b));
  hash.update(JSON.stringify(packages));
  for (const entry of NATIVE_FILES) {
    const files = entry.file ? [entry.file] : walk(root, entry.dir, entry.ext, entry.skip);
    for (const file of files) {
      const full = path.join(root, file);
      if (!fs.existsSync(full)) continue;
      let text = fs.readFileSync(full, 'utf8').replace(/\r\n/g, '\n');
      if (entry.drop) text = text.split('\n').filter((line) => !entry.drop.test(line)).join('\n');
      hash.update(`\n--- ${file.split(path.sep).join('/')}\n${text}`);
    }
  }
  return hash.digest('hex').slice(0, 16);
};

// `node tools/native-fingerprint.mjs` prints this checkout's fingerprint.
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  console.log(nativeFingerprint(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')));
}
