import fs from 'node:fs';
const blocked = new Set(Object.keys(JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url))).devDependencies));
export async function resolve(specifier, context, nextResolve) {
  const packageName = specifier.startsWith('@') ? specifier.split('/').slice(0, 2).join('/') : specifier.split('/')[0];
  if (blocked.has(packageName)) throw new Error(`Production attempted to load development dependency: ${packageName}`);
  return nextResolve(specifier, context);
}
