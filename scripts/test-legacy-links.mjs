import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import test from 'node:test';

const source = readFileSync(new URL('../public/legacy-top100.js', import.meta.url), 'utf8');

function destination(path) {
  let result = null;
  runInNewContext(source, {
    URL,
    window: { location: {
      href: `https://dsheval.ai${path}`,
      replace: (value) => { result = value; },
    } },
  });
  return result;
}

test('old installation links preserve query parameters and section fragments', () => {
  assert.equal(destination('/?page=dsh&utm_source=npm#dsh-install'), '/top100/?page=dsh&utm_source=npm#dsh-install');
  assert.equal(destination('/?page=docs#docs'), '/top100/?page=docs#docs');
  assert.equal(destination('/#ranking'), '/top100/#ranking');
  assert.equal(destination('/?view=rising&category=coding#ranking'), '/top100/?view=rising&category=coding#ranking');
  assert.equal(destination('/?category=tools'), '/top100/?category=tools');
  assert.equal(destination('/#dsh-install'), '/top100/?page=dsh#dsh-install');
  assert.equal(destination('/#docs'), '/top100/?page=docs#docs');
});

test('new homepage, evaluation anchors and report links stay on DSH-Eval', () => {
  for (const path of ['/', '/#about', '/#main-content', '/?utm_source=github', '/results?category=coding', '/top100/?page=dsh#dsh']) {
    assert.equal(destination(path), null, path);
  }
});

test('obsolete embedded DSHEval entry becomes the main homepage without a loop', () => {
  assert.equal(destination('/?page=dsheval#dsheval'), '/');
  assert.equal(destination('/#dsheval'), '/');
  assert.equal(destination('/?utm_source=github&page=dsheval#dsheval'), '/?utm_source=github');
  assert.equal(destination('/'), null);
});
