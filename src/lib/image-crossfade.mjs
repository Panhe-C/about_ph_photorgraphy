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
        return await transition(prepared, value, controller.signal);
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

export async function crossfadeLayers({
  outgoing,
  incoming,
  duration = 220,
  reducedMotion = false,
  signal,
  onStart = () => {},
}) {
  if (signal?.aborted) return false;
  onStart();

  if (reducedMotion) {
    outgoing.style.opacity = '0';
    incoming.style.opacity = '1';
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
  };

  signal?.addEventListener('abort', abort, { once: true });
  await Promise.all([
    outgoingAnimation.finished.catch(() => {}),
    incomingAnimation.finished.catch(() => {}),
  ]);
  signal?.removeEventListener('abort', abort);

  if (aborted || signal?.aborted) {
    outgoing.style.opacity = '1';
    incoming.style.opacity = '0';
    return false;
  }

  outgoing.style.opacity = '0';
  incoming.style.opacity = '1';
  outgoingAnimation.cancel();
  incomingAnimation.cancel();
  return true;
}
