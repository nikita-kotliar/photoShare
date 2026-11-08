const fakeDb = require('./fakeDb');
const { agent, register } = require('./app');

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32),
]);

async function signedIn(username) {
  const client = agent();
  const res = await register(client, { username, email: `${username}@example.com` });
  return { client, user: res.body.user };
}

async function team() {
  const admin = await signedIn('admin');
  const owner = await signedIn('owner');
  const stranger = await signedIn('stranger');
  return { admin, owner, stranger };
}

async function withRole(member, role) {
  await fakeDb.user.update({ where: { id: member.user.id }, data: { role } });
  return { ...member, user: { ...member.user, role } };
}

async function ban(member) {
  await fakeDb.user.update({ where: { id: member.user.id }, data: { isActive: false } });
}

async function allRoles() {
  const members = await team();
  const moderator = await withRole(await signedIn('moderator'), 'MODERATOR');
  return { ...members, moderator };
}

function upload(client, description = 'Захід сонця', file = PNG, filename = 'photo.png') {
  return client
    .post('/api/photos')
    .field('description', description)
    .attach('image', file, filename);
}

module.exports = { PNG, signedIn, team, allRoles, withRole, ban, upload };
