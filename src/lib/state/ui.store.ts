import { derived, get, writable } from "svelte/store";

export type ModalType =
  | "global-search"
  | "command-palette"
  | "note-switcher"
  | "template-picker"
  | "confirm"
  | "image-lightbox";

export type ModalEntry = {
  id: string;
  type: ModalType;
  data?: unknown;
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
