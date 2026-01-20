
import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialSchema1700000000000 implements MigrationInterface {
  name = 'CreateInitialSchema1700000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable UUID extension
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    // Create users table
    await queryRunner.query(`
      CREATE TABLE "users" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "email" character varying(255) NOT NULL,
        "password_hash" character varying(255) NOT NULL,
        "role" character varying(20) NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_users_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_users_email" UNIQUE ("email"),
        CONSTRAINT "CHK_users_role" CHECK ("role" IN ('admin', 'company', 'job_seeker'))
      )
    `);

    // Create indexes for users table
    await queryRunner.query(`CREATE INDEX "IDX_users_email" ON "users" ("email")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_role" ON "users" ("role")`);
    await queryRunner.query(`CREATE INDEX "IDX_users_is_active" ON "users" ("is_active")`);

    // Create user_profiles table
    await queryRunner.query(`
      CREATE TABLE "user_profiles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "first_name" character varying(100) NOT NULL,
        "last_name" character varying(100) NOT NULL,
        "phone" character varying(20),
        "location" character varying(255),
        "resume_url" character varying(500),
        "company_name" character varying(255),
        "company_description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_profiles_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_profiles_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_user_profiles_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for user_profiles table
    await queryRunner.query(`CREATE INDEX "IDX_user_profiles_user_id" ON "user_profiles" ("user_id")`);

    // Create jobs table
    await queryRunner.query(`
      CREATE TABLE "jobs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "title" character varying(255) NOT NULL,
        "description" text NOT NULL,
        "requirements" text,
        "location" character varying(255) NOT NULL,
        "employment_type" character varying(20) NOT NULL,
        "salary_min" integer,
        "salary_max" integer,
        "salary_currency" character varying(3) NOT NULL DEFAULT 'USD',
        "company_id" uuid NOT NULL,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "closed_at" TIMESTAMP,
        CONSTRAINT "PK_jobs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_jobs_company_id" FOREIGN KEY ("company_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_jobs_employment_type" CHECK ("employment_type" IN ('full_time', 'part_time', 'contract', 'internship')),
        CONSTRAINT "CHK_jobs_salary_range" CHECK ("salary_min" IS NULL OR "salary_max" IS NULL OR "salary_min" <= "salary_max")
      )
    `);

    // Create indexes for jobs table
    await queryRunner.query(`CREATE INDEX "IDX_jobs_company_id" ON "jobs" ("company_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_location" ON "jobs" ("location")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_employment_type" ON "jobs" ("employment_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_is_active" ON "jobs" ("is_active")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_created_at" ON "jobs" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_jobs_salary_range" ON "jobs" ("salary_min", "salary_max")`);

    // Create applications table
    await queryRunner.query(`
      CREATE TABLE "applications" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "job_id" uuid NOT NULL,
        "job_seeker_id" uuid NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'applied',
        "cover_letter" text,
        "resume_url" character varying(500),
        "applied_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "reviewed_at" TIMESTAMP,
        "reviewed_by" uuid,
        CONSTRAINT "PK_applications_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_applications_job_seeker" UNIQUE ("job_id", "job_seeker_id"),
        CONSTRAINT "FK_applications_job_id" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_applications_job_seeker_id" FOREIGN KEY ("job_seeker_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_applications_reviewed_by" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "CHK_applications_status" CHECK ("status" IN ('applied', 'reviewed', 'shortlisted', 'accepted', 'rejected'))
      )
    `);

    // Create indexes for applications table
    await queryRunner.query(`CREATE INDEX "IDX_applications_job_id" ON "applications" ("job_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_applications_job_seeker_id" ON "applications" ("job_seeker_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_applications_status" ON "applications" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_applications_applied_at" ON "applications" ("applied_at")`);

    // Create files table
    await queryRunner.query(`
      CREATE TABLE "files" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "original_name" character varying(255) NOT NULL,
        "stored_name" character varying(255) NOT NULL,
        "mime_type" character varying(100) NOT NULL,
        "size_bytes" integer NOT NULL,
        "owner_id" uuid NOT NULL,
        "storage_path" character varying(500) NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_files_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_files_owner_id" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_files_size" CHECK ("size_bytes" > 0),
        CONSTRAINT "CHK_files_mime_type" CHECK ("mime_type" IN ('application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'))
      )
    `);

    // Create indexes for files table
    await queryRunner.query(`CREATE INDEX "IDX_files_owner_id" ON "files" ("owner_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_files_created_at" ON "files" ("created_at")`);

    // Create refresh_tokens table
    await queryRunner.query(`
      CREATE TABLE "refresh_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "token_hash" character varying(255) NOT NULL,
        "expires_at" TIMESTAMP NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "revoked_at" TIMESTAMP,
        CONSTRAINT "PK_refresh_tokens_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_refresh_tokens_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for refresh_tokens table
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_user_id" ON "refresh_tokens" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_expires_at" ON "refresh_tokens" ("expires_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash")`);

    // Create audit_logs table
    await queryRunner.query(`
      CREATE TABLE "audit_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid,
        "action" character varying(100) NOT NULL,
        "resource_type" character varying(50) NOT NULL,
        "resource_id" uuid,
        "details" jsonb,
        "ip_address" inet,
        "user_agent" text,
        "endpoint" character varying(500),
        "http_method" character varying(10),
        "status_code" integer,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_audit_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "FK_audit_logs_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes for audit_logs table
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_user_id" ON "audit_logs" ("user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_action" ON "audit_logs" ("action")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_resource_type" ON "audit_logs" ("resource_type")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_created_at" ON "audit_logs" ("created_at")`);
    await queryRunner.query(`CREATE INDEX "IDX_audit_logs_resource_id" ON "audit_logs" ("resource_id")`);

    // Create notification_logs table
    await queryRunner.query(`
      CREATE TABLE "notification_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "to" character varying(255) NOT NULL,
        "template" character varying(100) NOT NULL,
        "status" character varying(20) NOT NULL DEFAULT 'pending',
        "attempts" integer NOT NULL DEFAULT 0,
        "last_attempt" TIMESTAMP,
        "sent_at" TIMESTAMP,
        "error" text,
        "data" jsonb,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_notification_logs_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_notification_logs_status" CHECK ("status" IN ('pending', 'sent', 'failed', 'retrying'))
      )
    `);

    // Create indexes for notification_logs table
    await queryRunner.query(`CREATE INDEX "IDX_notification_logs_to" ON "notification_logs" ("to")`);
    await queryRunner.query(`CREATE INDEX "IDX_notification_logs_template" ON "notification_logs" ("template")`);
    await queryRunner.query(`CREATE INDEX "IDX_notification_logs_status" ON "notification_logs" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_notification_logs_created_at" ON "notification_logs" ("created_at")`);

    // Create user_notification_preferences table
    await queryRunner.query(`
      CREATE TABLE "user_notification_preferences" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "application_status_changes" boolean NOT NULL DEFAULT true,
        "new_applications" boolean NOT NULL DEFAULT true,
        "job_posted" boolean NOT NULL DEFAULT true,
        "account_suspended" boolean NOT NULL DEFAULT true,
        "email_notifications" boolean NOT NULL DEFAULT true,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_notification_preferences_id" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_user_notification_preferences_user_id" UNIQUE ("user_id"),
        CONSTRAINT "FK_user_notification_preferences_user_id" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for user_notification_preferences table
    await queryRunner.query(`CREATE INDEX "IDX_user_notification_preferences_user_id" ON "user_notification_preferences" ("user_id")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order to handle foreign key constraints
    await queryRunner.query(`DROP TABLE "user_notification_preferences"`);
    await queryRunner.query(`DROP TABLE "notification_logs"`);
    await queryRunner.query(`DROP TABLE "audit_logs"`);
    await queryRunner.query(`DROP TABLE "refresh_tokens"`);
    await queryRunner.query(`DROP TABLE "files"`);
    await queryRunner.query(`DROP TABLE "applications"`);
    await queryRunner.query(`DROP TABLE "jobs"`);
    await queryRunner.query(`DROP TABLE "user_profiles"`);
    await queryRunner.query(`DROP TABLE "users"`);
    
    // Drop UUID extension if needed (optional, as other databases might use it)
    // await queryRunner.query(`DROP EXTENSION IF EXISTS "uuid-ossp"`);
  }
}