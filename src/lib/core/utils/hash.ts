const bufferToHex = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  const chunks: string[] = [];
  for (const byte of bytes) {
    chunks.push(byte.toString(16).padStart(2, "0"));
  }
  return chunks.join("");
};

const readBlobArrayBuffer = async (blob: Blob): Promise<ArrayBuffer> => {
  if (typeof blob.arrayBuffer === "function") {
    return blob.arrayBuffer();
  }
  if (typeof blob.text === "function") {
    const text = await blob.text();
    return new TextEncoder().encode(text).buffer;
  }
  if (typeof Response !== "undefined") {
    return new Response(blob).arrayBuffer();
  }
  throw new Error("Unsupported Blob implementation");
};

const resolveSubtleCrypto = (): SubtleCrypto => {
  type WebkitCrypto = Partial<Crypto> & { webkitSubtle?: SubtleCrypto };
  const cryptoReference: WebkitCrypto = globalThis.crypto;
  if (cryptoReference.subtle) {
    return cryptoReference.subtle;
  }
  if (cryptoReference.webkitSubtle) {
    return cryptoReference.webkitSubtle;
  }
  throw new Error("SubtleCrypto is not available.");
};

export const hashBlobSha256 = async (blob: Blob): Promise<string> => {
  const buffer = await readBlobArrayBuffer(blob);
  const digest = await resolveSubtleCrypto().digest("SHA-256", buffer);
  return bufferToHex(digest);
};
