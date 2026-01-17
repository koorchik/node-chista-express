import WebSocket from 'ws';
import { ExpressRestApiBuilder } from '../src/ExpressRestApiBuilder';
import { RestApiError } from '../src/RestApiError';
import type { Server } from 'http';

describe('WebSocket Integration', () => {
  let server: Server;
  let port: number;

  afterEach((done) => {
    if (server) {
      server.close(done);
    } else {
      done();
    }
  });

  test('should handle WebSocket connection with echo', (done) => {
    class EchoService {
      async run({ ws }: { ws: WebSocket }) {
        ws.on('message', (data) => {
          ws.send(`echo: ${data}`);
        });
      }
    }

    const builder = new ExpressRestApiBuilder({
      runService: async (Service, context) => {
        const { request, ws } = context;
        const service = new Service();
        return service.run({ ws, ...request.params });
      },
      unauthenticatedServices: [['WS', '/ws/echo', EchoService]],
    });
    builder.build();

    server = builder.getApp().listen(0, () => {
      port = (server.address() as any).port;
      const ws = new WebSocket(`ws://localhost:${port}/api/public/ws/echo`);

      ws.on('open', () => {
        ws.send('hello');
      });

      ws.on('message', (data) => {
        expect(data.toString()).toBe('echo: hello');
        ws.close();
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    });
  });

  test('should handle WebSocket with route parameters', (done) => {
    class RoomService {
      async run({ ws, roomId }: { ws: WebSocket; roomId: string }) {
        ws.send(`joined: ${roomId}`);
      }
    }

    const builder = new ExpressRestApiBuilder({
      runService: async (Service, context) => {
        const { request, ws } = context;
        const service = new Service();
        return service.run({
          ws,
          roomId: request.params.roomId,
        });
      },
      unauthenticatedServices: [['WS', '/ws/rooms/:roomId', RoomService]],
    });
    builder.build();

    server = builder.getApp().listen(0, () => {
      port = (server.address() as any).port;
      const ws = new WebSocket(`ws://localhost:${port}/api/public/ws/rooms/room123`);

      ws.on('message', (data) => {
        expect(data.toString()).toBe('joined: room123');
        ws.close();
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    });
  });

  test('should run loadSession for authenticated WebSocket routes', (done) => {
    const loadSession = jest.fn(async () => ({ userId: 42 }));

    class AuthenticatedWsService {
      private ctx: { session: { userId: number } };

      constructor(ctx: { session: { userId: number } }) {
        this.ctx = ctx;
      }

      async run({ ws }: { ws: WebSocket }) {
        ws.send(`user: ${this.ctx.session.userId}`);
      }
    }

    const builder = new ExpressRestApiBuilder({
      loadSession,
      createService: (Service, context) => new Service({ session: context.session }),
      services: [['WS', '/ws/auth', AuthenticatedWsService]],
    });
    builder.build();

    server = builder.getApp().listen(0, () => {
      port = (server.address() as any).port;
      const ws = new WebSocket(`ws://localhost:${port}/api/ws/auth`);

      ws.on('message', (data) => {
        expect(data.toString()).toBe('user: 42');
        expect(loadSession).toHaveBeenCalled();
        ws.close();
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    });
  });

  test('should close WebSocket on loadSession error', (done) => {
    const builder = new ExpressRestApiBuilder({
      loadSession: async () => {
        throw new Error('Auth failed');
      },
      createService: (Service, _context) => new Service(),
      services: [['WS', '/ws/protected', class { async run() {} }]],
    });
    builder.build();

    server = builder.getApp().listen(0, () => {
      port = (server.address() as any).port;
      const ws = new WebSocket(`ws://localhost:${port}/api/ws/protected`);

      ws.on('close', () => {
        done();
      });

      ws.on('error', () => {
        // Expected - connection may error on close
      });
    });
  });

  test('should close WebSocket on RestApiError in loadSession', (done) => {
    const builder = new ExpressRestApiBuilder({
      loadSession: async () => {
        throw new RestApiError({ message: 'Unauthorized', code: 'UNAUTHORIZED' }, 401);
      },
      mapError: (error) => {
        if (error instanceof RestApiError) {
          return error;
        }
        return undefined;
      },
      createService: (Service, _context) => new Service(),
      services: [['WS', '/ws/protected', class { async run() {} }]],
    });
    builder.build();

    server = builder.getApp().listen(0, () => {
      port = (server.address() as any).port;
      const ws = new WebSocket(`ws://localhost:${port}/api/ws/protected`);

      ws.on('close', () => {
        done();
      });

      ws.on('error', () => {
        // Expected - connection may error on close
      });
    });
  });

  test('should handle multiple WebSocket clients', (done) => {
    const messages: string[] = [];
    let closedCount = 0;

    class CountService {
      private static counter = 0;

      async run({ ws }: { ws: WebSocket }) {
        CountService.counter++;
        ws.send(`client: ${CountService.counter}`);
      }
    }

    const builder = new ExpressRestApiBuilder({
      runService: async (Service, context) => {
        const service = new Service();
        return service.run({ ws: context.ws });
      },
      unauthenticatedServices: [['WS', '/ws/count', CountService]],
    });
    builder.build();

    server = builder.getApp().listen(0, () => {
      port = (server.address() as any).port;

      const checkDone = () => {
        closedCount++;
        if (closedCount === 2) {
          expect(messages).toContain('client: 1');
          expect(messages).toContain('client: 2');
          done();
        }
      };

      const ws1 = new WebSocket(`ws://localhost:${port}/api/public/ws/count`);
      const ws2 = new WebSocket(`ws://localhost:${port}/api/public/ws/count`);

      ws1.on('message', (data) => {
        messages.push(data.toString());
        ws1.close();
      });

      ws2.on('message', (data) => {
        messages.push(data.toString());
        ws2.close();
      });

      ws1.on('close', checkDone);
      ws2.on('close', checkDone);
    });
  });

  test('should handle WebSocket message exchange', (done) => {
    const receivedMessages: string[] = [];

    class ChatService {
      async run({ ws }: { ws: WebSocket }) {
        ws.on('message', (data) => {
          receivedMessages.push(data.toString());
          if (receivedMessages.length === 3) {
            ws.send('received all');
          }
        });
      }
    }

    const builder = new ExpressRestApiBuilder({
      runService: async (Service, context) => {
        const service = new Service();
        return service.run({ ws: context.ws });
      },
      unauthenticatedServices: [['WS', '/ws/chat', ChatService]],
    });
    builder.build();

    server = builder.getApp().listen(0, () => {
      port = (server.address() as any).port;
      const ws = new WebSocket(`ws://localhost:${port}/api/public/ws/chat`);

      ws.on('open', () => {
        ws.send('message1');
        ws.send('message2');
        ws.send('message3');
      });

      ws.on('message', (data) => {
        expect(data.toString()).toBe('received all');
        expect(receivedMessages).toEqual(['message1', 'message2', 'message3']);
        ws.close();
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    });
  });

  test('should pass query parameters to WebSocket service', (done) => {
    class QueryService {
      async run({ ws, token }: { ws: WebSocket; token?: string }) {
        ws.send(`token: ${token}`);
      }
    }

    const builder = new ExpressRestApiBuilder({
      runService: async (Service, context) => {
        const { request, ws } = context;
        const service = new Service();
        return service.run({
          ws,
          token: request.query.token,
        });
      },
      unauthenticatedServices: [['WS', '/ws/query', QueryService]],
    });
    builder.build();

    server = builder.getApp().listen(0, () => {
      port = (server.address() as any).port;
      const ws = new WebSocket(`ws://localhost:${port}/api/public/ws/query?token=abc123`);

      ws.on('message', (data) => {
        expect(data.toString()).toBe('token: abc123');
        ws.close();
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    });
  });

  test('should NOT call loadSession for unauthenticated WebSocket routes', (done) => {
    const loadSession = jest.fn(async () => ({ userId: 42 }));

    class PublicWsService {
      async run({ ws }: { ws: WebSocket }) {
        ws.send('public');
      }
    }

    const builder = new ExpressRestApiBuilder({
      loadSession,
      createService: (Service) => new Service(),
      unauthenticatedServices: [['WS', '/ws/public', PublicWsService]],
    });
    builder.build();

    server = builder.getApp().listen(0, () => {
      port = (server.address() as any).port;
      const ws = new WebSocket(`ws://localhost:${port}/api/public/ws/public`);

      ws.on('message', (data) => {
        expect(data.toString()).toBe('public');
        expect(loadSession).not.toHaveBeenCalled();
        ws.close();
        done();
      });

      ws.on('error', (err) => {
        done(err);
      });
    });
  });
});
