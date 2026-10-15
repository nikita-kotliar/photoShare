const authService = require('../services/authService');
const { setAuthCookie, clearAuthCookie } = require('../utils/cookies');
const { toPublicUser } = require('../utils/serializers');

async function register(req, res) {
  const { user, token } = await authService.register(req.body);
  setAuthCookie(res, token);
  res.status(201).json({ user: toPublicUser(user) });
}

async function login(req, res) {
  const { user, token } = await authService.login(req.body);
  setAuthCookie(res, token);
  res.json({ user: toPublicUser(user) });
}

function logout(_req, res) {
  clearAuthCookie(res);
  res.status(204).end();
}

function me(req, res) {
  res.json({ user: toPublicUser(req.user) });
}

module.exports = { register, login, logout, me };
