const encoding = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const timeLength = 10;
const randomLength = 16;

const encodeTime = (timestamp: number): string => {
  let value = timestamp;
  let output = "";

  for (let index = 0; index < timeLength; index += 1) {
    const characterIndex = value % 32;
    output = `${encoding[characterIndex] ?? ""}${output}`;
    value = Math.floor(value / 32);
  }

  return output;
};

const encodeRandom = (randomBytes: Uint8Array): string => {
  let value = 0n;
  let output = "";

  for (const byte of randomBytes) {
    value = value * 256n + BigInt(byte);
  }

  for (let index = 0; index < randomLength; index += 1) {
    const characterIndex = Number(value % 32n);
    output = `${encoding[characterIndex] ?? ""}${output}`;
    value /= 32n;
  }

  return output;
};

export const createUlid = (): string => {
  const timestamp = Date.now();
  const randomBytes = new Uint8Array(10);
  globalThis.crypto.getRandomValues(randomBytes);

  const timePart = encodeTime(timestamp);
  const randomPart = encodeRandom(randomBytes);

  return `${timePart}${randomPart}`;
};
