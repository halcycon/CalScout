/* SPDX-License-Identifier: MPL-2.0 */
import { readdir, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await check(path);
    else if (/\.(mjs|js)$/.test(path)) {
      const result = spawnSync(process.execPath, ['--check', path], { stdio: 'inherit' });
      if (result.status !== 0) process.exit(result.status || 1);
    } else if (path.endsWith('.json')) JSON.parse(await readFile(path, 'utf8'));
  }
}
await check('src');
console.log('Source syntax and JSON checks passed.');
