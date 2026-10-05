import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

// Build first to exercise the actual HTML a browser can paint before JS runs.
const builtHome = new URL('../dist/index.html', import.meta.url);
const buildAvailable = existsSync(builtHome);

function entryState(html) {
  const data = JSON.parse(html.match(/<script[^>]*id="worksData"[^>]*>([\s\S]*?)<\/script>/)[1]);
  const stage = html.match(/<div[^>]*class="stage[^\"]*"[^>]*>/)[0];
  const image = html.match(/class="plate-layer is-active"[\s\S]*?<img[^>]*>/)[0];
  return { data, stage, image };
}

test('every home project has the correct series in its first server-rendered frame', { skip: !buildAvailable }, () => {
  const home = readFileSync(builtHome, 'utf8');
  const { data } = entryState(readFileSync(new URL('../dist/works/index.html', import.meta.url), 'utf8'));
  for (let series = 0; series < data.length; series += 1) {
    assert.ok(home.includes(`href="/works/${series}"`), `Home links directly to series ${series}`);
    const html = readFileSync(new URL(`../dist/works/${series}/index.html`, import.meta.url), 'utf8');
    const { stage, image } = entryState(html);
    assert.ok(stage.includes(`data-initial-series="${series}"`));
    assert.equal(stage.includes('show-desc'), data[series].hasDesc);
    assert.ok(image.includes(`src="${data[series].photos[0].src}"`));
    assert.ok(image.includes(`alt="${data[series].title} — plate 1"`));
  }
});

test('the general Works entry still starts on the first series', { skip: !buildAvailable }, () => {
  const { stage } = entryState(readFileSync(new URL('../dist/works/index.html', import.meta.url), 'utf8'));
  assert.ok(stage.includes('data-initial-series="0"'));
});
