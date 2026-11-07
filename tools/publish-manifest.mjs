// LT-608: the apps' update manifest with this deploy's bundle added (deploy.sh).
//   node tools/publish-manifest.mjs <old manifest> <app-updates.json> <out>
// with ID, FP, SUM, SIG, BUILT and BASE in the environment. Keeps the last 20
// bundles; the minimum native builds come from the repo's app-updates.json.
import fs from 'fs';

const [oldFile, configFile, outFile] = process.argv.slice(2);
const text = fs.existsSync(oldFile) ? fs.readFileSync(oldFile, 'utf8').trim() : '';
const old = text ? JSON.parse(text) : {};
const { minBuild } = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const { ID, FP, SUM, SIG, BUILT, BASE } = process.env;
for (const [name, value] of Object.entries({ ID, FP, SUM, SIG, BUILT, BASE })) {
  if (!value) throw new Error(`${name} is missing`);
}
const bundles = (old.bundles ?? [])
  .filter((b) => b.id !== ID)
  .concat({ id: ID, fingerprint: FP, url: `${BASE}/${ID}.zip`, checksum: SUM, signature: SIG, builtAt: BUILT })
  .slice(-20);
fs.writeFileSync(outFile, `${JSON.stringify({ minBuild, bundles }, null, 2)}\n`);
console.log(`manifest: ${bundles.length} bundles, minimum builds ${JSON.stringify(minBuild)}`);
