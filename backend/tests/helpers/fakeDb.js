let users = [];
let photos = [];
let comments = [];
let tags = [];
let photoTags = [];
let nextTagId = 1;
let links = [];
let nextId = 1;
let nextPhotoId = 1;
let nextCommentId = 1;
let nextLinkId = 1;
let blacklist = [];
let ratings = [];
let nextRatingId = 1;
let notifications = [];
let nextNotificationId = 1;
let achievements = [];
let nextAchievementId = 1;
let resets = [];
let nextResetId = 1;

function clone(user) {
  return user ? { ...user } : null;
}

function findBy(where) {
  const [key] = Object.keys(where);
  return users.find((user) => user[key] === where[key]);
}

function contains(value, { contains: needle }) {
  return value.toLowerCase().includes(needle.toLowerCase());
}

function matchesUser(user, where = {}) {
  if (where.OR && !where.OR.some((cond) => matchesUser(user, cond))) return false;
  for (const field of ['name', 'username', 'email']) {
    if (where[field] && !contains(user[field], where[field])) return false;
  }
  if (where.role && user.role !== where.role) return false;
  if (where.createdAt?.gte && user.createdAt < where.createdAt.gte) return false;
  if (where.createdAt?.lt && user.createdAt >= where.createdAt.lt) return false;
  return true;
}

function pick(record, select) {
  return Object.fromEntries(Object.keys(select).map((key) => [key, record[key]]));
}

function withInclude(record, include = {}) {
  const result = { ...record };
  if (include.author) {
    const author = users.find((user) => user.id === record.authorId);
    result.author = include.author.select ? pick(author, include.author.select) : { ...author };
  }
  if (include.tags) {
    result.tags = photoTags
      .filter((link) => link.photoId === record.id)
      .map((link) => ({ ...link, tag: { name: tags.find((tag) => tag.id === link.tagId).name } }))
      .sort((a, b) => a.tag.name.localeCompare(b.tag.name));
  }
  if (include.user) {
    const user = users.find((item) => item.id === record.userId);
    result.user = include.user.select ? pick(user, include.user.select) : { ...user };
  }
  if (include._count) {
    result._count = { comments: comments.filter((c) => c.photoId === record.id).length };
  }
  return result;
}

function shape(record, { include, select } = {}) {
  if (!record) return null;
  return select ? pick(record, select) : withInclude(record, include);
}

function findIn(list, where) {
  const [key] = Object.keys(where);
  return list.find((item) => item[key] === where[key]);
}

function findPhoto(where) {
  return findIn(photos, where);
}

// where: рівність полів або { in: [...] }
function matches(record, where = {}) {
  return Object.entries(where).every(([key, value]) => {
    if (value && typeof value === 'object' && Array.isArray(value.in)) {
      return value.in.includes(record[key]);
    }
    if (value && typeof value === 'object' && value.gte instanceof Date) {
      return record[key] >= value.gte;
    }
    return record[key] === value;
  });
}

function newest(a, b) {
  return b.createdAt - a.createdAt || b.id - a.id;
}

function byOrder(orderBy) {
  const rules = [orderBy ?? []].flat();
  if (rules.length === 0) return newest;
  return (a, b) => {
    for (const rule of rules) {
      const [key, dir] = Object.entries(rule)[0];
      const diff = (a[key] > b[key]) - (a[key] < b[key]);
      if (diff) return dir === 'desc' ? -diff : diff;
    }
    return 0;
  };
}

function notFound() {
  return Object.assign(new Error('Record not found'), { code: 'P2025' });
}

