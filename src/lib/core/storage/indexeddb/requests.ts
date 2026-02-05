export const requestToPromise = async <T>(
  request: IDBRequest<T>
): Promise<T> => {
  // eslint-disable-next-line promise/avoid-new, compat/compat, sonarjs/prefer-immediate-return
  const result = await new Promise<T>((resolve, reject) => {
    request.addEventListener("success", () => {
      resolve(request.result);
    });
    request.addEventListener("error", () => {
      reject(new Error("IndexedDB request failed."));
    });
  });
  return result;
};

export const waitForTransaction = async (
  transaction: IDBTransaction
): Promise<void> => {
  // eslint-disable-next-line promise/avoid-new, compat/compat
  await new Promise<void>((resolve, reject) => {
    transaction.addEventListener("complete", () => {
      resolve();
    });
    transaction.addEventListener("abort", () => {
      reject(new Error("IndexedDB transaction aborted."));
    });
    transaction.addEventListener("error", () => {
      reject(new Error("IndexedDB transaction failed."));
    });
  });
};
