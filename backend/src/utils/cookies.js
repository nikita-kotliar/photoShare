const env = require('../config/env');

const COOKIE_NAME = env.COOKIE_NAME;

function baseOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: env.COOKIE_PATH,
  };
}

function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    ...baseOptions(),
    maxAge: env.JWT_EXPIRES_IN_HOURS * 60 * 60 * 1000,
  });
}

function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME, baseOptions());
}

module.exports = { COOKIE_NAME, setAuthCookie, clearAuthCookie };
