import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DataSource } from 'typeorm';
import { UserRole } from '../src/common/types/user-role.enum';

describe('Performance Tests (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let authToken: string;

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
    
    // Clean database and setup test data
    await cleanDatabase();
    await setupPerformanceTestData();
  });

  afterAll(async () => {
    await cleanDatabase();
    await app.close();
  });

  async function cleanDatabase() {
    const entities = dataSource.entityMetadatas;
    
    for (const entity of entities) {
      const repository = dataSource.getRepository(entity.name);
      await repository.query(`TRUNCATE "${entity.tableName}" RESTART IDENTITY CASCADE;`);
    }
  }

  async function setupPerformanceTestData() {
    // Create test company
    const companyData = {
      email: 'perf-company@test.com',
      password: 'TestPassword123!',
      role: UserRole.COMPANY,
      firstName: 'Performance',
      lastName: 'Company',
      companyName: 'Performance Test Company'
    };

    const companyResponse = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send(companyData)
      .expect(201);

    authToken = companyResponse.body.accessToken;

    // Create multiple jobs for performance testing
    const jobPromises = [];
    for (let i = 0; i < 100; i++) {
      const jobData = {
        title: `Performance Test Job ${i}`,
        description: `This is a performance test job number ${i} with detailed description that includes multiple sentences to simulate real job postings. It contains information about the role, responsibilities, and requirements.`,
        requirements: `Requirement ${i}: Bachelor's degree, ${i} years of experience, knowledge of various technologies`,
        location: i % 2 === 0 ? 'New York, NY' : 'San Francisco, CA',
        employmentType: i % 3 === 0 ? 'full_time' : i % 3 === 1 ? 'part_time' : 'contract',
        salaryMin: 50000 + (i * 1000),
        salaryMax: 100000 + (i * 1000),
        salaryCurrency: 'USD'
      };

      jobPromises.push(
        request(app.getHttpServer())
          .post('/api/v1/jobs')
          .set('Authorization', `Bearer ${authToken}`)
          .send(jobData)
      );
    }

    // Execute job creation in batches to avoid overwhelming the system
    const batchSize = 10;
    for (let i = 0; i < jobPromises.length; i += batchSize) {
      const batch = jobPromises.slice(i, i + batchSize);
      await Promise.all(batch);
    }
  }

  describe('API Response Time Performance', () => {
    it('should respond to job listings within 500ms', async () => {
      const iterations = 10;
      const responseTimes: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const startTime = Date.now();
        
        await request(app.getHttpServer())
          .get('/api/v1/jobs')
          .expect(200);
        
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      console.log(`Job listings - Average response time: ${averageResponseTime}ms`);
      console.log(`Job listings - Max response time: ${maxResponseTime}ms`);

      expect(averageResponseTime).toBeLessThan(500);
      expect(maxResponseTime).toBeLessThan(1000);
    });

    it('should respond to filtered job searches within 500ms', async () => {
      const filters = [
        '?location=New York',
        '?employmentType=full_time',
        '?salaryMin=60000',
        '?location=San Francisco&employmentType=contract',
        '?salaryMin=70000&salaryMax=120000'
      ];

      for (const filter of filters) {
        const startTime = Date.now();
        
        const response = await request(app.getHttpServer())
          .get(`/api/v1/jobs${filter}`)
          .expect(200);
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Filtered search "${filter}" - Response time: ${responseTime}ms`);
        expect(responseTime).toBeLessThan(500);
        expect(response.body.data).toBeDefined();
      }
    });

    it('should handle pagination efficiently', async () => {
      const pageTests = [
        { page: 1, limit: 10 },
        { page: 1, limit: 25 },
        { page: 2, limit: 10 },
        { page: 5, limit: 5 }
      ];

      for (const test of pageTests) {
        const startTime = Date.now();
        
        const response = await request(app.getHttpServer())
          .get(`/api/v1/jobs?page=${test.page}&limit=${test.limit}`)
          .expect(200);
        
        const endTime = Date.now();
        const responseTime = endTime - startTime;

        console.log(`Pagination (page: ${test.page}, limit: ${test.limit}) - Response time: ${responseTime}ms`);
        expect(responseTime).toBeLessThan(500);
        expect(response.body.data.length).toBeLessThanOrEqual(test.limit);
        expect(response.body.meta.page).toBe(test.page);
        expect(response.body.meta.limit).toBe(test.limit);
      }
    });
  });

  describe('Concurrent Request Performance', () => {
    it('should handle multiple concurrent job listing requests', async () => {
      const concurrentRequests = 20;
      const startTime = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        request(app.getHttpServer())
          .get('/api/v1/jobs')
          .expect(200)
      );

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      console.log(`${concurrentRequests} concurrent requests completed in ${totalTime}ms`);
      console.log(`Average time per request: ${totalTime / concurrentRequests}ms`);

      expect(totalTime).toBeLessThan(3000); // All requests should complete within 3 seconds
      expect(responses).toHaveLength(concurrentRequests);
      responses.forEach(response => {
        expect(response.body.data).toBeDefined();
      });
    });

    it('should handle mixed concurrent operations', async () => {
      const startTime = Date.now();

      // Mix of read and write operations
      const promises = [
        // Read operations
        ...Array.from({ length: 10 }, () =>
          request(app.getHttpServer()).get('/api/v1/jobs')
        ),
        // Authenticated read operations
        ...Array.from({ length: 5 }, (_, i) =>
          request(app.getHttpServer())
            .get(`/api/v1/jobs?page=${i + 1}`)
        ),
        // Write operations (job creation)
        ...Array.from({ length: 3 }, (_, i) =>
          request(app.getHttpServer())
            .post('/api/v1/jobs')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              title: `Concurrent Test Job ${i}`,
              description: 'Test job for concurrent operations',
              location: 'Test Location',
              employmentType: 'full_time'
            })
        )
      ];

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      console.log(`Mixed concurrent operations completed in ${totalTime}ms`);

      expect(totalTime).toBeLessThan(4000); // Should complete within 4 seconds
      expect(responses).toHaveLength(18);
    });
  });

  describe('Database Query Performance', () => {
    it('should execute complex queries efficiently', async () => {
      // Test complex filtering with multiple conditions
      const startTime = Date.now();

      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs?location=New York&employmentType=full_time&salaryMin=60000&salaryMax=150000&page=1&limit=20')
        .expect(200);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      console.log(`Complex query execution time: ${queryTime}ms`);
      console.log(`Results returned: ${response.body.data.length}`);

      expect(queryTime).toBeLessThan(300); // Complex queries should complete within 300ms
      expect(response.body.data).toBeDefined();
      expect(response.body.meta).toHaveProperty('total');
    });

    it('should handle large result sets with pagination', async () => {
      const startTime = Date.now();

      // Request all jobs with large page size
      const response = await request(app.getHttpServer())
        .get('/api/v1/jobs?limit=50')
        .expect(200);

      const endTime = Date.now();
      const queryTime = endTime - startTime;

      console.log(`Large result set query time: ${queryTime}ms`);
      console.log(`Results returned: ${response.body.data.length}`);

      expect(queryTime).toBeLessThan(500);
      expect(response.body.data.length).toBeLessThanOrEqual(50);
      expect(response.body.meta.total).toBeGreaterThan(50);
    });
  });

  describe('Memory and Resource Usage', () => {
    it('should maintain stable memory usage during load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform multiple operations to test memory stability
      const operations = [];
      for (let i = 0; i < 50; i++) {
        operations.push(
          request(app.getHttpServer())
            .get('/api/v1/jobs?page=' + (i % 10 + 1))
            .expect(200)
        );
      }

      await Promise.all(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      console.log(`Initial heap usage: ${Math.round(initialMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`Final heap usage: ${Math.round(finalMemory.heapUsed / 1024 / 1024)}MB`);
      console.log(`Memory increase: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);

      // Memory increase should be reasonable (less than 50MB for this test)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});