import type { AssetMeta } from "../types";

export const toBlob = (value: unknown, meta?: AssetMeta): Blob => {
  const options = meta?.mime ? { type: meta.mime } : undefined;
  if (value instanceof Blob) {
    return value;
  }
  if (value instanceof ArrayBuffer) {
    return new Blob([value], options);
  }
  if (value instanceof Uint8Array) {
    const copied = new Uint8Array(value);
    return new Blob([copied.buffer], options);
  }
  if (typeof value === "string") {
    return new Blob([value], options);
  }
  return new Blob([String(value)], options);
};

export const toArrayBuffer = async (value: Blob): Promise<ArrayBuffer> => {
  if (typeof value.arrayBuffer === "function") {
    return value.arrayBuffer();
  }
  return new Response(value).arrayBuffer();
};
