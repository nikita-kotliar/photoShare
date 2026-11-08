let users = [];
let photos = [];
let comments = [];
let tags = [];
let photoTags = [];
let nextTagId = 1;
let nextId = 1;
let nextPhotoId = 1;
let nextCommentId = 1;

function clone(user) {
  return user ? { ...user } : null;
}

function findBy(where) {
  const [key] = Object.keys(where);
  return users.find((user) => user[key] === where[key]);
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

function newest(a, b) {
  return b.createdAt - a.createdAt || b.id - a.id;
}

function notFound() {
  return Object.assign(new Error('Record not found'), { code: 'P2025' });
}

const fakeDb = {
  user: {
    findUnique: async ({ where }) => clone(findBy(where)),
    count: async () => users.length,
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
      Object.assign(user, data, { updatedAt: new Date() });
      return clone(user);
    },
  },
  photo: {
    findUnique: async ({ where, ...options }) => shape(findPhoto(where), options),
    findMany: async ({ include, skip = 0, take = photos.length } = {}) =>
      [...photos]
        .sort(newest)
        .slice(skip, skip + take)
        .map((photo) => withInclude(photo, include)),
    count: async () => photos.length,
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
      tags.filter((tag) => !where?.name?.in || where.name.in.includes(tag.name)).map((tag) => ({ ...tag })),
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
  $disconnect: async () => {},
  reset() {
    users = [];
    photos = [];
    comments = [];
    tags = [];
    photoTags = [];
    nextTagId = 1;
    nextId = 1;
    nextPhotoId = 1;
    nextCommentId = 1;
  },
};

module.exports = fakeDb;
