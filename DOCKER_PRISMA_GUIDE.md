# Comprehensive Developer Guide: Docker & Prisma Setup

This guide breaks down **Docker container networking & persistence** and **Prisma ORM setup with Bun & PostgreSQL**, including the exact pitfalls encountered in multi-service architectures (Backend + Worker + Queue + DB).

---

# Part 1: Docker for Developers

## 1. Mental Model: What is a Container?
A Docker container is an isolated process with its own network stack, filesystem, and environment.

```mermaid
flowchart LR
    subgraph Host["Your Host Machine (Windows / Mac / Linux)"]
        subgraph App["Your Node/Bun App"]
            direction TB
            AppCode["backend (localhost:5433)"]
        end
        HostPort["Port 5433"]
    end

    subgraph Container["Docker Container (online_compiler_db)"]
        ContPort["Port 5432 (Postgres Default)"]
        ContProcess["Postgres Server Engine"]
    end

    AppCode -->|Connects to| HostPort
    HostPort -.->|Port Forward: -p 5433:5432| ContPort
    ContPort --> ContProcess
```

---

## 2. Port Mapping: The `-p <Host>:<Container>` Rule
One of the most frequent Docker bugs is running a container without exposing its ports.

- **`docker run -p 5432:5432 postgres`**
  - **Left (`5432`)**: The port open on your computer (Host / Windows).
  - **Right (`5432`)**: The port inside the container where PostgreSQL listens.
- **Port Conflict Fix**:
  If you already have another Postgres container using `5432`, map to a different host port:
  ```bash
  docker run -p 5433:5432 postgres
  ```
  Now your host connects via `localhost:5433`.

### How to Inspect Ports
```bash
docker ps
```
- If you see `5432/tcp` (with **no arrow `->`**): The port is **internal only**; your host machine **cannot** connect.
- If you see `0.0.0.0:5433->5432/tcp`: The port is properly mapped to host port `5433`.

---

## 3. Container Lifecycle & Data Persistence

### Stopping vs. Removing:
| Command | What it does | Data status |
| :--- | :--- | :--- |
| `docker stop <name>` | Shuts down container process | All data intact inside container layer |
| `docker start <name>` | Starts previously stopped container | All data intact |
| `docker restart <name>` | Reboots container | All data intact |
| `docker rm <name>` | Deletes container metadata | **Destroys container layer** |

### Where Does Data Live?
When running databases (`postgres`, `mysql`, `mongo`), data written inside the container goes to a volume directory (e.g., `/var/lib/postgresql/data`).

- **Anonymous Volume** (default when you run without `-v`):
  Docker assigns an automatic hash (e.g., `14dcb8ef...`). If you delete the container with `docker rm`, the data can become orphaned or lost.
- **Named Volume (Recommended for Developers)**:
  ```bash
  docker run --name pg_db -v pgdata:/var/lib/postgresql/data -p 5432:5432 -d postgres:latest
  ```
  Even if you run `docker rm pg_db`, the volume `pgdata` stays intact! You can attach it to a brand-new container anytime:
  ```bash
  docker volume ls
  docker run --name pg_db_v2 -v pgdata:/var/lib/postgresql/data -p 5432:5432 -d postgres:latest
  ```

---

## 4. Useful Docker Commands Cheat Sheet

```bash
# Check running containers
docker ps

# Check all containers (including stopped)
docker ps -a

# View container logs
docker logs -f <container_name>

# Execute an interactive psql shell inside a Postgres container
docker exec -it <container_name> psql -U postgres

# Inspect mounted volumes & environment
docker inspect <container_name> --format "{{json .Mounts}}"

# Stop and remove all stopped containers safely
docker container prune
```

---

# Part 2: Prisma ORM Setup (Modern / Bun Ecosystem)

## 1. Understanding Prisma Components

```mermaid
flowchart TD
    Schema["prisma/schema.prisma\n(Data models & Enums)"] --> Push["bun run prisma db push\n(Sync schema to Database)"]
    Push --> DB[(PostgreSQL Database)]
    Schema --> Gen["bun run prisma generate\n(Creates TypeScript Client)"]
    Gen --> Client["src/generated/prisma\n(Typed DB Methods)"]
    Client --> App["Application Code\n(db.submissions.create)"]
```

1. **`schema.prisma`**: Single source of truth for your database models and types.
2. **`prisma.config.ts`** (Prisma 6 / 7+): Configuration file defining schema paths, datasource credentials, and migrations.
3. **Prisma Client**: The auto-generated type-safe SDK for querying your database in TypeScript.

---

## 2. Setting Up Connection Strings

Format of `DATABASE_URL`:
```text
postgresql://<USER>:<PASSWORD>@<HOST>:<PORT>/<DATABASE>?schema=public
```

Example for our container:
```env
DATABASE_URL="postgresql://postgres:bhashivpaw098@localhost:5433/online_compiler"
```

---

## 3. The Bun + Prisma CLI Gotcha

### The Issue:
When running `bunx prisma db push`, Bun runs the CLI in an isolated subprocess. If using modern `prisma.config.ts` with `url: env("DATABASE_URL")`, the environment variable from `.env` might **not** be passed through, throwing:
```text
PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL
```

### The Solution:
Explicitly load `.env` using Bun's `--env-file` flag when invoking Prisma:
```bash
bun run --env-file=.env node_modules/prisma/build/index.js db push
```

To make this seamless for everyday development, add this script to your `package.json`:
```json
{
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "prisma": "bun run --env-file=.env node_modules/prisma/build/index.js"
  }
}
```
Now you can simply run:
```bash
bun run prisma db push
bun run prisma generate
bun run prisma studio
```

---

## 4. `db push` vs `migrate dev`

| Tool | When to use | Behavior |
| :--- | :--- | :--- |
| **`prisma db push`** | Prototyping, hackathons, local fiddles | Directly syncs `schema.prisma` with the DB without generating migration SQL files. Fast and forgiving. |
| **`prisma migrate dev`** | Production systems, collaborative teams | Creates tracked `.sql` migration files in `prisma/migrations/` so schema history can be reviewed in git. |

---

## 5. Sharing Prisma Client across Backend & Worker

In systems with multiple services reading or writing to the same database (e.g., `backend` creating submissions, `worker` updating submission status):

1. Keep schemas identical across services.
2. If using `@prisma/adapter-pg` with connection pooling:
   ```typescript
   // src/db.ts
   import { PrismaClient } from './generated/prisma/client';
   import { PrismaPg } from '@prisma/adapter-pg';
   import pg from 'pg';

   const connectionString = process.env.DATABASE_URL!;
   const pool = new pg.Pool({ connectionString });
   const adapter = new PrismaPg(pool);

   export const db = new PrismaClient({ adapter });
   ```
3. Whenever you modify `prisma/schema.prisma`:
   - Run `bun run prisma db push` in backend to update the DB tables.
   - Run `bun run prisma generate` in **both** `backend` and `worker` to sync the generated TypeScript types!
