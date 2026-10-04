# Works Image Crossfade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 220 ms, blank-free, latest-request-wins crossfade between photographs on the Works page.

**Architecture:** Put transition ordering and animation mechanics in a small dependency-injected browser module that can be tested with Node fakes. Integrate it with two stacked plate layers in `works.astro`; the inactive layer loads and decodes the requested image before both layers animate, while description plates keep their existing behavior.

**Tech Stack:** Astro 6, browser DOM and Web Animations API, JavaScript ES modules, Node test runner.

## Global Constraints

- Keep the current photograph fully visible until the incoming image has loaded and decoded.
- Use a 220 ms crossfade with no blank frame.
- The latest rapid navigation request wins.
- Preserve current navigation, description plates, captions, layout, and accessibility behavior.
- Honor `prefers-reduced-motion: reduce` with an immediate switch.
- Add no dependencies and no animation library.
- Preserve all pre-existing uncommitted workspace changes; never stage unrelated paths.

---

### Task 1: Testable latest-request crossfade primitive

**Files:**
- Create: `src/lib/image-crossfade.mjs`
- Create: `tests/image-crossfade.test.mjs`

**Interfaces:**
- Produces: `createLatestCrossfade({ prepare, transition, onError? })`
- Produces: controller methods `request(value): Promise<boolean>`, `cancel(): void`, and `whenIdle(): Promise<void>`
- Produces: `createAnnouncementState(initialValue)` with preview, commit, and rollback operations
- Produces: `waitForImage(image, signal)` and `crossfadeLayers({ outgoing, incoming, duration, reducedMotion, signal, onStart?, onAbort? }): Promise<boolean>`

- [ ] **Step 1: Write the failing controller tests**

Create `tests/image-crossfade.test.mjs`:

```js
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLatestCrossfade,
  crossfadeLayers,
} from '../src/lib/image-crossfade.mjs';

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

test('waits for preparation before starting the transition', async () => {
  const prepared = deferred();
  const transitions = [];
  const controller = createLatestCrossfade({
    prepare: async (value) => {
      await prepared.promise;
      return `${value}-ready`;
    },
    transition: async (ready, value) => {
      transitions.push([ready, value]);
      return true;
    },
  });

  controller.request('next');
  await Promise.resolve();
  assert.deepEqual(transitions, []);

  prepared.resolve();
  await controller.whenIdle();
  assert.deepEqual(transitions, [['next-ready', 'next']]);
});

test('discards a stale preparation when a newer request arrives', async () => {
  const preparations = new Map([
    ['second', deferred()],
    ['third', deferred()],
  ]);
  const transitions = [];
  const controller = createLatestCrossfade({
    prepare: async (value) => {
      await preparations.get(value).promise;
      return `${value}-ready`;
    },
    transition: async (_ready, value) => {
      transitions.push(value);
      return true;
    },
  });

  controller.request('second');
  controller.request('third');
  preparations.get('second').resolve();
  preparations.get('third').resolve();

  await controller.whenIdle();
  assert.deepEqual(transitions, ['third']);
});

test('reports a current load failure without transitioning', async () => {
  const errors = [];
  const controller = createLatestCrossfade({
    prepare: async () => {
      throw new Error('image failed');
    },
    transition: async () => {
      assert.fail('transition must not run after a failed preparation');
    },
    onError: (error, value) => errors.push([error.message, value]),
  });

  controller.request('broken');
  await controller.whenIdle();
  assert.deepEqual(errors, [['image failed', 'broken']]);
});

test('reduced motion clears transient inline opacity after switching', async () => {
  let animationCalls = 0;
  const outgoing = {
    style: { opacity: '1' },
    animate() {
      animationCalls += 1;
    },
  };
  const incoming = {
    style: { opacity: '0' },
    animate() {
      animationCalls += 1;
    },
  };

  const completed = await crossfadeLayers({
    outgoing,
    incoming,
    duration: 220,
    reducedMotion: true,
  });

  assert.equal(completed, true);
  assert.equal(animationCalls, 0);
  assert.equal(outgoing.style.opacity, '');
  assert.equal(incoming.style.opacity, '');
});

test('animates both layers for the requested duration and clears inline opacity on abort', async () => {
  const finished = deferred();
  const animations = [];
  function layer(opacity) {
    return {
      style: { opacity },
      animate(keyframes, options) {
        const animation = {
          keyframes,
          options,
          finished: finished.promise,
          cancel() {},
        };
        animations.push(animation);
        return animation;
      },
    };
  }
  const outgoing = layer('1');
  const incoming = layer('0');
  const abortController = new AbortController();

  const transition = crossfadeLayers({
    outgoing,
    incoming,
    duration: 220,
    signal: abortController.signal,
  });
  abortController.abort();
  finished.resolve();

  assert.equal(await transition, false);
  assert.equal(animations.length, 2);
  assert.equal(animations[0].options.duration, 220);
  assert.equal(animations[1].options.duration, 220);
  assert.equal(outgoing.style.opacity, '');
  assert.equal(incoming.style.opacity, '');
});
```

