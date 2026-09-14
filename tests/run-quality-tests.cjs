const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const out = path.join(root, '.quality-test-build');
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const args = [
  'tsc',
  'tests/external-stubs.d.ts', 'src/types.ts', 'src/foodGroups.ts', 'src/onboarding.ts', 'src/analysis.ts', 'src/medicalSafety.ts', 'src/weeklyReview.ts',
  'tests/analysisSelfTest.ts', 'tests/qualitySelfTest.ts',
  '--target','ES2022','--module','commonjs','--moduleResolution','node','--outDir', out,'--skipLibCheck','--strict'
];
execFileSync(npx, args, { cwd: root, stdio:'inherit' });
execFileSync(process.execPath, [path.join(out,'tests','analysisSelfTest.js')], { cwd:root, stdio:'inherit' });
execFileSync(process.execPath, [path.join(out,'tests','qualitySelfTest.js')], { cwd:root, stdio:'inherit' });
fs.rmSync(out, { recursive: true, force: true });
