import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { UserRole } from '../src/common/types/user-role.enum';

describe('Auth Debug (e2e)', () => {
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

    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should register a user successfully', async () => {
    const userData = {
      email: 'test@example.com',
      password: 'TestPassword123!',
      role: UserRole.JOB_SEEKER,
      firstName: 'Test',
      lastName: 'User'
    };

    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(userData);

    console.log('Registration response status:', response.status);
    console.log('Registration response body:', response.body);

    if (response.status !== 201) {
      console.log('Registration error:', response.body);
    }
  });
});