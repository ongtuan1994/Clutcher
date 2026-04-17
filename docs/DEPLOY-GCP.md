# Deploy Clutcher on Google Cloud Platform

This document maps the stack you chose to concrete GCP services and this repository’s configuration.

| Concern | GCP service | Notes |
|--------|-------------|--------|
| API runtime | **Cloud Run** | Stateless containers; scales to zero; use `Dockerfile` in repo root. |
| Database | **Cloud SQL for PostgreSQL** | Prisma uses `DATABASE_URL`; good fit for multi-tenant SaaS with row-level `userId` (future: Postgres RLS). |
| Frontend | **Firebase Hosting** | Fast CDN; deploy `dist` after `npm run build`; SPA rewrite in `firebase.json`. |
| File storage | **Cloud Storage** | Set `GCS_BUCKET`; API uploads avatars/sky images via `@google-cloud/storage`. |
| Auth (current) | **App JWT** | Email/password in Postgres; `JWT_SECRET` in Secret Manager. |
| Auth (optional upgrade) | **Firebase Authentication** or **Identity Platform** | Replace or augment `/api/auth/*` with Firebase ID token verification (`firebase-admin`). |
| CI/CD | **Cloud Build** + **Artifact Registry** | `cloudbuild.yaml` builds and pushes the image; enable deploy step when ready. |

---

## 1. Prerequisites

