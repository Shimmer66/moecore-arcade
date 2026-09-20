import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { parse } from '@vue/compiler-sfc';

const root = fileURLToPath(new URL('../', import.meta.url));
const packages = new Map();

for (const group of ['apps', 'games', 'packages']) {
  for (const entry of readdirSync(join(root, group), { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const directory = join(root, group, entry.name);
    const manifest = JSON.parse(readFileSync(join(directory, 'package.json'), 'utf8'));
    assert(manifest.name?.startsWith('@moecore/'), `${directory}: missing package name`);
    assert(!packages.has(manifest.name), `Duplicate package: ${manifest.name}`);
    assert.equal(manifest.private, true, `${manifest.name} must be private`);
    assert.equal(manifest.type, 'module', `${manifest.name} must use ESM`);
    for (const script of ['typecheck', 'lint']) {
      assert(manifest.scripts?.[script], `${manifest.name}: missing ${script} script`);
    }
    if (group !== 'apps') {
      assert(manifest.exports?.['.'], `${manifest.name}: missing public entry`);
      for (const target of Object.values(manifest.exports)) {
        assert.equal(typeof target, 'string', `${manifest.name}: use explicit source exports`);
        assert(target.startsWith('./'), `${manifest.name}: exports must be relative`);
        const location = resolve(directory, target);
        assert(isInside(directory, location), `${manifest.name}: export escapes package`);
        assert(existsSync(location), `${manifest.name}: missing export ${target}`);
      }
    }
    packages.set(manifest.name, { directory, manifest, group });
  }
}

function isInside(directory, target) {
  const path = relative(directory, target);
  return path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path);
}

function* sourceFiles(directory) {
  if (!existsSync(directory)) return;
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const location = join(directory, entry.name);
    if (entry.isDirectory()) yield* sourceFiles(location);
    else if (['.ts', '.vue'].includes(extname(entry.name))) yield location;
  }
}

for (const [name, pkg] of packages) {
  const dependencies = {
    ...pkg.manifest.dependencies,
    ...pkg.manifest.devDependencies,
    ...pkg.manifest.peerDependencies,
  };
  for (const [dependency, version] of Object.entries(dependencies)) {
    if (!dependency.startsWith('@moecore/')) continue;
    const target = packages.get(dependency);
    assert(target, `${name}: unknown workspace dependency ${dependency}`);
    assert.equal(version, 'workspace:*', `${name}: ${dependency} must use workspace:*`);
    assert.notEqual(name, dependency, `${name}: self dependency`);
    if (pkg.group !== 'apps') {
      assert.equal(target.group, 'packages', `${name}: invalid dependency on ${dependency}`);
    }
  }

  for (const file of sourceFiles(join(pkg.directory, 'src'))) {
    let code = readFileSync(file, 'utf8');
    if (extname(file) === '.vue') {
      const { descriptor, errors } = parse(code, { filename: file });
      assert.equal(errors.length, 0, `${file}: invalid Vue component`);
      assert(!descriptor.script?.src, `${file}: keep component scripts inside the SFC`);
      code = [descriptor.script?.content, descriptor.scriptSetup?.content]
        .filter(Boolean)
        .join('\n');
    }
    const source = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);
    function visit(node) {
      let specifier;
      if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
        specifier = node.moduleSpecifier;
      } else if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword
      ) {
        specifier = node.arguments[0];
      }
      if (specifier && ts.isStringLiteralLike(specifier)) {
        const value = specifier.text;
        if (value.startsWith('.')) {
          assert(
            isInside(pkg.directory, resolve(dirname(file), value)),
            `${file}: cross-package relative import ${value}`,
          );
        } else if (value.startsWith('@moecore/')) {
          const dependency = value.split('/').slice(0, 2).join('/');
          assert(
            pkg.manifest.dependencies?.[dependency] === 'workspace:*',
            `${file}: declare ${dependency} in dependencies`,
          );
          const target = packages.get(dependency);
          assert(target, `${file}: unknown package ${dependency}`);
          const subpath = `.${value.slice(dependency.length)}`;
          assert(target.manifest.exports?.[subpath], `${file}: non-public import ${value}`);
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
}

// Walk declared internal dependencies so unused dependency edges are checked too.
const visited = new Set();
const active = new Set();
function checkCycle(name) {
  assert(!active.has(name), `Circular workspace dependency: ${name}`);
  if (visited.has(name)) return;
  active.add(name);
  const manifest = packages.get(name).manifest;
  const dependencies = {
    ...manifest.dependencies,
    ...manifest.devDependencies,
    ...manifest.peerDependencies,
  };
  for (const dependency of Object.keys(dependencies)) {
    if (packages.has(dependency)) checkCycle(dependency);
  }
  active.delete(name);
  visited.add(name);
}
for (const name of packages.keys()) checkCycle(name);

console.log(
  `Workspace verified: ${packages.size} packages, public exports and dependency boundaries.`,
);
