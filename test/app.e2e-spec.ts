import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { User } from '../src/users/entities/user.entity';
import { Job } from '../src/jobs/entities/job.entity';
import { Application } from '../src/applications/entities/application.entity';
import { UserRole } from '../src/common/types/user-role.enum';

describe('Job Board Application (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authTokens: {
    jobSeeker: { accessToken: string; refreshToken: string };
    company: { accessToken: string; refreshToken: string };
    admin: { accessToken: string; refreshToken: string };
  };
  let testUsers: {
    jobSeeker: User;
    company: User;
    admin: User;
  };
  let testJob: Job;

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

    dataSource = moduleFixture.get<DataSource>(DataSource);
    
    // Clean database before tests
    await cleanDatabase();
    
    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  async function cleanDatabase() {
    if (!dataSource || !dataSource.isInitialized) {
      return;
    }
    
    const entities = dataSource.entityMetadatas;
    
    // Disable foreign key checks temporarily
    await dataSource.query('SET session_replication_role = replica;');
    
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.query(`TRUNCATE "${entity.tableName}" RESTART IDENTITY CASCADE;`);
    }
    
    // Re-enable foreign key checks
    await dataSource.query('SET session_replication_role = DEFAULT;');
  }

  async function setupTestData() {
    // Register test users
    const jobSeekerData = {
      email: 'jobseeker@test.com',
      password: 'TestPassword123!',
      role: UserRole.JOB_SEEKER,
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      location: 'New York, NY'
    };

    const companyData = {
      email: 'company@test.com',
      password: 'TestPassword123!',
      role: UserRole.COMPANY,
      firstName: 'Jane',
      lastName: 'Smith',
      companyName: 'Test Company Inc',
      companyDescription: 'A test company for integration testing'
    };

    const adminData = {
      email: 'admin@test.com',
      password: 'TestPassword123!',
      role: UserRole.ADMIN,
      firstName: 'Admin',
      lastName: 'User'
    };

    // Register and authenticate users
    const jobSeekerResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(jobSeekerData)
      .expect(201);

    const companyResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(companyData)
      .expect(201);

    const adminResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(adminData)
      .expect(201);

    authTokens = {
      jobSeeker: {
        accessToken: jobSeekerResponse.body.accessToken,
        refreshToken: jobSeekerResponse.body.refreshToken
      },
      company: {
        accessToken: companyResponse.body.accessToken,
        refreshToken: companyResponse.body.refreshToken
      },
      admin: {
        accessToken: adminResponse.body.accessToken,
        refreshToken: adminResponse.body.refreshToken
      }
    };

    testUsers = {
      jobSeeker: jobSeekerResponse.body.user,
      company: companyResponse.body.user,
      admin: adminResponse.body.user
    };
  }

  describe('Authentication Flow', () => {
    it('should complete full authentication workflow', async () => {
      const startTime = Date.now();

      // Test login
      const loginResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'jobseeker@test.com',
          password: 'TestPassword123!'
        })
        .expect(200);

      expect(loginResponse.body).toHaveProperty('accessToken');
      expect(loginResponse.body).toHaveProperty('refreshToken');
      expect(loginResponse.body.user.email).toBe('jobseeker@test.com');

      // Test token refresh
      const refreshResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/refresh')
        .send({
          refreshToken: loginResponse.body.refreshToken
        })
        .expect(200);

      expect(refreshResponse.body).toHaveProperty('accessToken');
      expect(refreshResponse.body).toHaveProperty('refreshToken');

      // Test protected endpoint access
      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${refreshResponse.body.accessToken}`)
        .expect(200);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle authentication failures correctly', async () => {
      // Test invalid credentials
      await request(app.getHttpServer())
        .post('/api/v1/auth/login')
        .send({
          email: 'jobseeker@test.com',
          password: 'WrongPassword'
        })
        .expect(401);

      // Test invalid token
      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('Job Posting and Management Flow', () => {
    it('should complete full job management workflow', async () => {
      const startTime = Date.now();

      // Create job as company
      const jobData = {
        title: 'Senior Software Engineer',
        description: 'We are looking for a senior software engineer with 5+ years of experience.',
        requirements: 'Bachelor\'s degree in Computer Science, 5+ years experience with Node.js',
        location: 'San Francisco, CA',
        employmentType: 'full_time',
        salaryMin: 120000,
        salaryMax: 180000,
        salaryCurrency: 'USD'
      };

      const createJobResponse = await request(app.getHttpServer())
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${authTokens.company.accessToken}`)
        .send(jobData)
        .expect(201);

      testJob = createJobResponse.body;
      expect(testJob.title).toBe(jobData.title);
      expect(testJob.companyId).toBe(testUsers.company.id);

      // Update job
      const updateData = {
        title: 'Senior Software Engineer - Updated',
        salaryMax: 200000
      };

      const updateResponse = await request(app.getHttpServer())
        .put(`/api/v1/jobs/${testJob.id}`)
        .set('Authorization', `Bearer ${authTokens.company.accessToken}`)
        .send(updateData)
        .expect(200);

      expect(updateResponse.body.title).toBe(updateData.title);
      expect(updateResponse.body.salaryMax).toBe(updateData.salaryMax);

      // Test job visibility (public access)
      const publicJobResponse = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${testJob.id}`)
        .expect(200);

      expect(publicJobResponse.body.id).toBe(testJob.id);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(1500); // Should complete within 1.5 seconds
    });

    it('should enforce job ownership correctly', async () => {
      // Try to update job as different company (should fail)
      const otherCompanyData = {
        email: 'other@company.com',
        password: 'TestPassword123!',
        role: UserRole.COMPANY,
        firstName: 'Other',
        lastName: 'Company',
        companyName: 'Other Company'
      };

      const otherCompanyResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(otherCompanyData)
        .expect(201);

      await request(app.getHttpServer())
        .put(`/api/v1/jobs/${testJob.id}`)
        .set('Authorization', `Bearer ${otherCompanyResponse.body.accessToken}`)
        .send({ title: 'Hacked Title' })
        .expect(403);
    });
  });

  describe('Job Discovery and Filtering Flow', () => {
    it('should handle job search and filtering correctly', async () => {
      const startTime = Date.now();

      // Create additional test jobs for filtering
      const jobs = [
        {
          title: 'Frontend Developer',
          description: 'React developer needed',
          location: 'New York, NY',
          employmentType: 'full_time',
          salaryMin: 80000,
          salaryMax: 120000
        },
        {
          title: 'Backend Developer',
          description: 'Node.js developer needed',
          location: 'Austin, TX',
          employmentType: 'contract',
          salaryMin: 90000,
          salaryMax: 130000
        }
      ];

      for (const jobData of jobs) {
        await request(app.getHttpServer())
          .post('/api/v1/jobs')
          .set('Authorization', `Bearer ${authTokens.company.accessToken}`)
          .send(jobData)
          .expect(201);
      }

      // Test job listing (public)
      const listResponse = await request(app.getHttpServer())
        .get('/api/v1/jobs')
        .expect(200);

      expect(listResponse.body.data).toHaveLength(3); // 3 jobs total
      expect(listResponse.body.meta).toHaveProperty('total');
      expect(listResponse.body.meta).toHaveProperty('page');

      // Test location filtering
      const locationFilterResponse = await request(app.getHttpServer())
        .get('/api/v1/jobs?location=New York')
        .expect(200);

      expect(locationFilterResponse.body.data).toHaveLength(1);
      expect(locationFilterResponse.body.data[0].location).toContain('New York');

      // Test employment type filtering
      const typeFilterResponse = await request(app.getHttpServer())
        .get('/api/v1/jobs?employmentType=full_time')
        .expect(200);

      expect(typeFilterResponse.body.data).toHaveLength(2);

      // Test salary filtering
      const salaryFilterResponse = await request(app.getHttpServer())
        .get('/api/v1/jobs?salaryMin=100000')
        .expect(200);

      expect(salaryFilterResponse.body.data.length).toBeGreaterThan(0);

      // Test pagination
      const paginationResponse = await request(app.getHttpServer())
        .get('/api/v1/jobs?page=1&limit=2')
        .expect(200);

      expect(paginationResponse.body.data).toHaveLength(2);
      expect(paginationResponse.body.meta.page).toBe(1);
      expect(paginationResponse.body.meta.limit).toBe(2);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });
  });

  describe('Application Submission and Management Flow', () => {
    it('should complete full application workflow', async () => {
      const startTime = Date.now();

      // Submit application as job seeker
      const applicationData = {
        jobId: testJob.id,
        coverLetter: 'I am very interested in this position and believe my skills would be a great fit.'
      };

      const submitResponse = await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${authTokens.jobSeeker.accessToken}`)
        .send(applicationData)
        .expect(201);

      expect(submitResponse.body.jobId).toBe(testJob.id);
      expect(submitResponse.body.jobSeekerId).toBe(testUsers.jobSeeker.id);
      expect(submitResponse.body.status).toBe('applied');

      const applicationId = submitResponse.body.id;

      // Test duplicate application prevention
      await request(app.getHttpServer())
        .post('/api/v1/applications')
        .set('Authorization', `Bearer ${authTokens.jobSeeker.accessToken}`)
        .send(applicationData)
        .expect(409); // Conflict

      // View applications as job seeker
      const jobSeekerAppsResponse = await request(app.getHttpServer())
        .get('/api/v1/applications')
        .set('Authorization', `Bearer ${authTokens.jobSeeker.accessToken}`)
        .expect(200);

      expect(jobSeekerAppsResponse.body.data).toHaveLength(1);
      expect(jobSeekerAppsResponse.body.data[0].id).toBe(applicationId);

      // View applications as company
      const companyAppsResponse = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${testJob.id}/applications`)
        .set('Authorization', `Bearer ${authTokens.company.accessToken}`)
        .expect(200);

      expect(companyAppsResponse.body.data).toHaveLength(1);
      expect(companyAppsResponse.body.data[0].id).toBe(applicationId);

      // Update application status as company
      const statusUpdateResponse = await request(app.getHttpServer())
        .put(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${authTokens.company.accessToken}`)
        .send({ status: 'reviewed' })
        .expect(200);

      expect(statusUpdateResponse.body.status).toBe('reviewed');

      // Test invalid status transition
      await request(app.getHttpServer())
        .put(`/api/v1/applications/${applicationId}`)
        .set('Authorization', `Bearer ${authTokens.company.accessToken}`)
        .send({ status: 'accepted' }) // Skip shortlisted
        .expect(400);

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should enforce application access control', async () => {
      // Create another company and try to access applications
      const otherCompanyData = {
        email: 'other2@company.com',
        password: 'TestPassword123!',
        role: UserRole.COMPANY,
        firstName: 'Other2',
        lastName: 'Company2',
        companyName: 'Other Company 2'
      };

      const otherCompanyResponse = await request(app.getHttpServer())
        .post('/api/v1/auth/register')
        .send(otherCompanyData)
        .expect(201);

      // Try to access applications for job they don't own
      await request(app.getHttpServer())
        .get(`/api/v1/jobs/${testJob.id}/applications`)
        .set('Authorization', `Bearer ${otherCompanyResponse.body.accessToken}`)
        .expect(403);
    });
  });

  describe('Admin Management Flow', () => {
    it('should complete admin management workflow', async () => {
      const startTime = Date.now();

      // List all users as admin
      const usersResponse = await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${authTokens.admin.accessToken}`)
        .expect(200);

      expect(usersResponse.body.data.length).toBeGreaterThan(0);

      // Suspend a user
      const suspendResponse = await request(app.getHttpServer())
        .put(`/api/v1/admin/users/${testUsers.jobSeeker.id}`)
        .set('Authorization', `Bearer ${authTokens.admin.accessToken}`)
        .send({ isActive: false })
        .expect(200);

      expect(suspendResponse.body.isActive).toBe(false);

      // Test suspended user cannot access protected endpoints
      await request(app.getHttpServer())
        .get('/api/v1/users/profile')
        .set('Authorization', `Bearer ${authTokens.jobSeeker.accessToken}`)
        .expect(403);

      // Reactivate user
      await request(app.getHttpServer())
        .put(`/api/v1/admin/users/${testUsers.jobSeeker.id}`)
        .set('Authorization', `Bearer ${authTokens.admin.accessToken}`)
        .send({ isActive: true })
        .expect(200);

      // List all jobs as admin
      const jobsResponse = await request(app.getHttpServer())
        .get('/api/v1/admin/jobs')
        .set('Authorization', `Bearer ${authTokens.admin.accessToken}`)
        .expect(200);

      expect(jobsResponse.body.data.length).toBeGreaterThan(0);

      // View audit logs
      const auditResponse = await request(app.getHttpServer())
        .get('/api/v1/admin/audit')
        .set('Authorization', `Bearer ${authTokens.admin.accessToken}`)
        .expect(200);

      expect(auditResponse.body.data).toBeDefined();

      const endTime = Date.now();
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should enforce admin-only access', async () => {
      // Try admin endpoints as regular user
      await request(app.getHttpServer())
        .get('/api/v1/admin/users')
        .set('Authorization', `Bearer ${authTokens.jobSeeker.accessToken}`)
        .expect(403);

      await request(app.getHttpServer())
        .get('/api/v1/admin/jobs')
        .set('Authorization', `Bearer ${authTokens.company.accessToken}`)
        .expect(403);
    });
  });

  describe('Performance Requirements', () => {
    it('should meet API response time requirements', async () => {
      const endpoints = [
        { method: 'GET', path: '/api/v1/jobs', auth: false },
        { method: 'GET', path: '/api/v1/users/profile', auth: true, token: authTokens.jobSeeker.accessToken },
        { method: 'GET', path: '/api/v1/applications', auth: true, token: authTokens.jobSeeker.accessToken },
      ];

      for (const endpoint of endpoints) {
        const startTime = Date.now();
        
        const request_builder = request(app.getHttpServer())[endpoint.method.toLowerCase()](endpoint.path);
        
        if (endpoint.auth) {
          request_builder.set('Authorization', `Bearer ${endpoint.token}`);
        }
        
        await request_builder.expect(200);
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;
        
        expect(responseTime).toBeLessThan(500); // Should respond within 500ms
      }
    });

    it('should handle concurrent requests efficiently', async () => {
      const startTime = Date.now();
      
      // Create 10 concurrent requests
      const promises = Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .get('/api/v1/jobs')
          .expect(200)
      );

      await Promise.all(promises);
      
      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      expect(totalTime).toBeLessThan(2000); // All 10 requests should complete within 2 seconds
    });
  });

  describe('Security and Error Handling', () => {
    it('should handle security scenarios correctly', async () => {
      // Test rate limiting (if implemented)
      // Note: This test might need adjustment based on actual rate limiting configuration
      
      // Test SQL injection prevention
      await request(app.getHttpServer())
        .get('/api/v1/jobs?location=\'; DROP TABLE jobs; --')
        .expect(200); // Should not crash, should sanitize input

      // Test XSS prevention
      const xssPayload = {
        title: '<script>alert("xss")</script>',
        description: 'Normal description',
        location: 'Test Location',
        employmentType: 'full_time'
      };

      const xssResponse = await request(app.getHttpServer())
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${authTokens.company.accessToken}`)
        .send(xssPayload)
        .expect(400); // Should reject malicious input

      expect(xssResponse.body.message).toContain('validation');
    });

    it('should return consistent error responses', async () => {
      // Test 404 error format
      const notFoundResponse = await request(app.getHttpServer())
        .get('/api/v1/jobs/00000000-0000-0000-0000-000000000000')
        .expect(404);

      expect(notFoundResponse.body).toHaveProperty('error');
      expect(notFoundResponse.body.error).toHaveProperty('message');
      expect(notFoundResponse.body.error).toHaveProperty('timestamp');

      // Test validation error format
      const validationResponse = await request(app.getHttpServer())
        .post('/api/v1/jobs')
        .set('Authorization', `Bearer ${authTokens.company.accessToken}`)
        .send({}) // Empty body should trigger validation errors
        .expect(400);

      expect(validationResponse.body).toHaveProperty('error');
      expect(validationResponse.body.error).toHaveProperty('message');
    });
  });
});