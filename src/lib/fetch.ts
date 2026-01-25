import { z } from 'zod';

interface SmartFetchError {
	retry: boolean;
}

const isSmartFetchError = (err: Error | unknown): err is SmartFetchError =>
	err instanceof Error && Object.hasOwn(err, 'retry');

class ResponseError extends Error implements SmartFetchError {
	constructor(private readonly response: Response) {
		super();
	}

	retry = true;
}

class DataError extends Error implements SmartFetchError {
	constructor(private readonly source: unknown) {
		super();
	}

	retry = true;
}

class FetchError extends Error implements SmartFetchError {
	constructor(private readonly source: unknown) {
		super();
	}

	retry = true;
}

class RetryAfterError extends Error implements SmartFetchError {
	constructor(public readonly delay: number) {
		// delay in seconds
		super();
	}

	retry = true;

	public static is(e: unknown): e is RetryAfterError {
		return e instanceof RetryAfterError;
	}
}

export class AbortedError extends Error implements SmartFetchError {
	constructor(private readonly source: unknown) {
		super();
	}

	retry = true;

	public static is(e: unknown): e is RetryAfterError {
		return e instanceof AbortedError;
	}
}

export class TimeoutError extends Error implements SmartFetchError {
	constructor() {
		super();
	}

	retry = false;
}

const abortableWait = (ms: number, signal?: AbortSignal | null): Promise<void> => {
	return new Promise((resolve, reject) => {
		if (signal?.aborted) {
			return reject(new DOMException('Aborted', 'AbortError'));
		}

		const timer = setTimeout(() => {
			cleanup();
			resolve();
		}, ms);

		const onAbort = () => {
			cleanup();
			clearTimeout(timer);
			reject(new DOMException('Aborted', 'AbortError'));
		};

		const cleanup = () => {
			signal?.removeEventListener('abort', onAbort);
		};

		signal?.addEventListener('abort', onAbort);
	});
};

export async function smartFetch<T extends z.Schema>({
	input,
	init,
	schema,
	timeout // timeout in ms
}: {
	schema: T;
	timeout: number;
	input: string | URL | Request;
	init?: RequestInit;
}): Promise<z.infer<T>> {
	if (timeout <= 0) {
		throw new Error('Timeout should be greater than 0');
	}

	const trySingleFetch = async (): Promise<z.infer<T>> => {
		let response: Response;
		try {
			response = await fetch(input, init);
		} catch (e) {
			// Do not throw an error if the fetch was aborted
			if (init?.signal?.aborted) {
				throw new AbortedError(e);
			}
			throw new FetchError(e);
		}
		if (response.ok) {
			try {
				// TODO: Handle requests that does not have a body
				const data = await response.json();
				return schema.parse(data);
			} catch (error) {
				throw new DataError(error);
			}
		} else if (response.status === 429) {
			const rawRetryAfterHeader = response.headers.get('Retry-After');
			if (rawRetryAfterHeader) {
				const retryAfter = Number.parseInt(rawRetryAfterHeader, 10);
				if (retryAfter > 0) {
					throw new RetryAfterError(retryAfter);
				}
			}
			throw new RetryAfterError(1);
		} else {
			throw new ResponseError(response);
		}
	};

	let delay = 500; // Start with 500ms
	const deadline = Date.now() + timeout;

	// We use a true loop here to allow breaking via exceptions or return
	while (true) {
		if (Date.now() >= deadline) {
			throw new TimeoutError();
		}

		if (init?.signal?.aborted) {
			throw new AbortedError('Signal aborted');
		}

		try {
			return await trySingleFetch();
		} catch (e) {
			if (AbortedError.is(e)) throw e;

			if (isSmartFetchError(e) && e.retry) {
				let sleepDelay = delay;

				if (RetryAfterError.is(e)) {
					sleepDelay = e.delay * 1_000;
				}

				const timeRemaining = deadline - Date.now();

				if (sleepDelay >= timeRemaining) {
					throw new TimeoutError();
				}

				try {
					await abortableWait(sleepDelay, init?.signal);
				} catch (waitError) {
					if (init?.signal?.aborted) {
						throw new AbortedError(waitError);
					}
					throw waitError;
				}

				delay = Math.min(delay * 2, 1_000);
			} else {
				throw e;
			}
		}
	}
}
