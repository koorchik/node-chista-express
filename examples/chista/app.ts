import type { Server } from 'http';
import { ExpressRestApiBuilder, RestApiError, type ServiceClass } from '../../src';
import { ServiceError } from 'chista';
import { HealthCheck } from './services/HealthCheck';
import { UsersList } from './services/UsersList';
import { UsersShow } from './services/UsersShow';
import { UsersCreate } from './services/UsersCreate';
import type { Database } from './services/Base';

// In-memory database for the example
const db: Database = new Map();

// Seed some initial data
db.set(1, { id: 1, name: 'Alice', email: 'alice@example.com' });
db.set(2, { id: 2, name: 'Bob', email: 'bob@example.com' });

// Create the API builder
const builder = new ExpressRestApiBuilder({
  apiBaseUrl: '/api',
  logger: console,

  createService: (Service: ServiceClass, _context) => {
    return new Service({ db });
  },

  // Map chista's ServiceError to RestApiError
  mapError: (error: unknown) => {
    if (error instanceof ServiceError) {
      return new RestApiError(error.toObject(), 200);
    }
    return undefined;
  },

  loadSession: async () => {
    // In a real app, validate token and return session data
    return { userId: 1 };
  },

  services: [
    ['GET', '/users', UsersList],
    ['GET', '/users/:id', UsersShow],
    ['POST', '/users', UsersCreate],
  ],

  unauthenticatedServices: [
    ['GET', '/health', HealthCheck],
  ],
});

// Get Express app for adding custom middleware
const app = builder.getApp();

// Build routes
builder.build();

// Start server
const PORT = process.env.PORT || 3000;
const server: Server = app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log(`  GET  http://localhost:${PORT}/api/public/health  - Health check`);
  console.log(`  GET  http://localhost:${PORT}/api/users        - List users`);
  console.log(`  GET  http://localhost:${PORT}/api/users/:id    - Get user by ID`);
  console.log(`  POST http://localhost:${PORT}/api/users        - Create user`);
  console.log('');
  console.log('Press Ctrl+C to stop the server gracefully');
});

// Graceful shutdown handler
function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    }

    console.log('HTTP server closed');
    db.clear();
    console.log('Resources cleaned up. Exiting.');
    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
