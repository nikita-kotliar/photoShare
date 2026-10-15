const request = require('supertest');
const app = require('../../src/app');

const defaultUser = {
  username: 'nikita',
  email: 'nikita@example.com',
  password: 'password123',
};

function register(agent, overrides = {}) {
  return agent.post('/api/users').send({ ...defaultUser, ...overrides });
}

function agent() {
  return request.agent(app);
}

module.exports = { app, agent, register, defaultUser };
