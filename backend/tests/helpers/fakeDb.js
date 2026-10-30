let users = [];
let photos = [];
let nextId = 1;
let nextPhotoId = 1;

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

function withInclude(photo, include = {}) {
  const result = { ...photo };
  if (include.author) {
    const author = users.find((user) => user.id === photo.authorId);
    result.author = include.author.select ? pick(author, include.author.select) : { ...author };
  }
  if (include._count) {
    result._count = { comments: 0 };
  }
  return result;
}

function findPhoto(where) {
  const [key] = Object.keys(where);
  return photos.find((photo) => photo[key] === where[key]);
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
    findUnique: async ({ where, include }) => {
      const photo = findPhoto(where);
      return photo ? withInclude(photo, include) : null;
    },
    findMany: async ({ include, skip = 0, take = photos.length } = {}) =>
      [...photos]
        .sort((a, b) => b.createdAt - a.createdAt || b.id - a.id)
        .slice(skip, skip + take)
        .map((photo) => withInclude(photo, include)),
    count: async () => photos.length,
    create: async ({ data, include }) => {
      const now = new Date();
      const photo = { id: nextPhotoId++, createdAt: now, updatedAt: now, ...data };
      photos.push(photo);
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
      return { ...photo };
    },
  },
  $disconnect: async () => {},
  reset() {
    users = [];
    photos = [];
    nextId = 1;
    nextPhotoId = 1;
  },
};

module.exports = fakeDb;
