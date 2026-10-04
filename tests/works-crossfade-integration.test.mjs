import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

function processedClientScript(source) {
  const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  return scripts.at(-1)?.[1] ?? '';
}

test('works page wires two plate layers to a 220 ms crossfade', () => {
  const source = readFileSync(
    new URL('../src/pages/works.astro', import.meta.url),
    'utf8',
  );

  assert.equal(source.match(/class="plate-layer/g)?.length, 2);
  assert.equal(source.match(/id="plateAnnouncement"/g)?.length, 1);
  assert.match(source, /id="plateAnnouncement" class="sr-only" aria-live="polite" aria-atomic="true">\{firstHasDesc \? '' : firstCaption\}/);
  assert.equal(source.match(/<p class="plate-caption"[^>]*aria-live=/g)?.length ?? 0, 0);
  assert.match(source, /id="plateDescCn"\s+aria-live="polite"/);
  assert.match(source, /id="plateDescEng"\s+aria-live="polite"/);
  assert.match(source, /createLatestCrossfade/);
  assert.match(source, /crossfadeLayers/);
  assert.match(source, /waitForImage/);
  assert.match(source, /await waitForImage\(image, signal\)/);
  assert.match(source, /const plateAnnouncement = document\.getElementById\('plateAnnouncement'\)!/);
  assert.match(source, /previewCaptionAnnouncement\(target\.caption\)/);
  assert.match(source, /commitCaptionAnnouncement\(target\.caption\)/);
  assert.match(source, /commitCaptionAnnouncement\(''\)/);
  assert.match(source, /const plateCrossfade = createLatestCrossfade/);
  assert.match(source, /plateCrossfade\.request\(plateTarget\(\)\)/);
  assert.match(source, /onStart\(\)\s*\{[\s\S]*previewCaptionAnnouncement\(target\.caption\)/);
  assert.match(source, /onAbort\(\)\s*\{[\s\S]*rollbackCaptionAnnouncement\(\)/);
  assert.match(source, /onError\(error\)\s*\{[\s\S]*rollbackCaptionAnnouncement\(\)/);
  assert.match(source, /duration:\s*220/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);

  const clientScript = processedClientScript(source);
  assert.doesNotMatch(clientScript, /\bfirstHasDesc\b/);
  assert.doesNotMatch(clientScript, /\bfirstCaption\b/);
  assert.match(
    clientScript,
    /createAnnouncementState\(plateAnnouncement\.textContent \?\? ''\)/,
  );
});
