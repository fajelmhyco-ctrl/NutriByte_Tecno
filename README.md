# NutriByte Philippines

Localized tele-nutrition marketplace and mHealth platform. Clinical nutrition logic is
Filipino-food aware: adobo, sinigang, kare-kare, bagoong, patis, sayote, pechay, bangus,
and 30+ other verified local dishes.

## Monorepo layout

```
nutribyte/
├── apps/
│   ├── api/      Node.js + Express + Prisma + PostgreSQL + Redis
│   ├── web/      Next.js + Tailwind + Recharts (dietitian portal)
│   └── mobile/   React Native (Expo) + SQLite offline cache
├── docker-compose.yml
└── README.md
```

## What is implemented

**Backend (`apps/api`)**
- JWT access + rotating refresh tokens, bcrypt password hashing, RBAC
  (`consumer`, `patient`, `dietitian`, `admin`), rate limiting, Helmet, Zod validation.
- Prisma schema covering all requested tables plus clinical alerts, subscriptions,
  weight logs, and refresh tokens.
- Deterministic clinical safety engine (`src/services/clinical-engine.ts`):
  - Sodium ceiling `< 2000 mg` for hypertension or any CKD stage.
  - High-sodium enhancer detection (soy sauce/toyo, patis, bagoong, tuyo, instant noodles).
  - CKD 3–5 non-dialysis protein restriction at 0.6–0.8 g/kg.
  - Potassium/phosphorus monitoring with local substitutions (sayote/pechay for spinach/kangkong,
    apple for saba).
  - Glycemic load `GL = GI × carbs / 100`, meal warning above 20.
- AI Coach (`src/services/ai-coach.ts`) with the requested JSON contract. The AI can escalate
  severity but can never downgrade the deterministic engine; if the provider fails or no key is
  set, a deterministic Taglish-aware fallback is returned.
- Telehealth: Agora token issuance, 15% commission split, PayMongo checkout + signed webhook.
- Seed data: 30+ verified Filipino foods and demo accounts.

**Web (`apps/web`)**
- Dietitian login, patient panel, patient detail with sodium/potassium/glycemic load/protein
  charts, therapeutic alerts, recent meals, adherence rate, and consultations.

**Mobile (`apps/mobile`)**
- Expo Router app with Today summary, offline food search (SQLite cache), meal logging with a
  sync queue (`clientUuid` idempotency), The Coach screen, and profile.

## Quick start

```bash
# 1. Install
npm install

# 2. Infra
docker compose up -d

# 3. Configure API
copy apps\api\.env.example apps\api\.env    # Windows
# then set JWT_SECRET (>= 32 chars) and DATABASE_URL

# 4. Database
npm run prisma:generate -w @nutribyte/api
npm run prisma:push -w @nutribyte/api
npm run seed -w @nutribyte/api

# 5. Run
npm run dev:api      # http://localhost:4000
npm run dev:web      # http://localhost:3000
npm run dev:mobile   # Expo
```

## Demo accounts

| Role | Email | Password |
| --- | --- | --- |
| Dietitian | `dietitian@nutribyte.ph` | `NutriByte123!` |
| Patient | `patient@nutribyte.ph` | `NutriByte123!` |
| Admin | `admin@nutribyte.ph` | `NutriByte123!` |

The patient demo is 54M, BMI 27.6, Type 2 Diabetes + Hypertension + CKD stage 3, so the
safety engine restrictions are visible immediately.

## Tests

```bash
npm test
```

Covers sodium ceilings, CKD protein limits, potassium substitutions, glycemic load flagging,
daily accumulation, and enhancer detection.

## Environment

All secrets live in `apps/api/.env` (never commit it). Required: `DATABASE_URL`, `JWT_SECRET`.
Optional: `REDIS_URL` (falls back to in-memory), `AI_API_KEY`, `AGORA_*`, `PAYMONGO_*`.

## Clinical disclaimer

NutriByte provides decision support, not medical diagnosis or prescription. All nutrient
thresholds should be confirmed by the supervising physician or registered nutritionist-dietitian.
