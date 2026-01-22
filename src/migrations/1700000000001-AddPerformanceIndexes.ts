import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPerformanceIndexes1700000000001 implements MigrationInterface {
  name = 'AddPerformanceIndexes1700000000001';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add composite indexes for job filtering
    await queryRunner.query(`
      CREATE INDEX "idx_jobs_location_active" ON "jobs" ("location", "is_active");
    `);
    
    await queryRunner.query(`
      CREATE INDEX "idx_jobs_employment_type_active" ON "jobs" ("employment_type", "is_active");
    `);
    
    await queryRunner.query(`
      CREATE INDEX "idx_jobs_salary_range" ON "jobs" ("salary_min", "salary_max");
    `);
    
    await queryRunner.query(`
      CREATE INDEX "idx_jobs_created_at_active" ON "jobs" ("created_at" DESC, "is_active");
    `);
    
    await queryRunner.query(`
      CREATE INDEX "idx_jobs_title_description_gin" ON "jobs" USING gin (to_tsvector('english', title || ' ' || description));
    `);

    // Add indexes for applications
    await queryRunner.query(`
      CREATE INDEX "idx_applications_job_status" ON "applications" ("job_id", "status");
    `);
    
    await queryRunner.query(`
      CREATE INDEX "idx_applications_seeker_status" ON "applications" ("job_seeker_id", "status");
    `);
    
    await queryRunner.query(`
      CREATE INDEX "idx_applications_applied_at" ON "applications" ("applied_at" DESC);
    `);

    // Add indexes for users
    await queryRunner.query(`
      CREATE INDEX "idx_users_role_active" ON "users" ("role", "is_active");
    `);
    
    await queryRunner.query(`
      CREATE INDEX "idx_user_profiles_company_name" ON "user_profiles" ("company_name");
    `);

    // Add indexes for audit logs
    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_user_action" ON "audit_logs" ("user_id", "action");
    `);
    
    await queryRunner.query(`
      CREATE INDEX "idx_audit_logs_resource" ON "audit_logs" ("resource_type", "resource_id");
    `);

    // Add indexes for files
    await queryRunner.query(`
      CREATE INDEX "idx_files_owner_created" ON "files" ("owner_id", "created_at" DESC);
    `);

    // Add indexes for refresh tokens
    await queryRunner.query(`
      CREATE INDEX "idx_refresh_tokens_user_expires" ON "refresh_tokens" ("user_id", "expires_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop all the indexes we created
    await queryRunner.query(`DROP INDEX "idx_jobs_location_active"`);
    await queryRunner.query(`DROP INDEX "idx_jobs_employment_type_active"`);
    await queryRunner.query(`DROP INDEX "idx_jobs_salary_range"`);
    await queryRunner.query(`DROP INDEX "idx_jobs_created_at_active"`);
    await queryRunner.query(`DROP INDEX "idx_jobs_title_description_gin"`);
    await queryRunner.query(`DROP INDEX "idx_applications_job_status"`);
    await queryRunner.query(`DROP INDEX "idx_applications_seeker_status"`);
    await queryRunner.query(`DROP INDEX "idx_applications_applied_at"`);
    await queryRunner.query(`DROP INDEX "idx_users_role_active"`);
    await queryRunner.query(`DROP INDEX "idx_user_profiles_company_name"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_user_action"`);
    await queryRunner.query(`DROP INDEX "idx_audit_logs_resource"`);
    await queryRunner.query(`DROP INDEX "idx_files_owner_created"`);
    await queryRunner.query(`DROP INDEX "idx_refresh_tokens_user_expires"`);
  }
}