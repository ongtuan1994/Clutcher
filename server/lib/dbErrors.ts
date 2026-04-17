import { Prisma } from '@prisma/client';

/**
 * Maps Prisma / DB errors to HTTP responses so login/register don't only say "failed".
 */
export function mapDatabaseError(e: unknown): { status: number; error: string } | null {
  if (e instanceof Prisma.PrismaClientInitializationError) {
    return {
      status: 503,
      error:
        'Database not reachable. Start PostgreSQL (e.g. `docker compose up -d`), set DATABASE_URL in `.env` to match docker-compose, then run `npx prisma migrate deploy`.',
    };
  }
  if (e instanceof Prisma.PrismaClientKnownRequestError) {
    if (e.code === 'P1001') {
      return {
        status: 503,
        error:
          'Cannot reach the database server. Check DATABASE_URL and that PostgreSQL is running (e.g. `docker compose up -d`).',
      };
    }
  }
  if (e instanceof Error) {
    const m = e.message;
    if (/P1001|Can\'t reach database|ECONNREFUSED|connect ECONNREFUSED/i.test(m)) {
      return {
        status: 503,
        error:
          'Cannot connect to the database. Use PostgreSQL with DATABASE_URL in `.env`, start it with `docker compose up -d`, then `npx prisma migrate deploy`.',
      };
    }
    if (/invalid.*connection string|Datasource|not supported|postgresql/i.test(m) && /file:|sqlite/i.test(m)) {
      return {
        status: 503,
        error:
          'DATABASE_URL must be a PostgreSQL URL (this project no longer uses SQLite). See `.env.example` and `docker-compose.yml`.',
      };
    }
  }
  return null;
}
