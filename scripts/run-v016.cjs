const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'apply-v016.cjs');
const tempPath = path.join(__dirname, '.apply-v016.runtime.cjs');
let code = fs.readFileSync(sourcePath, 'utf8');

// Remove an obsolete guard from the first draft of the transform. Keeping this
// in the runner makes existing checkouts self-healing and keeps the actual
// application transform idempotent.
code = code.replace(/replaceOnce\(\n  "import \* as Linking from '\.\/src\/shortcuts';",[\s\S]*?'noop guard'\n\);\n\n/, '');

fs.writeFileSync(tempPath, code, 'utf8');
try {
  require(tempPath);
} finally {
  try { fs.unlinkSync(tempPath); } catch {}
}
