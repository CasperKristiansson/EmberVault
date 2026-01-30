export type DebouncedTask<TArguments extends unknown[]> = {
  schedule: (...argumentsList: TArguments) => void;
  flush: () => Promise<void>;
  cancel: () => void;
  pending: () => boolean;
};

export const createDebouncedTask = <TArguments extends unknown[]>(
  task: (...argumentsList: TArguments) => Promise<void> | void,
  delay: number
): DebouncedTask<TArguments> => {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  let pendingArguments: TArguments | null = null;

  const runTask = async (): Promise<void> => {
    if (!pendingArguments) {
      return;
    }
    const argumentsList = pendingArguments;
    pendingArguments = null;
    await task(...argumentsList);
  };

  const flush = async (): Promise<void> => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    await runTask();
  };

  const schedule = (...argumentsList: TArguments): void => {
    pendingArguments = argumentsList;
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      // eslint-disable-next-line no-void
      void flush();
    }, delay);
  };

  const cancel = (): void => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    pendingArguments = null;
  };

  const pending = (): boolean => Boolean(pendingArguments);

  return {
    schedule,
    flush,
    cancel,
    pending,
  };
};
