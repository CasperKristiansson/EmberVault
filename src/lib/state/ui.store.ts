import { derived, get, writable } from "svelte/store";

export type ModalType =
  | "global-search"
  | "command-palette"
  | "note-switcher"
  | "trash"
  | "confirm"
  | "image-lightbox";

export type ModalEntry = {
  id: string;
  type: ModalType;
  data?: unknown;
};

export type ToastTone = "info" | "success" | "error";

export type ToastEntry = {
  id: string;
  message: string;
  tone: ToastTone;
  durationMs: number;
};

const createModalId = (): string => {
  const cryptoInstance =
    typeof globalThis === "undefined" ? undefined : globalThis.crypto;
  if (cryptoInstance?.randomUUID) {
    return cryptoInstance.randomUUID();
  }
  if (cryptoInstance?.getRandomValues) {
    const bytes = new Uint8Array(8);
    cryptoInstance.getRandomValues(bytes);
    let token = "";
    for (const byte of bytes) {
      token += byte.toString(16).padStart(2, "0");
    }
    return `modal-${Date.now()}-${token}`;
  }
  return `modal-${Date.now()}-0`;
};

const modalStack = writable<ModalEntry[]>([]);
const toastQueue = writable<ToastEntry[]>([]);

const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

const resolveActiveModal = function resolveActiveModal(
  stack: ModalEntry[]
): ModalEntry | null {
  if (stack.length === 0) {
    return null;
  }
  return stack.at(-1) ?? null;
};

export const modalStackStore = {
  subscribe: modalStack.subscribe,
};

export const activeModal = derived(modalStack, resolveActiveModal);

export const toastStore = {
  subscribe: toastQueue.subscribe,
};

export const openModal = (type: ModalType, data?: unknown): string => {
  const id = createModalId();
  const stack = get(modalStack);
  modalStack.set([...stack, { id, type, data }]);
  return id;
};

export const closeModal = (id?: string): void => {
  const stack = get(modalStack);
  if (!id) {
    modalStack.set(stack.slice(0, -1));
    return;
  }
  const nextStack: ModalEntry[] = [];
  for (const entry of stack) {
    if (entry.id !== id) {
      nextStack.push(entry);
    }
  }
  modalStack.set(nextStack);
};

export const closeTopModal = (): void => {
  const stack = get(modalStack);
  modalStack.set(stack.slice(0, -1));
};

const createToastId = (): string => {
  const cryptoInstance =
    typeof globalThis === "undefined" ? undefined : globalThis.crypto;
  if (cryptoInstance?.randomUUID) {
    return cryptoInstance.randomUUID();
  }
  if (cryptoInstance?.getRandomValues) {
    const bytes = new Uint8Array(8);
    cryptoInstance.getRandomValues(bytes);
    let token = "";
    for (const byte of bytes) {
      token += byte.toString(16).padStart(2, "0");
    }
    return `toast-${Date.now()}-${token}`;
  }
  return `toast-${Date.now()}-0`;
};

const clearToastTimer = (toastId: string): void => {
  const timer = toastTimers.get(toastId);
  if (timer) {
    clearTimeout(timer);
    toastTimers.delete(toastId);
  }
};

const removeToastById = (toastId: string): void => {
  /* eslint-disable sonarjs/arrow-function-convention */
  toastQueue.update((queue) => queue.filter((toast) => toast.id !== toastId));
  /* eslint-enable sonarjs/arrow-function-convention */
  clearToastTimer(toastId);
};

export const dismissToast = (toastId: string): void => {
  removeToastById(toastId);
};

export const clearToasts = (): void => {
  const queue = get(toastQueue);
  for (const toast of queue) {
    clearToastTimer(toast.id);
  }
  toastQueue.set([]);
};

export const pushToast = (
  message: string,
  {
    tone = "info",
    durationMs = 2600,
  }: Partial<Pick<ToastEntry, "tone" | "durationMs">> = {}
): string => {
  const id = createToastId();
  const entry: ToastEntry = {
    id,
    message,
    tone,
    durationMs,
  };
  /* eslint-disable sonarjs/arrow-function-convention */
  toastQueue.update((queue) => {
    const nextQueue = [...queue, entry];
    if (nextQueue.length <= 2) {
      return nextQueue;
    }
    const [removed] = nextQueue;
    clearToastTimer(removed.id);
    return nextQueue.slice(-2);
  });
  /* eslint-enable sonarjs/arrow-function-convention */
  if (durationMs > 0) {
    const timer = setTimeout(() => {
      removeToastById(id);
    }, durationMs);
    toastTimers.set(id, timer);
  }
  return id;
};
