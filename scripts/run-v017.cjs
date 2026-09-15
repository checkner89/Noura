const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, '..', 'App.tsx');
let source = fs.readFileSync(appPath, 'utf8');

if (!source.includes('// NOURA_V016_APPLIED')) {
  require('./run-v016.cjs');
  source = fs.readFileSync(appPath, 'utf8');
}

if (!source.includes('// NOURA_V017_APPLIED')) {
  require('./apply-v017.cjs');
} else {
  console.log('Noura v0.17 patch already applied.');
}
