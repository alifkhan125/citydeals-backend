import { registerAs } from '@nestjs/config';

export default registerAs('gcs', () => ({
  projectId: process.env.GOOGLE_CLOUD_PROJECT_ID || 'citydeals-app',
  bucketName: process.env.GOOGLE_CLOUD_BUCKET_NAME || 'citydeals-images-bucket',
}));
