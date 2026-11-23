// Обмеження таблиці users на справжньому PostgreSQL (TASK-066): CHECK і UQ живуть лише
// в міграції, фейкова БД їх не перевіряє. Запуск як у search.db.test.js: TEST_DATABASE_URL

const db = require('../src/config/db');

const describeDb = process.env.TEST_DATABASE_URL ? describe : describe.skip;

function user(username, data = {}) {
  return db.user.create({
    data: { username, email: `${username}@example.com`, name: username, ...data },
  });
}

describeDb('users: вхід через Google на рівні бази', () => {
  beforeEach(async () => {
    await db.$executeRawUnsafe(
      'TRUNCATE users, photos, tags, photo_tags, comments, transformed_links, ratings, token_blacklist RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await db.$executeRawUnsafe('TRUNCATE users RESTART IDENTITY CASCADE');
    await db.$disconnect();
  });

  it('звичайний акаунт з паролем, без Google', async () => {
    const created = await user('plain', { passwordHash: 'hash' });
    expect(created).toMatchObject({ passwordHash: 'hash', googleId: null });
  });

  it('акаунт лише з Google, без пароля', async () => {
    const created = await user('googler', { googleId: 'sub-1' });
    expect(created).toMatchObject({ passwordHash: null, googleId: 'sub-1' });
  });

  it('пароль і Google разом', async () => {
    const created = await user('linked', { passwordHash: 'hash', googleId: 'sub-2' });
    expect(created.googleId).toBe('sub-2');
  });

  it('без пароля і без Google база рядок не приймає (users_login_method_check)', async () => {
    await expect(user('nobody')).rejects.toThrow(/users_login_method_check/);
  });

  it('прибрати пароль у акаунта без Google теж не можна', async () => {
    const created = await user('plain', { passwordHash: 'hash' });
    await expect(
      db.user.update({ where: { id: created.id }, data: { passwordHash: null } }),
    ).rejects.toThrow(/users_login_method_check/);
  });

  it('один акаунт Google - один користувач', async () => {
    await user('first', { googleId: 'same-sub' });
    await expect(user('second', { googleId: 'same-sub' })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('багато акаунтів без Google не конфліктують між собою', async () => {
    await user('a', { passwordHash: 'hash' });
    await user('b', { passwordHash: 'hash' });
    expect(await db.user.count({ where: { googleId: null } })).toBe(2);
  });
});
