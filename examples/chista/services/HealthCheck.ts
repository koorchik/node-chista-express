import { BaseSimple } from './BaseSimple';

interface HealthCheckOutput {
  status: string;
  timestamp: string;
}

export class HealthCheck extends BaseSimple<void, HealthCheckOutput> {
  async execute(): Promise<HealthCheckOutput> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
