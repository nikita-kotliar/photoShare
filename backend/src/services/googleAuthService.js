const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const env = require('../config/env');
const { signToken } = require('./authService');

const AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['accounts.google.com', 'https://accounts.google.com'];
const STATE_TTL_SECONDS = 10 * 60;
const USERNAME_MAX = 30;

class GoogleAuthError extends Error {
  constructor(code, message = code) {
    super(message);
    this.code = code;
  }
}

function base64url(buffer) {
  return buffer.toString('base64url');
}

function startLogin() {
  if (!env.googleEnabled) throw new GoogleAuthError('unavailable', 'Google не налаштовано');
  const state = base64url(crypto.randomBytes(24));
  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
  const params = new URLSearchParams({
    client_id: env.GOOGLE_CLIENT_ID,
    redirect_uri: env.GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    prompt: 'select_account',
  });
  const cookie = jwt.sign({ state, verifier }, env.JWT_SECRET, { expiresIn: STATE_TTL_SECONDS });
  return { url: `${AUTH_URL}?${params}`, cookie, maxAge: STATE_TTL_SECONDS * 1000 };
}

function readStateCookie(cookie, state) {
  try {
    const saved = jwt.verify(cookie, env.JWT_SECRET);
    if (!state || saved.state !== state) throw new Error('state');
    return saved.verifier;
  } catch {
    throw new GoogleAuthError('unavailable', 'Неправильний state');
  }
}

async function exchangeCode(code, verifier) {
  let response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.GOOGLE_REDIRECT_URI,
        grant_type: 'authorization_code',
        code_verifier: verifier,
      }),
    });
  } catch {
    throw new GoogleAuthError('unavailable', 'Google недоступний');
  }
  if (!response.ok) throw new GoogleAuthError('unavailable', `Google відповів ${response.status}`);
  const { id_token: idToken } = await response.json();
  // id_token отримано напряму від Google по TLS з нашим client_secret, тож перевіряємо лише вміст
  const claims = idToken ? jwt.decode(idToken) : null;
  const now = Math.floor(Date.now() / 1000);
  if (
    !claims?.sub ||
    !claims.email ||
    claims.aud !== env.GOOGLE_CLIENT_ID ||
    !ISSUERS.includes(claims.iss) ||
    !(claims.exp > now)
  ) {
    throw new GoogleAuthError('unavailable', 'Некоректний id_token');
  }
  if (claims.email_verified !== true) throw new GoogleAuthError('email_unverified');
  return claims;
}

async function freeUsername(email) {
  let base = email
    .split('@')[0]
    .replace(/[^a-zA-Z0-9_.-]/g, '')
    .slice(0, USERNAME_MAX - 4);
  if (base.length < 3) base = `user${base}`;
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}${i + 1}`;
    if (!(await db.user.findUnique({ where: { username: candidate } }))) return candidate;
  }
  return `${base.slice(0, 20)}${crypto.randomInt(1e6, 1e7)}`;
}

async function findOrCreateUser(claims) {
  const email = claims.email.toLowerCase();
  const byGoogle = await db.user.findUnique({ where: { googleId: claims.sub } });
  if (byGoogle) return byGoogle;

  const byEmail = await db.user.findUnique({ where: { email } });
  if (byEmail) {
    return db.user.update({ where: { id: byEmail.id }, data: { googleId: claims.sub } });
  }

  const isFirstUser = (await db.user.count()) === 0;
  return db.user.create({
    data: {
      username: await freeUsername(email),
      email,
      name: (claims.name || email.split('@')[0]).slice(0, 60),
      googleId: claims.sub,
      passwordHash: null,
      role: isFirstUser ? 'ADMIN' : 'USER',
    },
  });
}

async function finishLogin({ code, state, error, cookie }) {
  if (error === 'access_denied') throw new GoogleAuthError('cancelled');
  if (!env.googleEnabled || error || !code) throw new GoogleAuthError('unavailable');
  const verifier = readStateCookie(cookie, state);
  const claims = await exchangeCode(code, verifier);
  const user = await findOrCreateUser(claims);
  if (!user.isActive) throw new GoogleAuthError('banned');
  return { user, token: signToken(user) };
}

module.exports = { GoogleAuthError, startLogin, finishLogin, freeUsername };
