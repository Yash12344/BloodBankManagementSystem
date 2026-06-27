// Sets a minimal, valid environment so config/env.ts passes validation during tests.
// Runs (via vitest setupFiles) before any test module is evaluated.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgresql://test:test@localhost:5432/test";
process.env.REDIS_URL ??= "redis://localhost:6379";
process.env.JWT_ACCESS_SECRET ??= "test-access-secret-0123456789";
process.env.JWT_REFRESH_SECRET ??= "test-refresh-secret-0123456789";
