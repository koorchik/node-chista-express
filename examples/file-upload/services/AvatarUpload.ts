import { RestApiError } from '../../../src';

interface AvatarUploadDependencies {
  userId: number;
}

interface AvatarUploadParams {
  file?: Express.Multer.File;
}

export class AvatarUpload {
  constructor(private deps: AvatarUploadDependencies) {}

  async run(input: AvatarUploadParams) {
    if (!input.file) {
      throw new RestApiError(
        { message: 'No avatar file uploaded', code: 'NO_FILE' },
        400
      );
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (!allowedTypes.includes(input.file.mimetype)) {
      throw new RestApiError(
        { message: 'Invalid file type. Only JPEG, PNG, and GIF are allowed.', code: 'INVALID_TYPE' },
        400
      );
    }

    // In a real app, you would upload to cloud storage (S3, GCS, etc.)
    // For this example, we just return the file info
    return {
      message: 'Avatar uploaded successfully',
      userId: this.deps.userId,
      file: {
        originalName: input.file.originalname,
        mimetype: input.file.mimetype,
        size: input.file.size,
        // In memory storage, file.buffer contains the file data
        // In disk storage, file.path would contain the file path
      },
    };
  }
}
