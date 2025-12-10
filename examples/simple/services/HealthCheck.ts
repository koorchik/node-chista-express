import type { Service } from '../../../src';

export class HealthCheck implements Service {
  async run() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