- GCP project with billing enabled  
- [gcloud CLI](https://cloud.google.com/sdk/docs/install) and [Firebase CLI](https://firebase.google.com/docs/cli)  
- Docker (for local image tests)

---

## 2. Artifact Registry & Cloud Build

```bash
gcloud services enable artifactregistry.googleapis.com cloudbuild.googleapis.com run.googleapis.com

gcloud artifacts repositories create clutcher \
  --repository-format=docker \
  --location=asia-southeast1 \
  --description="Clutcher API images"
```

Connect your repo to **Cloud Build Triggers** and point them at `cloudbuild.yaml`. Substitutions (`_REGION`, `_REPO`, `_SERVICE`) are documented in that file.

---

## 3. Cloud SQL (PostgreSQL)

1. Create a **PostgreSQL** instance (e.g. v16, region aligned with Cloud Run).  
2. Create database + user; note the password.  
3. For **Cloud Run → Cloud SQL**, use the **Unix socket** connection string (recommended). Prisma rejects `...@/DBNAME` (“empty host”, **P1013**); use **`localhost`** as the hostname so the URL parses correctly—the `?host=/cloudsql/...` value is what directs traffic to the socket:

   `postgresql://USER:PASSWORD@localhost/DBNAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME`

   URL-encode special characters in `USER` or `PASSWORD` (e.g. `@` → `%40`).

4. Store `DATABASE_URL` in **Secret Manager** and mount it on Cloud Run as an environment variable or secret.

Local alternative: `docker compose up -d` and use:

`DATABASE_URL=postgresql://clutcher:clutcher@localhost:5432/clutcher`

Then run migrations:

```bash
npx prisma migrate deploy
```

---

## 4. Cloud Run (API)

After the image exists in Artifact Registry:

```bash
gcloud run deploy clutcher-api \
  --image=asia-southeast1-docker.pkg.dev/PROJECT_ID/clutcher/api:latest \
  --region=asia-southeast1 \
  --platform=managed \
  --allow-unauthenticated \
  --add-cloudsql-instances=PROJECT_ID:REGION:INSTANCE_NAME \
  --set-secrets=DATABASE_URL=clutcher-database-url:latest,JWT_SECRET=clutcher-jwt-secret:latest \
  --set-env-vars=PUBLIC_API_URL=https://YOUR-SERVICE-URL,GCS_BUCKET=your-bucket,CORS_ORIGIN=https://YOUR_PROJECT.web.app
```

- **`PUBLIC_API_URL`**: Set to the Cloud Run service URL so avatar/sky URLs in JSON are absolute (needed when the web app is on Firebase Hosting).  
- **`CORS_ORIGIN`**: Your Firebase Hosting domains (comma-separated).  
- **`GCS_BUCKET`**: Optional but strongly recommended so uploads survive instance restarts.  
- Attach a **service account** with:  
  - Cloud SQL Client  
  - Secret Manager access (if using secrets)  
  - `roles/storage.objectAdmin` on the uploads bucket (if using GCS)

### Troubleshooting: “failed to start and listen on PORT=8080”

Cloud Run waits for the process to accept traffic on `PORT` (default **8080**). If the revision fails with that message, common causes in this repo are:

1. **`DATABASE_URL` (Secret Manager) and Cloud SQL** — When you pass `--add-cloudsql-instances`, use the **Unix socket** form with **`@localhost/`** (not `@/`). Prisma otherwise throws **P1013** (“empty host”) and the container exits before listening. Example:

   `postgresql://USER:PASSWORD@localhost/DBNAME?host=/cloudsql/PROJECT_ID:REGION:INSTANCE_NAME`

   A TCP URL to a public IP often does not work from Cloud Run (or makes `prisma migrate deploy` hang). Update the secret, then redeploy.

2. **Listen address** — The API must bind **all interfaces** (`0.0.0.0`), not only loopback. This repo’s `server/index.ts` uses `app.listen(PORT, '0.0.0.0', …)` for Cloud Run. After changing server code, **rebuild the image, push to Artifact Registry, and deploy again**.

3. **More time** — If migrations or cold start are slow, increase startup behavior (e.g. [startup CPU boost](https://cloud.google.com/run/docs/configuring/services/cpu#startup-boost), longer request/startup timeout) per [Cloud Run troubleshooting](https://cloud.google.com/run/docs/troubleshooting#container-failed-to-start).

---

## 5. Cloud Storage (uploads)

1. Create a bucket (e.g. regional, same as Run).  
2. Grant the Cloud Run service account **Object Admin** (or finer-grained) on that bucket.  
3. Optional: `GCS_PUBLIC_BASE_URL` if you serve objects via **load balancer + custom domain** instead of `storage.googleapis.com`.

Application code stores objects under `avatars/` and `sky/`.

---

## 6. Firebase Hosting (frontend)

1. `firebase login` and `firebase init hosting` (or copy `.firebaserc.example` to `.firebaserc`).  
2. Build with the API base URL baked in:

   ```bash
   set VITE_API_BASE_URL=https://YOUR-CLOUD-RUN-URL
   npm run build
   firebase deploy --only hosting
   ```

3. `firebase.json` already rewrites all routes to `index.html` for the SPA.

---

## 7. Authentication roadmap (Firebase / Identity Platform)

Today the API uses **JWT + bcrypt** users in PostgreSQL. To adopt **Firebase Authentication** or **Identity Platform**:

1. Create a Firebase project (or enable Identity Platform in GCP).  
2. Add the Firebase Web SDK to the React app; sign-in returns an **ID token**.  
3. Add `firebase-admin` on the server; verify `Authorization: Bearer <firebase-id-token>`.  
4. Map `firebase_uid` → `User` row (new column or separate table).  
5. Gradually retire email/password routes or keep them for migration only.

This repo does not ship Firebase Auth wiring yet; the above is the standard integration path.

---

## 8. CI/CD summary

- **Cloud Build** runs `docker build` using `Dockerfile`, pushes to **Artifact Registry**.  
- Uncomment the `gcloud run deploy` step in `cloudbuild.yaml` when secrets and service names are ready.  
- Optionally add a second build step for `npm run build` + `firebase deploy` using a CI service account with Hosting admin.

---

## 9. Migrating from SQLite

Older clones used `file:./dev.db`. The app now targets **PostgreSQL**. Export/import data manually or re-register users; there is no automatic SQLite → Postgres migration in this repo.
