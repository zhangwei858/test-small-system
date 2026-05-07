const request = require('supertest');

describe('API Tests', () => {
  let server;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
    server = require('../server');
  });

  afterAll((done) => {
    const serverInstance = server.listen();
    serverInstance.close(done);
  });

  describe('Health Check', () => {
    it('should return health status', async () => {
      const res = await request(server).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.code).toBe(200);
      expect(res.body.message).toBe('服务正常运行');
    });
  });

  describe('404 Handling', () => {
    it('should return 404 for non-existent API', async () => {
      const res = await request(server).get('/api/nonexistent');
      expect(res.statusCode).toBe(404);
      expect(res.body.code).toBe(404);
    });
  });

  describe('Rate Limiting', () => {
    it('should limit login attempts', async () => {
      for (let i = 0; i < 12; i++) {
        await request(server)
          .post('/api/users/login')
          .send({ username: 'testuser' });
      }
      
      const res = await request(server)
        .post('/api/users/login')
        .send({ username: 'testuser' });
      expect(res.body.code).toBe(429);
    });
  });
});