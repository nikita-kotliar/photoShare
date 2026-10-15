const AppError = require('../utils/AppError');

function requireRole(...roles) {
  return (req, _res, next) => {
    if (!req.user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Потрібна авторизація');
    }
    if (!roles.includes(req.user.role)) {
      throw new AppError(403, 'FORBIDDEN', 'Недостатньо прав для цієї дії');
    }
    next();
  };
}

module.exports = { requireRole };
