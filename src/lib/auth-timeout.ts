export class AuthTimeoutError extends Error {
  constructor(operation: string) {
    super(`${operation}_timeout`);
    this.name = "AuthTimeoutError";
  }
}

export async function withAuthTimeout<T>(
  operation: string,
  promise: PromiseLike<T>,
  timeoutMs = 15_000,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve(promise),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new AuthTimeoutError(operation)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}