const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'App.tsx');
let source = fs.readFileSync(appPath, 'utf8');

if (!source.includes('// NOURA_V017_APPLIED')) {
  require('./run-v017.cjs');
  source = fs.readFileSync(appPath, 'utf8');
}

if (!source.includes('// NOURA_V018_APPLIED')) {
  require('./apply-v018.cjs');
} else {
  console.log('Noura v0.18 patch already applied.');
}
