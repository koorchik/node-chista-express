import { BaseSimple } from './BaseSimple';

type HealthCheckResult = {
  status: string;
  timestamp: string;
};

export class HealthCheck extends BaseSimple<void, HealthCheckResult> {
  async execute(): Promise<HealthCheckResult> {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }
}
