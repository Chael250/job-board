import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';

export const databaseConfig = (
  configService: ConfigService,
): TypeOrmModuleOptions => {
  const isTest = configService.get('NODE_ENV') === 'test';
  const isProduction = configService.get('NODE_ENV') === 'production';
  
  return {
    type: 'postgres',
    host: configService.get('DB_HOST', 'localhost'),
    port: configService.get('DB_PORT', 5432),
    username: configService.get('DB_USERNAME', 'postgres'),
    password: configService.get('DB_PASSWORD', 'password'),
    database: isTest 
      ? configService.get('DB_TEST_NAME', 'job_board_test')
      : configService.get('DB_NAME', 'job_board'),
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
    synchronize: configService.get('NODE_ENV') !== 'production',
    logging: configService.get('NODE_ENV') === 'development',
    ssl: configService.get('NODE_ENV') === 'production' ? { rejectUnauthorized: false } : false,
    dropSchema: isTest, // Drop and recreate schema for tests
    
    // Performance optimizations
    extra: {
      // Connection pool settings
      max: isProduction ? 20 : 10, // Maximum number of connections
      min: isProduction ? 5 : 2,   // Minimum number of connections
      idle: 10000,                 // Close connections after 10 seconds of inactivity
      acquire: 60000,              // Maximum time to get connection from pool
      evict: 1000,                 // Run eviction every second
      
      // Performance settings
      statement_timeout: 30000,    // 30 second query timeout
      query_timeout: 30000,        // 30 second query timeout
      connectionTimeoutMillis: 5000, // 5 second connection timeout
      idleTimeoutMillis: 30000,    // 30 second idle timeout
      
      // Enable connection pooling optimizations
      application_name: 'job_board_api',
      
      // Performance tuning for PostgreSQL
      ...(isProduction && {
        // Production-specific optimizations
        shared_preload_libraries: 'pg_stat_statements',
        log_statement: 'none',
        log_min_duration_statement: 1000, // Log slow queries (>1s)
      }),
    },
    
    // Connection retry settings
    retryAttempts: 3,
    retryDelay: 3000,
    autoLoadEntities: true,
    
    // Cache settings for better performance
    cache: isProduction ? {
      type: 'redis',
      options: {
        host: configService.get('REDIS_HOST', 'localhost'),
        port: configService.get('REDIS_PORT', 6379),
        password: configService.get('REDIS_PASSWORD'),
        db: configService.get('REDIS_CACHE_DB', 1), // Use different DB for query cache
      },
      duration: 30000, // Cache queries for 30 seconds
    } : false,
  };
};