The focused suite also covers cached successful/failed decode, complete images
without decoded pixels, load-event decode success/rejection, explicit errors,
abort listener cleanup, active-transition supersession, and the B-abort /
C-prepare-failure announcement rollback sequence. It also verifies that a
completed animated crossfade cancels both animation objects for cleanup and
leaves both inline opacities empty.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/image-crossfade.test.mjs
```

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/lib/image-crossfade.mjs`.

- [ ] **Step 3: Implement the minimal controller and layer transition**

Create `src/lib/image-crossfade.mjs`:

```js
export function createLatestCrossfade({
  prepare,
  transition,
  onError = () => {},
}) {
  let sequence = 0;
  let current = null;
  let idleResolvers = [];

  function resolveIdle() {
    const resolvers = idleResolvers;
    idleResolvers = [];
    resolvers.forEach((resolve) => resolve());
  }

  function cancel() {
    sequence += 1;
    current?.controller.abort();
  }

  function request(value) {
    cancel();

    const id = sequence;
    const controller = new AbortController();
    const record = { id, controller, promise: null };
    current = record;

    record.promise = (async () => {
      try {
        const prepared = await prepare(value, controller.signal);
        if (controller.signal.aborted || id !== sequence) return false;
        const completed = await transition(prepared, value, controller.signal);
        if (controller.signal.aborted || id !== sequence) return false;
        return completed;
      } catch (error) {
        if (!controller.signal.aborted && id === sequence) {
          onError(error, value);
        }
        return false;
      } finally {
        if (current === record) {
          current = null;
          resolveIdle();
        }
      }
    })();

    return record.promise;
  }

  return {
    request,
    cancel,
    whenIdle() {
      if (!current) return Promise.resolve();
      return new Promise((resolve) => idleResolvers.push(resolve));
    },
  };
}

export function createAnnouncementState(initialValue = '') {
  let committed = initialValue;
  let value = initialValue;
  return {
    get committed() { return committed; },
    get value() { return value; },
    preview(nextValue) { value = nextValue; return value; },
    commit(nextValue = value) {
      committed = nextValue;
      value = nextValue;
      return value;
    },
    rollback() { value = committed; return value; },
  };
}

export function waitForImage(image, signal) {
  const failedToLoad = () => new Error(`Failed to load ${image.src}`);

  if (signal?.aborted) return Promise.resolve();
  if (image.complete) {
    if (image.naturalWidth <= 0) return Promise.reject(failedToLoad());
    return image.decode?.() ?? Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      image.removeEventListener('load', onLoad);
      image.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };
    const onLoad = () => {
      cleanup();
      Promise.resolve(image.decode?.()).then(resolve, reject);
    };
    const onError = () => {
      cleanup();
      reject(failedToLoad());
    };
    const onAbort = () => {
      cleanup();
      resolve();
    };
    image.addEventListener('load', onLoad, { once: true });
    image.addEventListener('error', onError, { once: true });
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

export async function crossfadeLayers({
  outgoing,
  incoming,
  duration = 220,
  reducedMotion = false,
  signal,
  onStart = () => {},
  onAbort = () => {},
}) {
  if (signal?.aborted) return false;
  onStart();

  if (reducedMotion) {
    outgoing.style.opacity = '0';
    incoming.style.opacity = '1';
    outgoing.style.opacity = '';
    incoming.style.opacity = '';
    return true;
  }

  const options = {
    duration,
    easing: 'ease',
    fill: 'forwards',
  };
  const outgoingAnimation = outgoing.animate(
    [{ opacity: 1 }, { opacity: 0 }],
    options,
  );
  const incomingAnimation = incoming.animate(
    [{ opacity: 0 }, { opacity: 1 }],
    options,
  );
  let aborted = false;
  const abort = () => {
    aborted = true;
    outgoingAnimation.cancel();
    incomingAnimation.cancel();
    onAbort();
    outgoing.style.opacity = '';
    incoming.style.opacity = '';
  };

  signal?.addEventListener('abort', abort, { once: true });
  await Promise.all([
    outgoingAnimation.finished.catch(() => {}),
    incomingAnimation.finished.catch(() => {}),
  ]);
  signal?.removeEventListener('abort', abort);

  if (aborted || signal?.aborted) {
    return false;
  }

  outgoingAnimation.cancel();
  incomingAnimation.cancel();
  outgoing.style.opacity = '';
  incoming.style.opacity = '';
  return true;
}
```

