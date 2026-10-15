let users = [];
let nextId = 1;

function clone(user) {
  return user ? { ...user } : null;
}

function findBy(where) {
  const [key] = Object.keys(where);
  return users.find((user) => user[key] === where[key]);
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
  $disconnect: async () => {},
  reset() {
    users = [];
    nextId = 1;
  },
};

module.exports = fakeDb;
