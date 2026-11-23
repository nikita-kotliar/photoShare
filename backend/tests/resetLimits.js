const { resetRateLimits } = require('../src/middleware/rateLimit');

beforeEach(() => {
  resetRateLimits();
});
