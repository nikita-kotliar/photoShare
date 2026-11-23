import QRCode from 'qrcode';
import { createSeed, TEST_PASSWORD } from './data.js';

const EFFECTS = ['grayscale', 'sepia', 'blur'];
const STAFF = ['ADMIN', 'MODERATOR'];

class HttpError extends Error {
  constructor(status, code, message, fields) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

function paginate(items, query) {
  const limit = Math.min(Math.max(parseInt(query.get('limit') || '12', 10) || 12, 1), 50);
  const page = Math.max(parseInt(query.get('page') || '1', 10) || 1, 1);
  const total = items.length;
  return {
    items: items.slice((page - 1) * limit, page * limit),
    total,
    page,
    limit,
    pages: Math.ceil(total / limit),
  };
}

function fail(status, code, message, fields) {
  throw new HttpError(status, code, message, fields);
}

function validationError(fields) {
  fail(422, 'VALIDATION_ERROR', 'Помилка валідації', fields);
}

export function createMockApi({ now = Date.now() } = {}) {
  let db;
  let nextIds;
  let failNext = null;

  function reset() {
    db = createSeed(now);
    nextIds = {
      user: db.users.length + 1,
      photo: db.photos.length + 1,
      comment: db.comments.length + 1,
      rating: db.ratings.length + 1,
      link: db.links.length + 1,
      notification: db.notifications.length + 1,
      achievement: db.achievements.length + 1,
    };
  }
  reset();

  // Сповіщення (TASK-068), як на бекенді: про власні дії не сповіщаємо
  function notify({ userId, type, actorId = null, photoId = null, data = {} }) {
    if (!userId || userId === actorId) return;
    db.notifications.push({
      id: nextIds.notification++,
      userId,
      type,
      actorId,
      photoId,
      data,
      readAt: null,
      createdAt: new Date().toISOString(),
    });
  }

  // Досягнення (TASK-070), ті самі умови, що в backend/src/services/achievementsService.js
  const ACHIEVEMENT_CODES = ['FIRST_PHOTO', 'TEN_PHOTOS', 'COMMENTATOR', 'CRITIC', 'FAVORITE'];
  const ACHIEVEMENT_TRIGGERS = {
    photo: ['FIRST_PHOTO', 'TEN_PHOTOS'],
    comment: ['COMMENTATOR'],
    ratingGiven: ['CRITIC'],
    ratingReceived: ['FAVORITE'],
  };

  function achievementEarned(code, userId) {
    const photos = db.photos.filter((p) => p.authorId === userId);
    if (code === 'FIRST_PHOTO') return photos.length >= 1;
    if (code === 'TEN_PHOTOS') return photos.length >= 10;
    if (code === 'COMMENTATOR')
      return db.comments.filter((c) => c.authorId === userId).length >= 20;
    if (code === 'CRITIC') return db.ratings.filter((r) => r.userId === userId).length >= 50;
    const ids = new Set(photos.map((p) => p.id));
    const received = db.ratings.filter((r) => ids.has(r.photoId));
    const average = received.reduce((sum, r) => sum + r.value, 0) / (received.length || 1);
    return received.length >= 5 && average >= 4.5;
  }

  function checkAchievements(userId, trigger) {
    const fresh = [];
    for (const code of ACHIEVEMENT_TRIGGERS[trigger] ?? []) {
      const owned = db.achievements.some((a) => a.userId === userId && a.code === code);
      if (owned || !achievementEarned(code, userId)) continue;
      db.achievements.push({
        id: nextIds.achievement++,
        userId,
        code,
        createdAt: new Date().toISOString(),
      });
      notify({ userId, type: 'ACHIEVEMENT', data: { code } });
      fresh.push(code);
    }
    return fresh;
  }

  function serializeNotification(item) {
    const actor = item.actorId ? userById(item.actorId) : null;
    const photo = item.photoId ? db.photos.find((p) => p.id === item.photoId) : null;
    return {
      id: item.id,
      type: item.type,
      read: Boolean(item.readAt),
      actor: actor ? publicAuthor(actor) : null,
      photo: photo ? { id: photo.id, slug: photo.slug, url: photo.url } : null,
      data: item.data ?? {},
      createdAt: item.createdAt,
    };
  }

  const routeTable = [];

  function route(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp(
      '^' +
        pattern.replace(/:[a-zA-Z]+/g, (key) => {
          keys.push(key.slice(1));
          return '([^/]+)';
        }) +
        '/?$',
    );
    routeTable.push({ method, regex, keys, handler });
  }

  const userById = (id) => db.users.find((u) => u.id === id);

  function publicAuthor(user) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      avatarUrl: user.avatarUrl,
    };
  }

  function serializeUser(user) {
    return {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      avatarUrl: user.avatarUrl,
      bio: user.bio ?? null,
      googleLinked: Boolean(user.googleId),
      createdAt: user.createdAt,
    };
  }

  function ratingStats(photoId) {
    const list = db.ratings.filter((r) => r.photoId === photoId);
    const count = list.length;
    const average = count ? list.reduce((sum, r) => sum + r.value, 0) / count : null;
    return { count, average: average === null ? null : Math.round(average * 10) / 10 };
  }

  function serializePhoto(photo, viewer) {
    const stats = ratingStats(photo.id);
    const mine = viewer
      ? db.ratings.find((r) => r.photoId === photo.id && r.userId === viewer.id)
      : null;
    return {
      id: photo.id,
      slug: photo.slug,
      url: photo.url,
      description: photo.description,
      tags: photo.tags,
      author: publicAuthor(userById(photo.authorId)),
      averageRating: stats.average,
      ratingsCount: stats.count,
      commentsCount: db.comments.filter((c) => c.photoId === photo.id).length,
      myRating: viewer ? (mine ? mine.value : null) : undefined,
      createdAt: photo.createdAt,
      updatedAt: photo.updatedAt,
    };
  }

  function serializeComment(comment) {
    return {
      id: comment.id,
      photoId: comment.photoId,
      text: comment.text,
      author: publicAuthor(userById(comment.authorId)),
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt,
    };
  }

  function serializeRating(rating) {
    return {
      id: rating.id,
      photoId: rating.photoId,
      value: rating.value,
      user: publicAuthor(userById(rating.userId)),
      createdAt: rating.createdAt,
    };
  }

  function requireAuth(ctx) {
    if (!ctx.user) fail(401, 'UNAUTHORIZED', 'Потрібна авторизація');
    if (!ctx.user.isActive) fail(403, 'USER_BANNED', 'Акаунт заблоковано');
    return ctx.user;
  }

  function requireStaff(ctx) {
    const user = requireAuth(ctx);
    if (!STAFF.includes(user.role)) fail(403, 'FORBIDDEN', 'Недостатньо прав для цієї дії');
    return user;
  }

  function findPhoto(idOrSlug) {
    const photo = db.photos.find((p) => String(p.id) === idOrSlug || p.slug === idOrSlug);
    if (!photo) fail(404, 'NOT_FOUND', 'Світлину не знайдено');
    return photo;
  }

  function ownerOrAdmin(user, photo) {
    if (photo.authorId !== user.id && user.role !== 'ADMIN') {
      fail(403, 'FORBIDDEN', 'Недостатньо прав для цієї дії');
    }
  }

  function parseTags(raw) {
    let list = raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        list = Array.isArray(parsed) ? parsed : raw.split(',');
      } catch {
        list = raw.split(',');
      }
    }
    if (list === undefined || list === null) return [];
    const tags = [...new Set(list.map((tag) => String(tag).trim().toLowerCase()).filter(Boolean))];
    if (tags.length > 5) validationError({ tags: 'Можна додати не більше 5 тегів' });
    return tags;
  }

  function validateText(value, field, max = 1000) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) validationError({ [field]: 'Поле не може бути порожнім' });
    if (text.length > max) validationError({ [field]: `Максимум ${max} символів` });
    return text;
  }

  function validateUserFields(input, { requireAll, exceptId }) {
    const fields = {};
    const out = {};
    if (requireAll || input.username !== undefined) {
      const username = String(input.username ?? '').trim();
      if (username.length < 3) fields.username = 'Юзернейм має містити щонайменше 3 символи';
      else if (username.length > 30)
        fields.username = 'Юзернейм не може бути довшим за 30 символів';
      else if (!/^[a-zA-Z0-9_.-]+$/.test(username))
        fields.username = 'Дозволені лише латинські літери, цифри та символи _ . -';
      out.username = username;
    }
    if (requireAll || input.email !== undefined) {
      const email = String(input.email ?? '')
        .trim()
        .toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fields.email = 'Некоректний email';
      out.email = email;
    }
    if (requireAll) {
      const password = String(input.password ?? '');
      if (password.length < 8) fields.password = 'Пароль має містити щонайменше 8 символів';
      else if (password.length > 72) fields.password = 'Пароль не може бути довшим за 72 символи';
      out.password = password;
    }
    if (input.name !== undefined) {
      const name = String(input.name).trim();
      if (!name || name.length > 60) fields.name = 'Ім\u2019я має містити від 1 до 60 символів';
      out.name = name;
    }
    if (input.bio !== undefined) {
      const bio = String(input.bio ?? '').trim();
      if (bio.length > 300) fields.bio = 'Поле «Про себе» не може бути довшим за 300 символів';
      out.bio = bio || null;
    }
    if (Object.keys(fields).length > 0) validationError(fields);

    const conflicts = {};
    if (out.email && db.users.some((u) => u.email === out.email && u.id !== exceptId))
      conflicts.email = 'Користувач з таким email вже існує';
    if (out.username && db.users.some((u) => u.username === out.username && u.id !== exceptId))
      conflicts.username = 'Цей юзернейм вже зайнятий';
    if (Object.keys(conflicts).length > 0) {
      fail(409, 'CONFLICT', 'Користувач вже існує', conflicts);
    }
    return out;
  }

  function session(user) {
    return {
      setCookie: `token=mock-user-${user.id}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`,
    };
  }

  route('GET', '/health', () => ({ body: { status: 'ok', mock: true } }));

  route('POST', '/dev/reset', () => {
    reset();
    return { body: { status: 'reset' } };
  });

  route('POST', '/dev/fail-next', (ctx) => {
    const status = Number(ctx.body?.status) || 500;
    failNext = { status, code: ctx.body?.code || 'MOCK_ERROR' };
    return { status: 202, body: { failNext } };
  });

  route('POST', '/users', (ctx) => {
    const data = validateUserFields(ctx.body || {}, { requireAll: true });
    const user = {
      id: nextIds.user++,
      username: data.username,
      name: data.name || data.username,
      email: data.email,
      password: data.password,
      role: db.users.length === 0 ? 'ADMIN' : 'USER',
      isActive: true,
      avatarUrl: null,
      createdAt: new Date().toISOString(),
    };
    db.users.push(user);
    return { status: 201, body: { user: serializeUser(user) }, ...session(user) };
  });

  // Вхід через Google (TASK-067). Справжній бекенд веде на Google і назад; мок одразу
  // повертає на /home з сесією newbie (у моку акаунт пов'язано з Google).
  // Помилка: ?mockError=<код> або POST /dev/fail-next перед переходом
  route('GET', '/auth/google', (ctx) => {
    const back = (code) => ({ status: 302, redirect: `${ctx.origin}/auth?googleError=${code}` });
    const mockError = ctx.query.get('mockError');
    if (mockError) return back(mockError);
    const user = db.users.find((u) => u.googleId);
    if (!user) return back('unavailable');
    if (!user.isActive) return back('banned');
    return { status: 302, redirect: `${ctx.origin}/home`, ...session(user) };
  });

  route('POST', '/sessions', (ctx) => {
    const { email, password } = ctx.body || {};
    const fields = {};
    if (!email) fields.email = 'Вкажіть email';
    if (!password) fields.password = 'Вкажіть пароль';
    if (Object.keys(fields).length > 0) validationError(fields);

    const user = db.users.find((u) => u.email === String(email).trim().toLowerCase());
    if (!user || user.password !== password) {
      fail(401, 'INVALID_CREDENTIALS', 'Невірний email або пароль');
    }
    if (!user.isActive) fail(403, 'USER_BANNED', 'Акаунт заблоковано');
    return { body: { user: serializeUser(user) }, ...session(user) };
  });

  route('DELETE', '/sessions', () => ({
    status: 204,
    setCookie: 'token=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0',
  }));

  route('GET', '/users/me', (ctx) => ({ body: { user: serializeUser(requireAuth(ctx)) } }));

  route('PUT', '/users/me', (ctx) => {
    const user = requireAuth(ctx);
    const data = validateUserFields(ctx.body || {}, { requireAll: false, exceptId: user.id });
    Object.assign(user, data);
    return { body: { user: serializeUser(user) } };
  });

  route('GET', '/users/:username', (ctx) => {
    const user = db.users.find((u) => u.username === ctx.params.username);
    if (!user) fail(404, 'NOT_FOUND', 'Користувача не знайдено');
    return {
      body: {
        user: {
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
          bio: user.bio ?? null,
          createdAt: user.createdAt,
          photosCount: db.photos.filter((p) => p.authorId === user.id).length,
        },
      },
    };
  });

  route('GET', '/users/:username/achievements', (ctx) => {
    const user = db.users.find((u) => u.username === ctx.params.username);
    if (!user) fail(404, 'NOT_FOUND', 'Користувача не знайдено');
    const owned = new Map(
      db.achievements.filter((a) => a.userId === user.id).map((a) => [a.code, a.createdAt]),
    );
    const items = ACHIEVEMENT_CODES.map((code) => ({
      code,
      earned: owned.has(code),
      earnedAt: owned.get(code) ?? null,
    }));
    return { body: { items } };
  });

  route('GET', '/users/:username/photos', (ctx) => {
    const user = db.users.find((u) => u.username === ctx.params.username);
    if (!user) fail(404, 'NOT_FOUND', 'Користувача не знайдено');
    const list = db.photos
      .filter((p) => p.authorId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => serializePhoto(p, ctx.user));
    return { body: paginate(list, ctx.query) };
  });

  route('GET', '/photos', (ctx) => {
    requireAuth(ctx);
    const list = [...db.photos]
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => serializePhoto(p, ctx.user));
    return { body: paginate(list, ctx.query) };
  });

  // AI-підказка опису і тегів (TASK-069). Справжній бекенд питає модель; мок повертає
  // одну з готових відповідей. Ліміт - 5 запитів на користувача (429), POST /dev/fail-next -
  // AI недоступний (503)
  const AI_LIMIT = 5;
  const AI_ANSWERS = [
    {
      description:
        'Захід сонця над спокійним морем: небо переходить від помаранчевого до рожевого.',
      tags: ['море', 'захід', 'небо', 'вечір'],
    },
    {
      description: 'Гірська стежка серед хвойного лісу, вранішній туман стелиться долиною.',
      tags: ['гори', 'ліс', 'туман', 'ранок', 'подорожі'],
    },
    {
      description: 'Вечірнє місто з вогнями вікон і відблисками на мокрій бруківці.',
      tags: ['місто', 'ніч', 'вогні'],
    },
  ];
  route('POST', '/ai/describe', (ctx) => {
    const user = requireAuth(ctx);
    const file = ctx.form?.file;
    if (!file) validationError({ image: 'Оберіть файл зображення' });
    if (!file.type.startsWith('image/')) validationError({ image: 'Дозволені лише зображення' });
    if (file.size > 10 * 1024 * 1024) fail(413, 'PAYLOAD_TOO_LARGE', 'Файл завеликий');
    // Лічильник у db, щоб POST /dev/reset його скидав
    db.aiUsage ??= {};
    const used = db.aiUsage[user.id] ?? 0;
    if (used >= AI_LIMIT) {
      fail(429, 'AI_LIMIT', `Ліміт AI-підказок вичерпано (${AI_LIMIT} на день). Спробуйте завтра`);
    }
    db.aiUsage[user.id] = used + 1;
    const answer = AI_ANSWERS[file.size % AI_ANSWERS.length];
    return { body: { ...answer, remaining: AI_LIMIT - used - 1 } };
  });

  route('POST', '/photos', (ctx) => {
    const user = requireAuth(ctx);
    const form = ctx.form || { fields: {}, file: null };
    const fields = {};
    const description =
      typeof form.fields.description === 'string' ? form.fields.description.trim() : '';
    if (!description) fields.description = 'Додайте опис світлини';
    else if (description.length > 1000) fields.description = 'Максимум 1000 символів';
    if (!form.file) fields.image = 'Оберіть файл зображення';
    else if (!form.file.type.startsWith('image/')) fields.image = 'Дозволені лише зображення';
    else if (form.file.size > 10 * 1024 * 1024) fields.image = 'Файл завеликий (максимум 10 МБ)';
    const tags = (() => {
      try {
        return parseTags(form.fields.tags);
      } catch (error) {
        fields.tags = error.fields?.tags || 'Некоректні теги';
        return [];
      }
    })();
    if (Object.keys(fields).length > 0) validationError(fields);

    const id = nextIds.photo++;
    const stamp = new Date().toISOString();
    const photo = {
      id,
      slug: `upload-${id}x${Date.now().toString(36)}`,
      url: `data:${form.file.type};base64,${form.file.data.toString('base64')}`,
      description,
      tags,
      authorId: user.id,
      createdAt: stamp,
      updatedAt: stamp,
    };
    db.photos.push(photo);
    const newAchievements = checkAchievements(user.id, 'photo');
    return { status: 201, body: { photo: serializePhoto(photo, user), newAchievements } };
  });

  route('GET', '/photos/:id', (ctx) => ({
    body: { photo: serializePhoto(findPhoto(ctx.params.id), ctx.user) },
  }));

  route('PUT', '/photos/:id', (ctx) => {
    const user = requireAuth(ctx);
    const photo = findPhoto(ctx.params.id);
    ownerOrAdmin(user, photo);
    photo.description = validateText(ctx.body?.description, 'description');
    if (ctx.body?.tags !== undefined) photo.tags = parseTags(ctx.body.tags);
    photo.updatedAt = new Date().toISOString();
    return { body: { photo: serializePhoto(photo, user) } };
  });

  route('DELETE', '/photos/:id', (ctx) => {
    const user = requireAuth(ctx);
    const photo = findPhoto(ctx.params.id);
    ownerOrAdmin(user, photo);
    db.photos = db.photos.filter((p) => p.id !== photo.id);
    db.comments = db.comments.filter((c) => c.photoId !== photo.id);
    db.ratings = db.ratings.filter((r) => r.photoId !== photo.id);
    db.links = db.links.filter((l) => l.photoId !== photo.id);
    return { status: 204 };
  });

  async function serializeLink(link, photo, origin) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(link.transformations)) query.set(key, value);
    const base = photo.url.startsWith('data:') ? `/mock/photos/uploaded-${photo.id}` : photo.url;
    const url = `${origin}${base}?${query.toString()}`;
    return {
      id: link.id,
      photoId: link.photoId,
      url,
      qrCode: await QRCode.toDataURL(url, { margin: 1, width: 320 }),
      transformations: link.transformations,
      createdAt: link.createdAt,
    };
  }

  route('POST', '/photos/:id/links', async (ctx) => {
    const user = requireAuth(ctx);
    const photo = findPhoto(ctx.params.id);
    ownerOrAdmin(user, photo);

    const input = ctx.body?.transformations;
    if (!input || typeof input !== 'object') {
      validationError({ transformations: 'Вкажіть трансформації' });
    }
    const fields = {};
    const transformations = {};
    if (input.effect !== undefined) {
      if (EFFECTS.includes(input.effect)) transformations.effect = input.effect;
      else fields.effect = `Доступні ефекти: ${EFFECTS.join(', ')}`;
    }
    if (input.angle !== undefined) {
      const angle = Number(input.angle);
      if (Number.isInteger(angle) && angle >= 0 && angle < 360) transformations.angle = angle;
      else fields.angle = 'Кут має бути цілим числом від 0 до 359';
    }
    if (input.crop !== undefined) {
      if (input.crop === 'square') transformations.crop = 'square';
      else fields.crop = 'Доступна обрізка: square';
    }
    if (Object.keys(fields).length > 0) validationError(fields);
    if (Object.keys(transformations).length === 0) {
      validationError({ transformations: 'Оберіть хоча б одну трансформацію' });
    }

    const link = {
      id: nextIds.link++,
      photoId: photo.id,
      transformations,
      createdAt: new Date().toISOString(),
    };
    db.links.push(link);
    return { status: 201, body: { link: await serializeLink(link, photo, ctx.origin) } };
  });

  route('GET', '/photos/:id/links', async (ctx) => {
    const photo = findPhoto(ctx.params.id);
    const items = await Promise.all(
      db.links
        .filter((l) => l.photoId === photo.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((l) => serializeLink(l, photo, ctx.origin)),
    );
    return { body: { items } };
  });

  route('GET', '/photos/:id/comments', (ctx) => {
    const photo = findPhoto(ctx.params.id);
    const list = db.comments
      .filter((c) => c.photoId === photo.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map(serializeComment);
    return { body: paginate(list, ctx.query) };
  });

  route('POST', '/photos/:id/comments', (ctx) => {
    const user = requireAuth(ctx);
    const photo = findPhoto(ctx.params.id);
    const text = validateText(ctx.body?.text, 'text');
    const stamp = new Date().toISOString();
    const comment = {
      id: nextIds.comment++,
      photoId: photo.id,
      authorId: user.id,
      text,
      createdAt: stamp,
      updatedAt: stamp,
    };
    db.comments.push(comment);
    notify({
      userId: photo.authorId,
      type: 'COMMENT',
      actorId: user.id,
      photoId: photo.id,
      data: { commentId: comment.id, text: text.slice(0, 100) },
    });
    const newAchievements = checkAchievements(user.id, 'comment');
    return { status: 201, body: { comment: serializeComment(comment), newAchievements } };
  });

  route('PUT', '/comments/:id', (ctx) => {
    const user = requireAuth(ctx);
    const comment = db.comments.find((c) => String(c.id) === ctx.params.id);
    if (!comment) fail(404, 'NOT_FOUND', 'Коментар не знайдено');
    if (comment.authorId !== user.id) {
      fail(403, 'FORBIDDEN', 'Редагувати можна лише свій коментар');
    }
    comment.text = validateText(ctx.body?.text, 'text');
    comment.updatedAt = new Date().toISOString();
    return { body: { comment: serializeComment(comment) } };
  });

  route('DELETE', '/comments/:id', (ctx) => {
    requireStaff(ctx);
    const comment = db.comments.find((c) => String(c.id) === ctx.params.id);
    if (!comment) fail(404, 'NOT_FOUND', 'Коментар не знайдено');
    db.comments = db.comments.filter((c) => c.id !== comment.id);
    return { status: 204 };
  });

  route('POST', '/photos/:id/ratings', (ctx) => {
    const user = requireAuth(ctx);
    const photo = findPhoto(ctx.params.id);
    const value = Number(ctx.body?.value);
    if (!Number.isInteger(value) || value < 1 || value > 5) {
      validationError({ value: 'Оцінка має бути від 1 до 5' });
    }
    if (photo.authorId === user.id) {
      fail(403, 'FORBIDDEN', 'Не можна оцінювати власні світлини');
    }
    if (db.ratings.some((r) => r.photoId === photo.id && r.userId === user.id)) {
      fail(409, 'CONFLICT', 'Ви вже оцінили цю світлину');
    }
    const rating = {
      id: nextIds.rating++,
      photoId: photo.id,
      userId: user.id,
      value,
      createdAt: new Date().toISOString(),
    };
    db.ratings.push(rating);
    notify({
      userId: photo.authorId,
      type: 'RATING',
      actorId: user.id,
      photoId: photo.id,
      data: { value },
    });
    const newAchievements = checkAchievements(user.id, 'ratingGiven');
    checkAchievements(photo.authorId, 'ratingReceived');
    const stats = ratingStats(photo.id);
    return {
      status: 201,
      body: {
        rating: serializeRating(rating),
        averageRating: stats.average,
        ratingsCount: stats.count,
        newAchievements,
      },
    };
  });

  route('GET', '/photos/:id/ratings', (ctx) => {
    requireStaff(ctx);
    const photo = findPhoto(ctx.params.id);
    const list = db.ratings.filter((r) => r.photoId === photo.id).map(serializeRating);
    return { body: paginate(list, ctx.query) };
  });

  route('DELETE', '/ratings/:id', (ctx) => {
    requireStaff(ctx);
    const rating = db.ratings.find((r) => String(r.id) === ctx.params.id);
    if (!rating) fail(404, 'NOT_FOUND', 'Оцінку не знайдено');
    db.ratings = db.ratings.filter((r) => r.id !== rating.id);
    return { status: 204 };
  });

  route('GET', '/search/photos', (ctx) => {
    const user = requireAuth(ctx);
    const q = (ctx.query.get('q') || '').trim().toLowerCase();
    const tag = (ctx.query.get('tag') || '').trim().toLowerCase();
    const sort = ctx.query.get('sort') === 'rating' ? 'rating' : 'date';
    const order = ctx.query.get('order') === 'asc' ? 1 : -1;
    const ratingMin = Number(ctx.query.get('ratingMin')) || 0;
    const dateFrom = ctx.query.get('dateFrom');
    const dateTo = ctx.query.get('dateTo');
    const username = ctx.query.get('username');

    if (username && !STAFF.includes(user.role)) {
      fail(403, 'FORBIDDEN', 'Фільтр за користувачем доступний лише модераторам');
    }

    let list = db.photos.map((p) => ({ photo: p, stats: ratingStats(p.id) }));
    if (q) {
      list = list.filter(
        ({ photo }) =>
          photo.description.toLowerCase().includes(q) || photo.tags.some((t) => t.includes(q)),
      );
    }
    if (tag) list = list.filter(({ photo }) => photo.tags.includes(tag));
    if (ratingMin) list = list.filter(({ stats }) => (stats.average ?? 0) >= ratingMin);
    if (dateFrom) list = list.filter(({ photo }) => photo.createdAt.slice(0, 10) >= dateFrom);
    if (dateTo) list = list.filter(({ photo }) => photo.createdAt.slice(0, 10) <= dateTo);
    if (username) {
      const author = db.users.find((u) => u.username === username);
      list = list.filter(({ photo }) => author && photo.authorId === author.id);
    }

    list.sort((a, b) =>
      sort === 'rating'
        ? ((a.stats.average ?? 0) - (b.stats.average ?? 0)) * order
        : a.photo.createdAt.localeCompare(b.photo.createdAt) * order,
    );
    return {
      body: paginate(
        list.map(({ photo }) => serializePhoto(photo, user)),
        ctx.query,
      ),
    };
  });

  route('GET', '/admin/users', (ctx) => {
    requireStaff(ctx);
    const q = (ctx.query.get('q') || '').trim().toLowerCase();
    const role = ctx.query.get('role');
    const from = ctx.query.get('registeredFrom');
    const to = ctx.query.get('registeredTo');

    let list = [...db.users];
    if (q) {
      list = list.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q),
      );
    }
    if (role) list = list.filter((u) => u.role === role);
    if (from) list = list.filter((u) => u.createdAt.slice(0, 10) >= from);
    if (to) list = list.filter((u) => u.createdAt.slice(0, 10) <= to);
    // Як у бекенді: sort=name - А-Я (order=desc - Я-А), sort=date - нові першими (order=asc - старіші)
    const byName = ctx.query.get('sort') === 'name';
    const order = ctx.query.get('order') || (byName ? 'asc' : 'desc');
    const dir = order === 'asc' ? 1 : -1;
    list.sort((a, b) =>
      byName
        ? a.name.localeCompare(b.name, 'uk') * dir || (a.id - b.id) * dir
        : a.createdAt.localeCompare(b.createdAt) * dir,
    );
    return { body: paginate(list.map(serializeUser), ctx.query) };
  });

  route('PATCH', '/admin/users/:id/status', (ctx) => {
    const admin = requireAuth(ctx);
    if (admin.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Недостатньо прав для цієї дії');
    const target = db.users.find((u) => String(u.id) === ctx.params.id);
    if (!target) fail(404, 'NOT_FOUND', 'Користувача не знайдено');
    if (typeof ctx.body?.isActive !== 'boolean') {
      validationError({ isActive: 'Вкажіть true або false' });
    }
    if (target.id === admin.id || target.role === 'ADMIN') {
      fail(403, 'FORBIDDEN', 'Не можна змінювати статус адміністратора');
    }
    target.isActive = ctx.body.isActive;
    return { body: { user: serializeUser(target) } };
  });

  route('GET', '/notifications', (ctx) => {
    const user = requireAuth(ctx);
    const list = db.notifications
      .filter((n) => n.userId === user.id)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
      .map(serializeNotification);
    return { body: paginate(list, ctx.query) };
  });

  route('GET', '/notifications/unread-count', (ctx) => {
    const user = requireAuth(ctx);
    const count = db.notifications.filter((n) => n.userId === user.id && !n.readAt).length;
    return { body: { count } };
  });

  route('POST', '/notifications/read', (ctx) => {
    const user = requireAuth(ctx);
    const ids = ctx.body?.ids;
    if (ids !== undefined && (!Array.isArray(ids) || !ids.length || ids.length > 100)) {
      validationError({ ids: 'Вкажіть від 1 до 100 сповіщень' });
    }
    const mine = db.notifications.filter((n) => n.userId === user.id && !n.readAt);
    const target = ids ? mine.filter((n) => ids.includes(n.id)) : mine;
    const stamp = new Date().toISOString();
    target.forEach((n) => {
      n.readAt = stamp;
    });
    return { body: { updated: target.length, unread: mine.length - target.length } };
  });

  route('PATCH', '/admin/users/:id/role', (ctx) => {
    const admin = requireAuth(ctx);
    if (admin.role !== 'ADMIN') fail(403, 'FORBIDDEN', 'Недостатньо прав для цієї дії');
    const target = db.users.find((u) => String(u.id) === ctx.params.id);
    if (!target) fail(404, 'NOT_FOUND', 'Користувача не знайдено');
    if (!['USER', 'MODERATOR'].includes(ctx.body?.role)) {
      validationError({ role: 'Роль може бути USER або MODERATOR' });
    }
    if (target.id === admin.id || target.role === 'ADMIN') {
      fail(403, 'FORBIDDEN', 'Не можна змінювати роль адміністратора');
    }
    if (ctx.body.role === 'MODERATOR' && target.role !== 'MODERATOR') {
      notify({ userId: target.id, type: 'MODERATOR', actorId: admin.id });
    }
    target.role = ctx.body.role;
    return { body: { user: serializeUser(target) } };
  });

  async function handle({ method, path, query, cookies, body, form, origin }) {
    try {
      if (failNext && path === '/auth/google') {
        // Google-вхід - перехід браузером, тож помилка приходить редіректом, а не JSON
        failNext = null;
        return { status: 302, redirect: `${origin}/auth?googleError=unavailable` };
      }
      if (failNext && path !== '/dev/fail-next' && path !== '/dev/reset') {
        const { status, code } = failNext;
        failNext = null;
        fail(status, code, 'Штучна помилка мок-сервера');
      }

      const found = routeTable.find((r) => r.method === method && r.regex.test(path));
      if (!found) {
        const known = routeTable.some((r) => r.regex.test(path));
        if (known) fail(405, 'METHOD_NOT_ALLOWED', 'Метод не підтримується');
        fail(404, 'NOT_FOUND', 'Ресурс не знайдено');
      }

      const match = found.regex.exec(path);
      const params = {};
      found.keys.forEach((key, index) => {
        params[key] = decodeURIComponent(match[index + 1]);
      });

      const token = cookies.token || '';
      const userId = token.startsWith('mock-user-') ? Number(token.slice(10)) : null;
      const user = userId ? userById(userId) || null : null;

      const result = await found.handler({ params, query, body, form, user, origin });
      return {
        status: result.status || 200,
        body: result.body,
        setCookie: result.setCookie,
        redirect: result.redirect,
      };
    } catch (error) {
      if (error instanceof HttpError) {
        return {
          status: error.status,
          body: { error: { code: error.code, message: error.message, fields: error.fields } },
        };
      }
      return {
        status: 500,
        body: { error: { code: 'INTERNAL_ERROR', message: error.message } },
      };
    }
  }

  return { handle, reset, testPassword: TEST_PASSWORD };
}
