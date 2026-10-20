# Smart Flow Meter (SFM)

Monorepo: React dashboard + Node.js API + PostgreSQL. MQTT broker is the existing EMQX at `emqx.dtek.co.id`.

```
frontend/   React + Vite dashboard
backend/    Fastify API + Prisma
```

Docker is **for VPS later** (3 containers: web, api, postgres). Local machine does not need Docker.

## Local — frontend only (no Postgres)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173 → **Continue without backend (mock data)**.

Topology / dashboard still use dummy nodes.

## Local — with Postgres (when DB is installed)

`DATABASE_URL` in `backend/.env`, then:

```bash
cd backend
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

Set `MQTT_PASSWORD` in `backend/.env` to connect to EMQX.

### Seed account (needs database)

| Role | Email | Password |
|------|--------|----------|
| Super admin | admin@sfm.local | Admin123! |

No sample nodes. Add devices from the dashboard. Change the admin password after first login.

## VPS (Coolify / Docker Compose)

Compose does **not** bind host ports 80/443 — Coolify’s proxy already uses them. Assign the public HTTPS domain to the `web` service (container port 80). Set `FRONTEND_ORIGIN`, JWT secrets, and `MQTT_PASSWORD` in Coolify env.

The `api` container runs migrations and seeds the super admin on start.

To wipe production data and reseed (destructive):

```bash
npx prisma migrate reset --force
```

Then restart the `api` container.

- `web` — nginx + frontend (internal port 80)
- `api` — backend (internal port 3001)
- `postgres` — database (internal port 5432)
