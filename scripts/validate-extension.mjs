import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const root = process.cwd();
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));

assert.equal(manifest.manifest_version, 3, 'manifest_version must be 3');
assert.match(manifest.version, /^\d+(\.\d+){0,3}$/, 'version must use Chrome extension version format');
assert.ok(manifest.name && manifest.name.length <= 75, 'name is required and must fit Chrome Web Store limits');
assert.ok(manifest.description && manifest.description.length <= 132, 'description is required and must be 132 chars or fewer');
assert.equal(manifest.permissions, undefined, 'do not declare extension permissions unless they are needed');
assert.equal(manifest.host_permissions, undefined, 'content script matches are enough for this extension');

for (const size of ['16', '32', '48', '128']) {
  assert.equal(manifest.icons?.[size], `icons/icon-${size}.png`, `missing ${size}px manifest icon`);
  await access(join(root, manifest.icons[size]));
}

for (const script of manifest.content_scripts ?? []) {
  for (const file of [...(script.js ?? []), ...(script.css ?? [])]) {
    await access(join(root, file));
  }
}

