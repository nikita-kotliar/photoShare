jest.mock('cloudinary', () => require('./helpers/cloudinarySdk'));

const { cloud } = require('cloudinary');

beforeEach(() => {
  cloud.reset();
});
