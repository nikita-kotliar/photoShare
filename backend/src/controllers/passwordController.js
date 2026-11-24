const passwordService = require('../services/passwordService');
const { setAuthCookie } = require('../utils/cookies');
const { toPublicUser } = require('../utils/serializers');

async function forgot(req, res) {
  await passwordService.requestReset(req.body);
  res.json({ message: 'Якщо акаунт з такою поштою існує, ми надіслали лист з посиланням' });
}

async function reset(req, res) {
  const { user, token } = await passwordService.reset(req.body);
  setAuthCookie(res, token);
  res.json({ user: toPublicUser(user) });
}

module.exports = { forgot, reset };
