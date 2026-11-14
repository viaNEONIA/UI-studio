import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { Script } from 'node:vm';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const baseline = readFileSync(new URL('../docs/v0.6.sha256', import.meta.url), 'utf8').trim();

test('HTML document has core structure', () => {
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /<html[^>]*lang="ja"/i);
  assert.match(html, /<title>.*UI Studio/i);
});

test('inline JavaScript parses', () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.ok(scripts.length > 0, 'inline scripts must exist');
  for (const [, code] of scripts) new Script(code);
});

test('v0.6 source matches archived baseline', () => {
  const digest = createHash('sha256').update(readFileSync(new URL('fixtures/v0.6.html', import.meta.url))).digest('hex');
  assert.equal(digest, baseline);
});

test('meeting editor JavaScript parses', () => {
  new Script(readFileSync(new URL('../src/meeting-editor.js', import.meta.url), 'utf8'));
});