const fakeDb = {
  user: {
    findUnique: async ({ where }) => clone(findBy(where)),
    findMany: async ({ where, orderBy, skip = 0, take = users.length } = {}) =>
      users
        .filter((user) => matchesUser(user, where))
        .sort(byOrder(orderBy))
        .slice(skip, skip + take)
        .map(clone),
    count: async ({ where } = {}) => users.filter((user) => matchesUser(user, where)).length,
    create: async ({ data }) => {
      const now = new Date();
      const user = {
        id: nextId++,
        role: 'USER',
        isActive: true,
        createdAt: now,
        updatedAt: now,
        ...data,
      };
      users.push(user);
      return clone(user);
    },
    update: async ({ where, data }) => {
      const user = findBy(where);
      const changes = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
      // Як унікальні індекси PostgreSQL
      for (const key of ['username', 'email']) {
        if (changes[key] && users.some((u) => u.id !== user.id && u[key] === changes[key])) {
          throw Object.assign(new Error('Unique constraint failed'), {
            code: 'P2002',
            meta: { target: [key] },
          });
        }
      }
      Object.assign(user, changes, { updatedAt: new Date() });
      return clone(user);
    },
  },
  photo: {
    findUnique: async ({ where, ...options }) => shape(findPhoto(where), options),
    findMany: async ({ where, include, orderBy, skip = 0, take = photos.length } = {}) =>
      photos
        .filter((photo) => matches(photo, where))
        .sort(byOrder(orderBy))
        .slice(skip, skip + take)
        .map((photo) => withInclude(photo, include)),
    count: async ({ where } = {}) => photos.filter((photo) => matches(photo, where)).length,
    create: async ({ data: { tags: nested, ...data }, include }) => {
      const now = new Date();
      const photo = { id: nextPhotoId++, createdAt: now, updatedAt: now, ...data };
      photos.push(photo);
      for (const { tag } of nested?.create ?? []) {
        photoTags.push({ photoId: photo.id, tagId: tag.connect.id });
      }
      return withInclude(photo, include);
    },
    update: async ({ where, data, include }) => {
      const photo = findPhoto(where);
      if (!photo) throw notFound();
      Object.assign(photo, data, { updatedAt: new Date() });
      return withInclude(photo, include);
    },
    delete: async ({ where }) => {
      const photo = findPhoto(where);
      if (!photo) throw notFound();
      photos = photos.filter((item) => item.id !== photo.id);
      comments = comments.filter((comment) => comment.photoId !== photo.id);
      photoTags = photoTags.filter((link) => link.photoId !== photo.id);
      links = links.filter((link) => link.photoId !== photo.id);
      ratings = ratings.filter((rating) => rating.photoId !== photo.id);
      notifications = notifications.filter((item) => item.photoId !== photo.id);
      return { ...photo };
    },
  },
  passwordReset: {
    findUnique: async ({ where }) => {
      const key = Object.keys(where)[0];
      const row = resets.find((item) => item[key] === where[key]);
      return row ? { ...row } : null;
    },
    create: async ({ data }) => {
      const row = { id: nextResetId++, createdAt: new Date(), usedAt: null, ...data };
      resets.push(row);
      return { ...row };
    },
    update: async ({ where, data }) => {
      const row = resets.find((item) => item.id === where.id);
      if (!row) throw notFound();
      Object.assign(row, data);
      return { ...row };
    },
    deleteMany: async ({ where }) => {
      const before = resets.length;
      resets = resets.filter((row) => !matches(row, where));
      return { count: before - resets.length };
    },
    count: async ({ where } = {}) => resets.filter((row) => matches(row, where)).length,
  },
  comment: {
    findUnique: async ({ where, ...options }) => shape(findIn(comments, where), options),
    findMany: async ({ where, include, skip = 0, take = comments.length }) =>
      comments
        .filter((comment) => comment.photoId === where.photoId)
        .sort(newest)
        .slice(skip, skip + take)
        .map((comment) => withInclude(comment, include)),
    count: async ({ where = {} } = {}) => comments.filter((c) => matches(c, where)).length,
    create: async ({ data, include }) => {
      const now = new Date();
      const comment = { id: nextCommentId++, createdAt: now, updatedAt: now, ...data };
      comments.push(comment);
      return withInclude(comment, include);
    },
    update: async ({ where, data, include }) => {
      const comment = findIn(comments, where);
      if (!comment) throw notFound();
      Object.assign(comment, data, { updatedAt: new Date() });
      return withInclude(comment, include);
    },
    delete: async ({ where }) => {
      const comment = findIn(comments, where);
      if (!comment) throw notFound();
      comments = comments.filter((item) => item.id !== comment.id);
      return { ...comment };
    },
  },
  rating: {
    // where: { id } або складений ключ { photoId_userId: { photoId, userId } }
    findUnique: async ({ where, ...options }) => {
      const key = where.photoId_userId;
      const rating = key
        ? ratings.find((r) => r.photoId === key.photoId && r.userId === key.userId)
        : findIn(ratings, where);
      return shape(rating, options);
    },
    findMany: async ({ where = {}, include, select, skip = 0, take = ratings.length } = {}) =>
      ratings
        .filter((r) => matches(r, where))
        .sort(newest)
        .slice(skip, skip + take)
        .map((r) => shape(r, { include, select })),
    count: async ({ where = {} } = {}) => ratings.filter((r) => matches(r, where)).length,
    create: async ({ data, include }) => {
      // Як UQ (photo_id, user_id) у PostgreSQL
      if (ratings.some((r) => r.photoId === data.photoId && r.userId === data.userId)) {
        throw Object.assign(new Error('Unique constraint failed'), {
          code: 'P2002',
          meta: { target: ['photo_id', 'user_id'] },
        });
      }
      const rating = { id: nextRatingId++, createdAt: new Date(), ...data };
      ratings.push(rating);
      return withInclude(rating, include);
    },
    update: async ({ where, data, include }) => {
      const key = where.photoId_userId;
      const rating = key
        ? ratings.find((r) => r.photoId === key.photoId && r.userId === key.userId)
        : findIn(ratings, where);
      if (!rating) throw notFound();
      Object.assign(rating, data);
      return withInclude(rating, include);
    },
    delete: async ({ where }) => {
      const rating = findIn(ratings, where);
      if (!rating) throw notFound();
      ratings = ratings.filter((item) => item.id !== rating.id);
      return { ...rating };
    },
    // Лише те, що використовує ratingsService: by photoId, _avg.value, _count._all
    groupBy: async ({ where = {} }) => {
      const groups = new Map();
      for (const r of ratings.filter((item) => matches(item, where))) {
        if (!groups.has(r.photoId)) groups.set(r.photoId, []);
        groups.get(r.photoId).push(r.value);
      }
      return [...groups].map(([photoId, values]) => ({
        photoId,
        _avg: { value: values.reduce((sum, v) => sum + v, 0) / values.length },
        _count: { _all: values.length },
      }));
    },
  },
  tag: {
    // Як у PostgreSQL: унікальне name, skipDuplicates пропускає наявні (INSERT ... ON CONFLICT DO NOTHING)
    createMany: async ({ data, skipDuplicates }) => {
      let count = 0;
      for (const { name } of data) {
        if (tags.some((tag) => tag.name === name)) {
          if (!skipDuplicates) {
            throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
          }
          continue;
        }
        tags.push({ id: nextTagId++, name, createdAt: new Date() });
        count += 1;
      }
      return { count };
    },
    findMany: async ({ where } = {}) =>
      tags
        .filter((tag) => !where?.name?.in || where.name.in.includes(tag.name))
        .map((tag) => ({ ...tag })),
  },
  photoTag: {
    deleteMany: async ({ where }) => {
      const before = photoTags.length;
      photoTags = photoTags.filter((link) => link.photoId !== where.photoId);
      return { count: before - photoTags.length };
    },
    createMany: async ({ data }) => {
      for (const link of data) {
        if (photoTags.some((item) => item.photoId === link.photoId && item.tagId === link.tagId)) {
          throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
        }
        photoTags.push({ ...link });
      }
      return { count: data.length };
    },
  },
  // SQL фейкова БД не виконує: пошук перевіряється на PostgreSQL у search.db.test.js,
  // а в search.test.js цей метод підміняється через jest.spyOn
  $queryRaw: async () => {
    throw new Error('fakeDb не виконує SQL');
  },
  // Інтерактивна транзакція: у тестах відкату немає, виконуємо одразу
  $transaction: async (callback) => callback(fakeDb),
  // Для перевірок "дублікатів у БД немає"
  tagNames: () => tags.map((tag) => tag.name),
  transformedLink: {
    findMany: async ({ where }) =>
      links
        .filter((link) => link.photoId === where.photoId)
        .sort(newest)
        .map((link) => ({ ...link })),
    create: async ({ data }) => {
      const link = { id: nextLinkId++, createdAt: new Date(), ...data };
      links.push(link);
      return { ...link };
    },
  },
  tokenBlacklist: {
    findUnique: async ({ where }) => {
      const entry = blacklist.find((item) => item.jti === where.jti);
      return entry ? { ...entry } : null;
    },
    upsert: async ({ where, create }) => {
      const existing = blacklist.find((item) => item.jti === where.jti);
      if (existing) return { ...existing };
      const entry = { createdAt: new Date(), ...create };
      blacklist.push(entry);
      return { ...entry };
    },
    deleteMany: async ({ where }) => {
      const before = blacklist.length;
      blacklist = blacklist.filter((item) => item.expiresAt >= where.expiresAt.lt);
      return { count: before - blacklist.length };
    },
  },
  // Сповіщення (TASK-068). where: userId, readAt: null, id: { in }
  notification: {
    create: async ({ data }) => {
      const item = { id: nextNotificationId++, readAt: null, createdAt: new Date(), ...data };
      notifications.push(item);
      return { ...item };
    },
    findMany: async ({ where = {}, orderBy, skip = 0, take = notifications.length } = {}) =>
      notifications
        .filter((item) => matches(item, where))
        .sort(byOrder(orderBy))
        .slice(skip, skip + take)
        .map((item) => ({
          ...item,
          actor: item.actorId ? clone(users.find((u) => u.id === item.actorId)) : null,
          photo: item.photoId ? { ...photos.find((p) => p.id === item.photoId) } : null,
        })),
    count: async ({ where = {} } = {}) =>
      notifications.filter((item) => matches(item, where)).length,
    updateMany: async ({ where = {}, data }) => {
      const list = notifications.filter((item) => matches(item, where));
      list.forEach((item) => Object.assign(item, data));
      return { count: list.length };
    },
    all: () => notifications.map((item) => ({ ...item })),
    // Для тестів: прибрати сповіщення, що з'явилися під час підготовки (наприклад, досягнення)
    clear: () => {
      notifications = [];
      nextNotificationId = 1;
    },
  },
  // Досягнення (TASK-070): UQ (userId, code), як у PostgreSQL
  userAchievement: {
    findMany: async ({ where = {} } = {}) =>
      achievements.filter((item) => matches(item, where)).map((item) => ({ ...item })),
    create: async ({ data }) => {
      if (achievements.some((a) => a.userId === data.userId && a.code === data.code)) {
        throw Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
      }
      const item = { id: nextAchievementId++, createdAt: new Date(), ...data };
      achievements.push(item);
      return { ...item };
    },
  },
  $disconnect: async () => {},
  reset() {
    resets = [];
    nextResetId = 1;
    users = [];
    photos = [];
    comments = [];
    tags = [];
    photoTags = [];
    nextTagId = 1;
    links = [];
    nextId = 1;
    nextPhotoId = 1;
    nextCommentId = 1;
    nextLinkId = 1;
    blacklist = [];
    ratings = [];
    nextRatingId = 1;
    notifications = [];
    nextNotificationId = 1;
    achievements = [];
    nextAchievementId = 1;
  },
};

module.exports = fakeDb;
