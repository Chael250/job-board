import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Debug Routes (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }));

    // Set global prefix like in main.ts
    app.setGlobalPrefix('api/v1');

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should respond to root endpoint', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1')
      .expect(200);
    
    console.log('Root response:', response.body);
  });

  it('should list available routes', async () => {
    // Try different endpoints to see what's available
    const endpoints = [
      '/api/v1',
      '/api/v1/auth',
      '/api/v1/auth/register',
      '/auth/register',
      '/register'
    ];

    for (const endpoint of endpoints) {
      try {
        const response = await request(app.getHttpServer())
          .get(endpoint);
        console.log(`GET ${endpoint}: ${response.status}`);
      } catch (error) {
        console.log(`GET ${endpoint}: Error`);
      }

      try {
        const response = await request(app.getHttpServer())
          .post(endpoint)
          .send({});
        console.log(`POST ${endpoint}: ${response.status}`);
      } catch (error) {
        console.log(`POST ${endpoint}: Error`);
      }
    }
  });
});