-- Create test database if it doesn't exist
SELECT 'CREATE DATABASE job_board_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'job_board_test')\gexec