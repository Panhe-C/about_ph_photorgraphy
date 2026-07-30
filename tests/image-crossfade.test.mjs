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

test('reduced motion switches layer opacity without animation', async () => {
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
  assert.equal(outgoing.style.opacity, '0');
  assert.equal(incoming.style.opacity, '1');
});

test('animates both layers for the requested duration and restores on abort', async () => {
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
  assert.equal(outgoing.style.opacity, '1');
  assert.equal(incoming.style.opacity, '0');
});
