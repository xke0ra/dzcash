import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { TestPrismaService, getTestJwtToken } from '../mocks/test-utils';

describe('Auth API (e2e)', () => {
  let app: INestApplication;
  let prisma: TestPrismaService;
  let authToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useClass(TestPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
    await prisma.cleanDatabase();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/auth/register', () => {
    it('should create a new user', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'e2e@test.com', password: 'password123' })
        .expect(201)
        .expect(res => {
          expect(res.body.message).toBe('Registration successful');
          expect(res.body.userId).toBeDefined();
          userId = res.body.userId;
        });
    });

    it('should reject duplicate email', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'e2e@test.com', password: 'password123' })
        .expect(409);
    });

    it('should validate email format', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'invalid-email', password: 'password123' })
        .expect(400);
    });

    it('should validate password length', () => {
      return request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'valid@test.com', password: '123' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'e2e@test.com', password: 'password123' })
        .expect(201)
        .expect(res => {
          expect(res.body.accessToken).toBeDefined();
          expect(res.body.user.email).toBe('e2e@test.com');
          authToken = res.body.accessToken;
        });
    });

    it('should reject wrong password', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'e2e@test.com', password: 'wrongpassword' })
        .expect(401);
    });

    it('should reject non-existent email', () => {
      return request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nonexistent@test.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('GET /api/users/me', () => {
    it('should return user profile with valid token', () => {
      return request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.email).toBe('e2e@test.com');
          expect(res.body.wallet).toBeDefined();
        });
    });

    it('should reject without token', () => {
      return request(app.getHttpServer())
        .get('/api/users/me')
        .expect(401);
    });

    it('should reject invalid token', () => {
      return request(app.getHttpServer())
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Wallet API', () => {
    it('should get wallet balance', () => {
      return request(app.getHttpServer())
        .get('/api/wallet/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.availableBalance).toBeDefined();
        });
    });

    it('should get empty transactions list', () => {
      return request(app.getHttpServer())
        .get('/api/wallet/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(res => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Notifications API', () => {
    it('should get notifications (empty)', () => {
      return request(app.getHttpServer())
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.items).toBeDefined();
          expect(res.body.unreadCount).toBeDefined();
        });
    });

    it('should return unread count', () => {
      return request(app.getHttpServer())
        .get('/api/notifications/unread-count')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200)
        .expect(res => {
          expect(res.body.count).toBeDefined();
        });
    });
  });

  describe('Admin API', () => {
    it('should reject non-admin access', () => {
      return request(app.getHttpServer())
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });

    it('should allow admin access', async () => {
      // Create admin user via DB
      const adminUser = await prisma.createTestUser({ email: 'admin@test.com', role: 'ADMIN' });
      const adminToken = getTestJwtToken(adminUser.id, adminUser.email, 'ADMIN');

      return request(app.getHttpServer())
        .get('/api/admin/stats')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', () => {
      return request(app.getHttpServer())
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ refreshToken: 'test-refresh-token' })
        .expect(201);
    });
  });
});
