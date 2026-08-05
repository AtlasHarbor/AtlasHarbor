import {readdir} from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const roots = ['src', 'public', 'scripts', 'test'];
const ignoredDirectories = new Set(['node_modules', '.git', 'coverage']);

async function collect(directory) {
  let entries;
  try {
    entries = await readdir(directory, {withFileTypes: true});
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }

  const files = [];
  for (const entry of entries) {
    if (entry.name.startsWith('.') || ignoredDirectories.has(entry.name)) continue;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(target)));
    else if (entry.isFile() && entry.name.endsWith('.js')) files.push(target);
  }
  return files;
}

const files = (await Promise.all(roots.map(collect))).flat().sort();
let failures = 0;

for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], {
    encoding: 'utf8'
  });
  if (result.status === 0) continue;
  failures += 1;
  process.stderr.write(`\nJavaScript syntax check failed: ${file}\n`);
  process.stderr.write(result.stderr || result.stdout || 'Unknown parser error.\n');
}

if (failures) {
  process.stderr.write(`\n${failures} JavaScript file${failures === 1 ? '' : 's'} failed syntax validation.\n`);
  process.exit(1);
}

console.log(`JavaScript syntax check passed for ${files.length} files.`);
