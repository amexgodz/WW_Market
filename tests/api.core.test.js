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

describe('core api routes', () => {
  test('GET /api/skins works', async () => {
    const response = await request(app).get('/api/skins');
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  test('register/login/me/logout chain works', async () => {
    const agent = request.agent(app);
    const login = `u_${Date.now()}`;
    const register = await agent.post('/api/register').send({ login, password: '1234' });
    expect(register.status).toBe(201);
    const me = await agent.get('/api/me');
    expect(me.status).toBe(200);
    const logout = await agent.post('/api/logout');
    expect(logout.status).toBe(200);
  });

  test('buy and sell works', async () => {
    const agent = request.agent(app);
    const login = `b_${Date.now()}`;
    await agent.post('/api/register').send({ login, password: '1234' });
    const skins = await agent.get('/api/skins');
    const skinId = skins.body[0].id;
    const buy = await agent.post('/api/buy').send({ skinId });
    expect(buy.status).toBe(200);
    const sell = await agent.post('/api/sell').send({ instanceId: 0 });
    expect(sell.status).toBe(200);
  });
});
