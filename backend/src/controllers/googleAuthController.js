const env = require('../config/env');
const googleAuthService = require('../services/googleAuthService');
const { setAuthCookie } = require('../utils/cookies');

const STATE_COOKIE = `${env.COOKIE_NAME}_oauth`;

function stateCookieOptions(maxAge) {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: env.cookieSecure,
    path: env.COOKIE_PATH,
    maxAge,
  };
}

function backToApp(res, code) {
  res.redirect(302, `${env.appUrl}/auth?googleError=${encodeURIComponent(code)}`);
}

function start(_req, res) {
  try {
    const { url, cookie, maxAge } = googleAuthService.startLogin();
    res.cookie(STATE_COOKIE, cookie, stateCookieOptions(maxAge));
    res.redirect(302, url);
  } catch {
    backToApp(res, 'unavailable');
  }
}

async function callback(req, res) {
  res.clearCookie(STATE_COOKIE, stateCookieOptions());
  try {
    const { token } = await googleAuthService.finishLogin({
      code: req.query.code,
      state: req.query.state,
      error: req.query.error,
      cookie: req.cookies?.[STATE_COOKIE],
    });
    setAuthCookie(res, token);
    res.redirect(302, `${env.appUrl}/home`);
  } catch (err) {
    if (err instanceof googleAuthService.GoogleAuthError) return backToApp(res, err.code);
    console.error('Вхід через Google:', err.message);
    backToApp(res, 'unavailable');
  }
}

module.exports = { start, callback, STATE_COOKIE };
