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
    get committed() {
      return committed;
    },
    get value() {
      return value;
    },
    preview(nextValue) {
      value = nextValue;
      return value;
    },
    commit(nextValue = value) {
      committed = nextValue;
      value = nextValue;
      return value;
    },
    rollback() {
      value = committed;
      return value;
    },
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
