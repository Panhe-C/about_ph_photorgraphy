import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createAnnouncementState,
  createLatestCrossfade,
  crossfadeLayers,
  waitForImage,
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

test('waitForImage resolves a successfully decoded cached image', async () => {
  let decodeCalls = 0;
  const image = {
    complete: true,
    naturalWidth: 1200,
    decode: async () => { decodeCalls += 1; },
  };

  await waitForImage(image, new AbortController().signal);
  assert.equal(decodeCalls, 1);
});

test('waitForImage propagates a cached image decode rejection', async () => {
  const image = {
    complete: true,
    naturalWidth: 1200,
    decode: async () => { throw new Error('cached decode failed'); },
  };

  await assert.rejects(
    waitForImage(image, new AbortController().signal),
    /cached decode failed/,
  );
});

test('waitForImage rejects a complete image without decoded pixels', async () => {
  const image = {
    complete: true,
    naturalWidth: 0,
    src: '/broken.jpg',
  };

  await assert.rejects(
    waitForImage(image, new AbortController().signal),
    /Failed to load \/broken.jpg/,
  );
});

function eventImage({ decode = async () => {} } = {}) {
  const listeners = new Map();
  return {
    complete: false,
    naturalWidth: 0,
    src: '/next.jpg',
    decode,
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    removeEventListener(type, listener) {
      if (listeners.get(type) === listener) listeners.delete(type);
    },
    dispatch(type) {
      listeners.get(type)?.();
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

test('waitForImage resolves after an image load event and decode', async () => {
  let decodeCalls = 0;
  const image = eventImage({
    decode: async () => { decodeCalls += 1; },
  });

  const ready = waitForImage(image, new AbortController().signal);
  image.dispatch('load');
  await ready;
  assert.equal(decodeCalls, 1);
  assert.equal(image.listenerCount(), 0);
});

test('waitForImage rejects when decode fails after a load event', async () => {
  const image = eventImage({
    decode: async () => {
      throw new Error('decode failed');
    },
  });

  const ready = waitForImage(image, new AbortController().signal);
  image.dispatch('load');
  await assert.rejects(
    ready,
    /decode failed/,
  );
  assert.equal(image.listenerCount(), 0);
});

test('waitForImage rejects on an explicit image error event', async () => {
  const image = eventImage();

  const ready = waitForImage(image, new AbortController().signal);
  image.dispatch('error');
  await assert.rejects(
    ready,
    /Failed to load \/next.jpg/,
  );
  assert.equal(image.listenerCount(), 0);
});

test('waitForImage settles and removes listeners when aborted during loading', async () => {
  let decodeCalls = 0;
  const image = eventImage({
    decode: async () => { decodeCalls += 1; },
  });
  const controller = new AbortController();

  const ready = waitForImage(image, controller.signal);
  controller.abort();
  await ready;

  assert.equal(decodeCalls, 0);
  assert.equal(image.listenerCount(), 0);
});

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

test('an aborted active transition cannot commit after a newer request', async () => {
  const started = deferred();
  const finishFirst = deferred();
  const finishSecond = deferred();
  const committed = [];
  const controller = createLatestCrossfade({
    prepare: async (value) => value,
    transition: async (value, _target, signal) => {
      if (value === 'first') {
        started.resolve();
        await finishFirst.promise;
      } else {
        await finishSecond.promise;
      }
      if (!signal.aborted) committed.push(value);
      return true;
    },
  });

  const first = controller.request('first');
  await started.promise;
  const second = controller.request('second');
  finishFirst.resolve();
  finishSecond.resolve();

  assert.equal(await first, false);
  assert.equal(await second, true);
  assert.deepEqual(committed, ['second']);
});

test('rolls an aborted preview back to active caption when its successor fails', async () => {
  const announcement = createAnnouncementState('A caption');
  const bStarted = deferred();
  const bFinished = deferred();
  const controller = createLatestCrossfade({
    prepare: async (value) => {
      if (value === 'C') throw new Error('C failed to prepare');
      return value;
    },
    transition: async (value, _target, signal) => {
      announcement.preview(`${value} caption`);
      signal.addEventListener('abort', () => announcement.rollback(), { once: true });
      bStarted.resolve();
      await bFinished.promise;
      if (!signal.aborted) announcement.commit(`${value} caption`);
      return true;
    },
    onError: () => announcement.rollback(),
  });

  const b = controller.request('B');
  await bStarted.promise;
  const c = controller.request('C');
  bFinished.resolve();

  assert.equal(await b, false);
  assert.equal(await c, false);
  assert.equal(announcement.value, 'A caption');
  assert.equal(announcement.committed, 'A caption');
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

test('cleans up completed animations and clears inline opacity', async () => {
  const finished = [deferred(), deferred()];
  const animations = [];
  function layer(opacity) {
    return {
      style: { opacity },
      animate() {
        const animation = {
          finished: finished[animations.length].promise,
          cancelled: false,
          cancel() { this.cancelled = true; },
        };
        animations.push(animation);
        return animation;
      },
    };
  }
  const outgoing = layer('1');
  const incoming = layer('0');

  const transition = crossfadeLayers({ outgoing, incoming, duration: 220 });
  finished.forEach(({ resolve }) => resolve());

  assert.equal(await transition, true);
  assert.equal(animations.length, 2);
  assert.deepEqual(animations.map((animation) => animation.cancelled), [true, true]);
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
