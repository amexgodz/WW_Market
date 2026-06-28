const fs = require('fs');
const path = require('path');
const request = require('supertest');
const { app } = require('../dist/server');

const usersPath = path.join(__dirname, '..', 'data', 'users.json');
const skinsPath = path.join(__dirname, '..', 'data', 'skins.json');

let usersBackup = '';
let skinsBackup = '';

beforeAll(() => {
  usersBackup = fs.readFileSync(usersPath, 'utf-8');
  skinsBackup = fs.readFileSync(skinsPath, 'utf-8');
});

afterAll(() => {
  fs.writeFileSync(usersPath, usersBackup, 'utf-8');
  fs.writeFileSync(skinsPath, skinsBackup, 'utf-8');
});

describe('feature api routes', () => {
  test('likes, feed and review works', async () => {
    const agent = request.agent(app);
    const login = `r_${Date.now()}`;
    await agent.post('/api/register').send({ login, password: '1234' });
    const skins = await agent.get('/api/skins');
    const skinId = skins.body[0].id;
    const like = await agent.post(`/api/skins/${skinId}/like`);
    expect(like.status).toBe(200);
    const feed = await agent.get('/api/feed');
    expect(feed.status).toBe(200);
    const review = await agent
      .post(`/api/skins/${skinId}/reviews`)
      .send({ rating: 5, comment: 'good' });
    expect(review.status).toBe(201);
  });

  test('admin create and update product works', async () => {
    const agent = request.agent(app);
    const auth = await agent.post('/api/login').send({ login: 'owner', password: 'owner123' });
    expect(auth.status).toBe(200);
    const create = await agent.post('/api/admin/products').send({
      name: 'Test Product',
      price: 150,
      rarity: 'Rare',
      wear: 'Factory New',
      category: 'Custom',
      tags: ['test'],
    });
    expect(create.status).toBe(201);
    const update = await agent
      .put(`/api/admin/products/${create.body.id}`)
      .send({ price: 200, tags: ['test', 'updated'] });
    expect(update.status).toBe(200);
  });

  test('locale endpoints work with session', async () => {
    const agent = request.agent(app);
    await agent.post('/api/login').send({ login: 'owner', password: 'owner123' });
    const getLocale = await agent.get('/api/session-locale');
    expect(getLocale.status).toBe(200);
    const setLocale = await agent.post('/api/session-locale').send({ locale: 'en' });
    expect(setLocale.status).toBe(200);
  });
});
