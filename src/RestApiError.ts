export type RestApiErrorData = Record<string, unknown>;

export class RestApiError extends Error {
  #data: RestApiErrorData;
  #httpCode: number;

  constructor(data: RestApiErrorData, httpCode: number = 500) {
    if (
      typeof httpCode !== 'number' ||
      !Number.isInteger(httpCode) ||
      httpCode < 100 ||
      httpCode > 599
    ) {
      throw new Error(
        `RestApiError: httpCode must be an integer between 100 and 599, got: ${httpCode}`
      );
    }

    super(typeof data.message === 'string' ? data.message : 'API Error');
    this.name = 'RestApiError';
    this.#data = data;
    this.#httpCode = httpCode;

    Object.setPrototypeOf(this, RestApiError.prototype);
  }

  get data(): RestApiErrorData {
    return this.#data;
  }

  get httpCode(): number {
    return this.#httpCode;
  }
}
