process.env.NODE_ENV = 'test';
// TEST_DATABASE_URL вмикає тести на справжньому PostgreSQL (*.db.test.js). Вони очищають
// усі таблиці, тому це має бути окрема тестова база, а не робоча
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/test';
process.env.JWT_SECRET = 'test-secret-test-secret-test-secret';
process.env.JWT_EXPIRES_IN_HOURS = '1';
process.env.CLOUDINARY_CLOUD_NAME = 'demo';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