- [ ] **Step 4: Run the focused and existing tests**

Run:

```bash
node --test tests/image-crossfade.test.mjs
node --test tests/*.test.mjs
```

Expected: focused tests PASS; the complete existing suite also PASS.

- [ ] **Step 5: Leave the implementation unstaged**

Do not stage or commit while `src/pages/works.astro` overlaps user changes.
Use `git diff --check` and `git status --short` to verify the working tree.

Expected: the implementation remains unstaged in the existing user worktree.

---

### Task 2: Integrate two plate layers into the Works page

**Files:**
- Modify: `src/pages/works.astro:49-64`
- Modify: `src/pages/works.astro:167-228`
- Modify: `src/pages/works.astro:453-485`
- Modify: `src/pages/works.astro:756-760`
- Create: `tests/works-crossfade-integration.test.mjs`

**Interfaces:**
- Consumes: `createLatestCrossfade` and `crossfadeLayers` from `src/lib/image-crossfade.mjs`
- Produces: two `.plate-layer` elements with one active layer at any time
- Produces: inline `prepare(target, signal)` and `transition(prepared, target, signal)` controller adapters

- [ ] **Step 1: Write a failing integration contract test**

Create `tests/works-crossfade-integration.test.mjs`:

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('works page wires two plate layers to a 220 ms crossfade', () => {
  const source = readFileSync(
    new URL('../src/pages/works.astro', import.meta.url),
    'utf8',
  );

  assert.equal(source.match(/class="plate-layer/g)?.length, 2);
  assert.match(source, /createLatestCrossfade/);
  assert.match(source, /crossfadeLayers/);
  assert.match(source, /duration:\s*220/);
  assert.match(source, /prefers-reduced-motion:\s*reduce/);
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
node --test tests/works-crossfade-integration.test.mjs
```

Expected: FAIL because the current page has no `data-plate-layer` markup.

- [ ] **Step 3: Replace the single plate with two stacked layers**

In `src/pages/works.astro`, replace the existing `plateImg` and
`plateCaption` block with:

```astro
<div class="plate-layer is-active" data-plate-layer aria-hidden={String(firstHasDesc)}>
  <div class="plate-unit">
    <img
      src={works[0]?.photos[0]?.src}
      alt={`${works[0]?.shortTitle} — plate 1`}
    />
    <p class="plate-caption">{firstCaption}</p>
  </div>
</div>
<div class="plate-layer" data-plate-layer aria-hidden="true">
  <div class="plate-unit">
    <img src="" alt="" />
    <p class="plate-caption"></p>
  </div>
</div>
<p id="plateAnnouncement" class="sr-only" aria-live="polite" aria-atomic="true">{firstHasDesc ? '' : firstCaption}</p>
```

Keep the existing previous/next buttons immediately after these layers. Keep
the pre-existing polite live regions on the CN and ENG description asides; the
caption-announcer assertion targets this dedicated ID, not all live regions.

- [ ] **Step 4: Wire loading, latest-request ordering, metadata, and role swapping**

At the top of the processed page script, add:

```js
import {
  createAnnouncementState,
  createLatestCrossfade,
  crossfadeLayers,
  waitForImage,
} from '../lib/image-crossfade.mjs';
```

Replace the single-image references and image branch in `render()` with the
following structure:

```js
const plateLayers = Array.from(
  document.querySelectorAll<HTMLElement>('[data-plate-layer]'),
);
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const plateAnnouncement = document.getElementById('plateAnnouncement')!;
// This is client code: initialize only from rendered DOM, never frontmatter.
const captionAnnouncement = createAnnouncementState(plateAnnouncement.textContent ?? '');
let activeLayerIndex = 0;

function previewCaptionAnnouncement(caption) {
  plateAnnouncement.textContent = captionAnnouncement.preview(caption);
}
function commitCaptionAnnouncement(caption) {
  plateAnnouncement.textContent = captionAnnouncement.commit(caption);
}
function rollbackCaptionAnnouncement() {
  plateAnnouncement.textContent = captionAnnouncement.rollback();
}

function clearPlateOpacity() {
  plateLayers.forEach((layer) => { layer.style.opacity = ''; });
}
function restoreActiveLayerAccessibility() {
  plateLayers.forEach((layer, index) => {
    layer.setAttribute('aria-hidden', String(index !== activeLayerIndex));
  });
}
function activateIncomingLayer(incomingIndex) {
  const outgoing = plateLayers[activeLayerIndex];
  const incoming = plateLayers[incomingIndex];
  outgoing.setAttribute('aria-hidden', 'true');
  incoming.setAttribute('aria-hidden', 'false');
  outgoing.classList.remove('is-active');
  incoming.classList.add('is-active');
  activeLayerIndex = incomingIndex;
  clearPlateOpacity();
}

function plateTarget() {
  const work = works[currentSeries];
  const photo = work.photos[currentPhoto];
  return {
    series: currentSeries,
    photo: currentPhoto,
    src: photo.src,
    alt: `${work.title} — plate ${currentPhoto + 1}`,
    caption:
      photo.caption ||
      `${work.fullTitle} — ${String(currentPhoto + 1).padStart(2, '0')}`,
  };
}

const plateCrossfade = createLatestCrossfade({
  async prepare(target, signal) {
    const incomingIndex = 1 - activeLayerIndex;
    const layer = plateLayers[incomingIndex];
    const image = layer.querySelector('img') as HTMLImageElement;
    const caption = layer.querySelector('.plate-caption')!;
    layer.style.opacity = '0';
    image.src = target.src;
    image.alt = target.alt;
    caption.textContent = target.caption;
    await waitForImage(image, signal);
    return { incomingIndex };
  },
  async transition({ incomingIndex }, target, signal) {
    const outgoing = plateLayers[activeLayerIndex];
    const incoming = plateLayers[incomingIndex];
    const leavingDescription = stage.classList.contains('show-desc');

    if (leavingDescription) {
      activateIncomingLayer(incomingIndex);
      stage.classList.remove('show-desc');
      commitCaptionAnnouncement(target.caption);
      return true;
    }

    const completed = await crossfadeLayers({
      outgoing,
      incoming,
      duration: 220,
      reducedMotion: reducedMotion.matches,
      signal,
      onStart() {
        outgoing.setAttribute('aria-hidden', 'true');
        incoming.setAttribute('aria-hidden', 'false');
        previewCaptionAnnouncement(target.caption);
      },
      onAbort() {
        restoreActiveLayerAccessibility();
        rollbackCaptionAnnouncement();
      },
    });
    if (completed) {
      activateIncomingLayer(incomingIndex);
      commitCaptionAnnouncement(target.caption);
    }
    return completed;
  },
  onError(error) {
    clearPlateOpacity();
    rollbackCaptionAnnouncement();
    console.error(error);
  },
});
```

`waitForImage` is the shared exported helper: it waits for image load and
decode, propagates decode failures, and removes its listeners on error or
abort. Keep the existing description text updates and row `aria-pressed`
updates. In the photo branch call `plateCrossfade.request(plateTarget())`. In
the description branch call `plateCrossfade.cancel()`, add `show-desc`, hide
both layers from accessibility, and `commitCaptionAnnouncement('')`. Preview
only in `onStart`, commit only after activation, and synchronously roll back in
both `onAbort` and `onError`; visual captions must not have `aria-live`. The
`leavingDescription` branch prepares the target first and then removes
`show-desc`, so the old series image never becomes visible.

- [ ] **Step 5: Add stable stacking and reduced-motion CSS**

Replace the existing `.plate-box`, `.stage img`, `.stage img.is-hidden`, and
caption positioning rules with:

```css
.plate-box {
  position: relative;
  width: 45vw;
  height: 58svh;
}

.plate-layer {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.18s ease;
}

.plate-layer.is-active,
.plate-layer[aria-hidden='false'] {
  opacity: 1;
}

.stage.show-desc .plate-layer {
  opacity: 0 !important;
}

.plate-unit {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.plate-unit img {
  display: block;
  max-width: 45vw;
  max-height: 58svh;
  object-fit: contain;
}

.plate-caption {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin: 14px 0 0;
  font-size: 11px;
  line-height: 1.8;
  color: var(--muted);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .plate-layer,
  .plate-desc,
  .screensaver,
  .screensaver img {
    transition: none;
  }
}
```

Retain the existing `.step`, mobile sizing, overlay, and screensaver rules.

- [ ] **Step 6: Run tests and build**

Run:

```bash
node --test tests/*.test.mjs
pnpm build
git diff --check
```

Expected: all tests PASS, Astro build exits 0, and `git diff --check` is silent.

- [ ] **Step 7: Preserve the overlapping user edit**

Do not stage `src/pages/works.astro`, because it contained pre-existing
uncommitted work before this plan. Show the user the combined diff and leave
the integration unstaged unless they explicitly request a combined commit:

```bash
git diff -- src/pages/works.astro
git status --short
```

Expected: `src/pages/works.astro` remains modified and unstaged.

---

### Task 3: Browser verification

**Files:**
- Verify only: `src/pages/works.astro`

**Interfaces:**
- Consumes: running Astro development server at `http://localhost:4321/works`
- Produces: browser evidence that the requested interaction works

- [ ] **Step 1: Verify the server and exact route**

Run:

```bash
curl -fsS -o /dev/null -w '%{http_code}\n' http://localhost:4321/works
```

Expected: `200`.

- [ ] **Step 2: Verify the normal crossfade**

Open `http://localhost:4321/works`, close any overlay, and click the right half
of the plate once. Confirm frame-by-frame that the outgoing photo remains
visible while the incoming photo appears, with both opacities overlapping for
220 ms and no blank frame.

- [ ] **Step 3: Verify all navigation paths**

Check:

- right and left plate clicks;
- ArrowRight and ArrowLeft;
- three rapid next inputs, ending on the correct third target without an older
  image flashing back;
- a portrait-to-landscape transition;
- description plate to first photo and first photo back to description;
- thumbnail selection and series selection.

Expected: navigation state, URL hash, captions, and `aria-hidden` all match the
visible target.

- [ ] **Step 4: Verify reduced motion**

Emulate `prefers-reduced-motion: reduce`, reload `/works`, and navigate between
two photographs.

Expected: the target switches without Web Animations and without a blank frame.

- [ ] **Step 5: Final verification snapshot**

Run:

```bash
node --test tests/*.test.mjs
pnpm build
git diff --check
git status --short --branch
```

Expected: tests and build pass, diff check is silent, the Task 1 commit exists,
and all pre-existing workspace modifications remain present.
