import { RestApiError } from '../src/RestApiError';

describe('RestApiError', () => {
  describe('constructor', () => {
    test('should create error with message and code', () => {
      const error = new RestApiError({ message: 'Test error', code: 'TEST_ERROR' }, 400);

      expect(error.message).toBe('Test error');
      expect(error.httpCode).toBe(400);
      expect(error.data).toEqual({ message: 'Test error', code: 'TEST_ERROR' });
      expect(error).toBeInstanceOf(Error);
      expect(error.name).toBe('RestApiError');
    });

    test('should default to 500 if no code provided', () => {
      const error = new RestApiError({ message: 'Server error' });

      expect(error.httpCode).toBe(500);
    });

    test('should be catchable as Error', () => {
      try {
        throw new RestApiError({ message: 'Test' }, 404);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).toBeInstanceOf(RestApiError);
      }
    });

    test('should handle error data with fields', () => {
      const error = new RestApiError(
        {
          code: 'VALIDATION_ERROR',
          message: 'Invalid input',
          fields: { email: 'Invalid email format' },
        },
        422
      );

      expect(error.data.fields).toEqual({ email: 'Invalid email format' });
      expect(error.httpCode).toBe(422);
    });
  });

  describe('data property', () => {
    test('should return the error data', () => {
      const errorData = { message: 'Test', code: 'TEST', extra: 'info' };
      const error = new RestApiError(errorData, 400);

      expect(error.data).toEqual(errorData);
    });
  });

  describe('httpCode validation', () => {
    test('should throw on non-numeric httpCode', () => {
      expect(() => new RestApiError({ message: 'test' }, 'invalid' as any)).toThrow(
        /httpCode must be an integer between 100 and 599/
      );
    });

    test('should throw on httpCode below 100', () => {
      expect(() => new RestApiError({ message: 'test' }, 50)).toThrow(
        /httpCode must be an integer between 100 and 599, got: 50/
      );
    });

    test('should throw on httpCode of 99', () => {
      expect(() => new RestApiError({ message: 'test' }, 99)).toThrow(
        /httpCode must be an integer between 100 and 599/
      );
    });

    test('should throw on httpCode above 599', () => {
      expect(() => new RestApiError({ message: 'test' }, 600)).toThrow(
        /httpCode must be an integer between 100 and 599, got: 600/
      );
    });

    test('should throw on non-integer httpCode', () => {
      expect(() => new RestApiError({ message: 'test' }, 404.5)).toThrow(
        /httpCode must be an integer between 100 and 599/
      );
    });

    test('should throw on NaN httpCode', () => {
      expect(() => new RestApiError({ message: 'test' }, NaN)).toThrow(
        /httpCode must be an integer between 100 and 599/
      );
    });

    test('should throw on Infinity httpCode', () => {
      expect(() => new RestApiError({ message: 'test' }, Infinity)).toThrow(
        /httpCode must be an integer between 100 and 599/
      );
    });

    test('should throw on null httpCode', () => {
      expect(() => new RestApiError({ message: 'test' }, null as any)).toThrow(
        /httpCode must be an integer between 100 and 599/
      );
    });

    test('should accept valid boundary httpCodes', () => {
      expect(() => new RestApiError({ message: 'test' }, 100)).not.toThrow();
      expect(() => new RestApiError({ message: 'test' }, 599)).not.toThrow();
    });

    test('should accept common HTTP status codes', () => {
      expect(() => new RestApiError({ message: 'test' }, 200)).not.toThrow();
      expect(() => new RestApiError({ message: 'test' }, 201)).not.toThrow();
      expect(() => new RestApiError({ message: 'test' }, 400)).not.toThrow();
      expect(() => new RestApiError({ message: 'test' }, 401)).not.toThrow();
      expect(() => new RestApiError({ message: 'test' }, 403)).not.toThrow();
      expect(() => new RestApiError({ message: 'test' }, 404)).not.toThrow();
      expect(() => new RestApiError({ message: 'test' }, 422)).not.toThrow();
      expect(() => new RestApiError({ message: 'test' }, 500)).not.toThrow();
      expect(() => new RestApiError({ message: 'test' }, 502)).not.toThrow();
      expect(() => new RestApiError({ message: 'test' }, 503)).not.toThrow();
    });
  });
});
