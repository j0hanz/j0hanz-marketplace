# Node.js Backend Implementation Playbook

Blueprints for `nodejs-backend-patterns`, sectioned in step order: `fail-fast` validation, `layered` DI, `pooled` transactions, `envelope` errors, `drain` shutdown.

## 1. Fail-Fast Schema Validation

Zod schemas are the single source of truth for route contracts; DTO types are inferred from them. Controllers `safeParse` incoming payloads before delegating (see section 2) and return 400 with the failure envelope on parse failure.

```typescript
// schemas/user.schemas.ts
import { z } from 'zod';

export const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
});

export type CreateUserDTO = z.infer<typeof createUserSchema>;
```

## 2. Layered Architecture & Dependency Injection

```typescript
// types/user.types.ts
export interface UserEntity {
  id: string;
  email: string;
  name: string;
  created_at: Date;
}

// repositories/user.repository.ts
import { Pool } from 'pg';
import { CreateUserDTO } from '../schemas/user.schemas';
import { UserEntity } from '../types/user.types';

export class UserRepository {
  constructor(private readonly db: Pool) {}

  async create(data: CreateUserDTO): Promise<UserEntity> {
    const query = `
      INSERT INTO users (email, name)
      VALUES ($1, $2)
      RETURNING id, email, name, created_at
    `;
    const { rows } = await this.db.query<UserEntity>(query, [data.email, data.name]);
    return rows[0];
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    const query = 'SELECT id, email, name, created_at FROM users WHERE email = $1';
    const { rows } = await this.db.query<UserEntity>(query, [email]);
    return rows[0] || null;
  }
}

// services/user.service.ts
import { UserRepository } from '../repositories/user.repository';
import { CreateUserDTO } from '../schemas/user.schemas';
import { UserEntity } from '../types/user.types';
import { ConflictError } from '../utils/errors';

export class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async registerUser(dto: CreateUserDTO): Promise<UserEntity> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictError(`User with email ${dto.email} already exists`);
    }
    return this.userRepo.create(dto);
  }
}

// controllers/user.controller.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { UserService } from '../services/user.service';
import { createUserSchema } from '../schemas/user.schemas';

export class UserController {
  constructor(private readonly userService: UserService) {}

  async handleRegister(req: FastifyRequest, reply: FastifyReply) {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply.status(400).send({
        status: 'error',
        code: 'VALIDATION_ERROR',
        message: 'Invalid request data',
      });
    }
    const user = await this.userService.registerUser(parsed.data);
    return reply.status(201).send({ status: 'success', data: user });
  }
}
```

### Dependency Injection Container

```typescript
// di/container.ts
import { Pool } from 'pg';
import { UserRepository } from '../repositories/user.repository';
import { UserService } from '../services/user.service';
import { UserController } from '../controllers/user.controller';

export class AppContainer {
  readonly pool: Pool;
  readonly userRepository: UserRepository;
  readonly userService: UserService;
  readonly userController: UserController;

  constructor(pool: Pool) {
    this.pool = pool;
    this.userRepository = new UserRepository(this.pool);
    this.userService = new UserService(this.userRepository);
    this.userController = new UserController(this.userService);
  }
}
```

## 3. Pooled Connections & Transactions

Explicit pool limits and timeouts:

```typescript
// db/pool.ts
import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});
```

Transaction helper guaranteeing client checkout, transaction boundaries (`BEGIN`, `COMMIT`, `ROLLBACK`), and client release in all execution paths. A failed `ROLLBACK` never masks the original error:

```typescript
// db/transaction.ts
import { Pool, PoolClient } from 'pg';

export async function runInTransaction<T>(
  pool: Pool,
  action: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await action(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Original error takes precedence over rollback failure.
    }
    throw err;
  } finally {
    client.release();
  }
}
```

## 4. Envelope Error Model

Typed error hierarchy with centralized formatting. Public responses carry only `status`, `code`, and `message`; internal detail stays in logs.

```typescript
// utils/errors.ts
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly errorCode = 'VALIDATION_ERROR';
}

export class UnauthorizedError extends AppError {
  readonly statusCode = 401;
  readonly errorCode = 'UNAUTHORIZED';
}

export class ForbiddenError extends AppError {
  readonly statusCode = 403;
  readonly errorCode = 'FORBIDDEN';
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly errorCode = 'NOT_FOUND';
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly errorCode = 'CONFLICT';
}

// middleware/error-handler.ts (Fastify)
import { FastifyInstance, FastifyError, FastifyRequest, FastifyReply } from 'fastify';
import { AppError } from '../utils/errors';

export function setupErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send({
        status: 'error',
        code: error.errorCode,
        message: error.message,
      });
    }

    request.log.error({ err: error }, 'Unhandled server error');

    const isProd = process.env.NODE_ENV === 'production';
    return reply.status(500).send({
      status: 'error',
      code: 'INTERNAL_SERVER_ERROR',
      message: isProd ? 'Internal server error' : error.message,
    });
  });
}
```

This handler covers errors thrown inside Fastify's request lifecycle. Process-level `unhandledRejection` is a separate concern; register a process handler only if the deployment requires it.

## 5. Drain Lifecycle

Coordinates signal handling, HTTP listener shutdown, in-flight connection draining, and database pool termination. The force-kill timer is unref'd so it never keeps the event loop alive on its own.

```typescript
// lifecycle/shutdown.ts
import { FastifyInstance } from 'fastify';
import { Pool } from 'pg';

interface ShutdownDependencies {
  app: FastifyInstance;
  dbPool: Pool;
  timeoutMs?: number;
}

export function registerGracefulShutdown({
  app,
  dbPool,
  timeoutMs = 10000,
}: ShutdownDependencies): void {
  let isShuttingDown = false;

  const shutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    app.log.info({ signal }, 'Starting graceful drain shutdown');

    const forceKillTimer = setTimeout(() => {
      app.log.error('Graceful shutdown timed out. Forcing termination.');
      process.exit(1);
    }, timeoutMs);
    forceKillTimer.unref();

    try {
      // 1. Stop accepting new HTTP requests and finish in-flight
      await app.close();
      app.log.info('HTTP server closed, connections drained');

      // 2. Drain and close database pool
      await dbPool.end();
      app.log.info('Database pool drained and closed');

      clearTimeout(forceKillTimer);
      process.exit(0);
    } catch (err) {
      app.log.error({ err }, 'Error occurred during graceful shutdown');
      clearTimeout(forceKillTimer);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
```
