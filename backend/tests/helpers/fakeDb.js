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

function matches(record, where = {}) {
  return Object.entries(where).every(([key, value]) => record[key] === value);
}

// where для оцінок: рівність полів або { in: [...] }
function matchesRating(record, where = {}) {
  return Object.entries(where).every(([key, value]) =>
    value && typeof value === 'object' && Array.isArray(value.in)
      ? value.in.includes(record[key])
      : record[key] === value,
  );
}

function newest(a, b) {
  return b.createdAt - a.createdAt || b.id - a.id;
}

function notFound() {
  return Object.assign(new Error('Record not found'), { code: 'P2025' });
}

const fakeDb = {
  user: {
    findUnique: async ({ where }) => clone(findBy(where)),
    findMany: async ({ where, skip = 0, take = users.length } = {}) =>
      users
        .filter((user) => matchesUser(user, where))
        .sort(newest)
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
    findMany: async ({ where, include, skip = 0, take = photos.length } = {}) =>
      photos
        .filter((photo) => matches(photo, where))
        .sort(newest)
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
      return { ...photo };
    },
  },
  comment: {
    findUnique: async ({ where, ...options }) => shape(findIn(comments, where), options),
    findMany: async ({ where, include, skip = 0, take = comments.length }) =>
      comments
        .filter((comment) => comment.photoId === where.photoId)
        .sort(newest)
        .slice(skip, skip + take)
        .map((comment) => withInclude(comment, include)),
    count: async ({ where }) => comments.filter((c) => c.photoId === where.photoId).length,
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
        .filter((r) => matchesRating(r, where))
        .sort(newest)
        .slice(skip, skip + take)
        .map((r) => shape(r, { include, select })),
    count: async ({ where = {} } = {}) => ratings.filter((r) => matchesRating(r, where)).length,
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
    delete: async ({ where }) => {
      const rating = findIn(ratings, where);
      if (!rating) throw notFound();
      ratings = ratings.filter((item) => item.id !== rating.id);
      return { ...rating };
    },
    // Лише те, що використовує ratingsService: by photoId, _avg.value, _count._all
    groupBy: async ({ where = {} }) => {
      const groups = new Map();
      for (const r of ratings.filter((item) => matchesRating(item, where))) {
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
  $disconnect: async () => {},
  reset() {
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
  },
};

module.exports = fakeDb;
