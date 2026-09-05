import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('website downloads preserve the audited V12 release bytes, including its manifest', () => {
  for (const name of ['results.json', 'leaderboard.json', 'leaderboard.html', 'process-monitoring.html', 'manifest.json']) {
    const release = readFileSync(new URL(`../results/v12/${name}`, import.meta.url));
    const website = readFileSync(new URL(`../../../public/eval-data/deep-research/v12/${name}`, import.meta.url));
    assert.deepEqual(website, release, `Website copy has drifted: ${name}`);
  }
});
