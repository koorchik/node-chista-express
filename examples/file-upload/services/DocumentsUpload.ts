import { RestApiError } from '../../../src';

interface DocumentsUploadDependencies {
  userId: number;
}

interface DocumentsUploadParams {
  title?: string;
  files?: Express.Multer.File[];
}

export class DocumentsUpload {
  constructor(private deps: DocumentsUploadDependencies) {}

  async run(input: DocumentsUploadParams) {
    if (!input.files || input.files.length === 0) {
      throw new RestApiError(
        { message: 'No documents uploaded', code: 'NO_FILES' },
        400
      );
    }

    // Validate file types
    const allowedTypes = ['application/pdf', 'application/msword', 'text/plain'];
    for (const file of input.files) {
      if (!allowedTypes.includes(file.mimetype)) {
        throw new RestApiError(
          { message: `Invalid file type: ${file.originalname}`, code: 'INVALID_TYPE' },
          400
        );
      }
    }

    // In a real app, you would process/store these files
    return {
      message: 'Documents uploaded successfully',
      userId: this.deps.userId,
      title: input.title || 'Untitled',
      files: input.files.map(file => ({
        originalName: file.originalname,
        mimetype: file.mimetype,
        size: file.size,
      })),
      totalSize: input.files.reduce((sum, f) => sum + f.size, 0),
    };
  }
}
