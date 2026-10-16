// Fails when the built bundle exceeds the 2 MB budget from the spec.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const LIMIT = 2 * 1024 * 1024;
function total(dir) {
  return readdirSync(dir).reduce((sum, name) => {
    const p = join(dir, name);
    const s = statSync(p);
    return sum + (s.isDirectory() ? total(p) : s.size);
  }, 0);
}
const size = total('dist');
console.log(`Bundle: ${(size / 1024).toFixed(1)} KB / ${(LIMIT / 1024).toFixed(0)} KB`);
if (size > LIMIT) {
  console.error('Bundle over budget');
  process.exit(1);
}
