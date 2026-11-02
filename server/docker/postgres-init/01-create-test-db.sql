-- 集成测试库（仅本地 compose 使用）
SELECT 'CREATE DATABASE cnm_test' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'cnm_test')\gexec
