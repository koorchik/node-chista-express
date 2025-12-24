import type { Server } from 'http';
import multer from 'multer';
import { ExpressRestApiBuilder, type ServiceClass } from '../../src';
import { AvatarUpload } from './services/AvatarUpload';
import { DocumentsUpload } from './services/DocumentsUpload';

// Configure multer with memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max file size
    files: 10, // Max 10 files per request
  },
});

// Create the API builder
const builder = new ExpressRestApiBuilder({
  apiBaseUrl: '/api',
  logger: console,

  createService: (Service: ServiceClass, context) => {
    return new Service({ userId: context.session?.userId });
  },

  loadSession: async () => {
    // In a real app, validate token and return session data
    return { userId: 1 };
  },

  services: [
    // Single file upload - avatar
    ['POST', '/avatar', AvatarUpload, {
      middlewares: [upload.single('avatar')],
    }],

    // Multiple file upload - documents
    ['POST', '/documents', DocumentsUpload, {
      middlewares: [upload.array('documents', 10)],
    }],
  ],
});

// Get Express app
const app = builder.getApp();

// Build routes
builder.build();

// Start server
const PORT = process.env.PORT || 3000;
const server: Server = app.listen(PORT, () => {
  console.log(`File Upload Example running on http://localhost:${PORT}`);
  console.log('');
  console.log('Available endpoints:');
  console.log('');
  console.log('  POST /api/avatar');
  console.log('    - Upload a single avatar image');
  console.log('    - Field name: "avatar"');
  console.log('    - Allowed types: JPEG, PNG, GIF');
  console.log('    - Example: curl -F "avatar=@photo.jpg" http://localhost:3000/api/avatar');
  console.log('');
  console.log('  POST /api/documents');
  console.log('    - Upload multiple documents');
  console.log('    - Field name: "documents"');
  console.log('    - Allowed types: PDF, DOC, TXT');
  console.log('    - Example: curl -F "documents=@file1.pdf" -F "documents=@file2.txt" http://localhost:3000/api/documents');
  console.log('');
  console.log('Press Ctrl+C to stop the server');
});

// Graceful shutdown handler
function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received. Shutting down...`);

  server.close((err) => {
    if (err) {
      console.error('Error during server close:', err);
      process.exit(1);
    }
    console.log('Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    console.error('Graceful shutdown timed out. Forcing exit.');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
