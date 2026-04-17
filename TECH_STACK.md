# Tech Stack — Clutcher

เอกสารนี้สรุปเทคโนโลยีหลักที่โปรเจกต์ใช้ (อัปเดตตาม `package.json` และโครงสร้างใน repo)

---

## Frontend

| เทคโนโลยี | หมายเหตุ |
|-----------|-----------|
| **React 19** | UI หลัก (SPA) |
| **TypeScript ~5.8** | ตรวจชนิดทั้งฝั่ง client และ tooling |
| **Vite 6** | Build tool & dev server (`npm run dev`, `npm run build`) |
| **Tailwind CSS 4** | สไตล์ผ่าน `@tailwindcss/vite` |
| **Motion** (`motion/react`) | แอนิเมชัน / transition |
| **Recharts 3** | กราฟ (แดชบอร์ด, กระทบยอด) |
| **Lucide React** | ไอคอน |
| **date-fns** | จัดรูปแบบวันที่ / locale |
| **clsx** + **tailwind-merge** | จัดการ className แบบมีเงื่อนไข |

---

## Backend (API)

| เทคโนโลยี | หมายเหตุ |
|-----------|-----------|
| **Node.js** | Runtime (รันด้วย `tsx` ใน dev/production image) |
| **Express 4** | HTTP API (`server/index.ts`) |
| **TypeScript** | โค้ดเซิร์ฟเวอร์แบบ ESM (`"type": "module"`) |
| **tsx** | รัน TypeScript โดยไม่ต้อง compile แยกก่อนรัน |
| **dotenv** | โหลดตัวแปรจาก `.env` |
| **cors** | CORS (รองรับ `CORS_ORIGIN` แบบหลาย origin) |
| **multer** | อัปโหลดไฟล์ (avatar, รูปท้องฟ้า admin) |
| **bcryptjs** | แฮชรหัสผ่าน |
| **jsonwebtoken** | JWT สำหรับ session หลังล็อกอิน |
| **@google-cloud/storage** | อัปโหลดไฟล์ไป **Google Cloud Storage** เมื่อตั้ง `GCS_BUCKET` (ทางเลือกเมื่อ deploy บน GCP) |

---

## Data & ORM

| เทคโนโลยี | หมายเหตุ |
|-----------|-----------|
| **PostgreSQL** | ฐานข้อมูลหลัก (กำหนดใน `DATABASE_URL`) |
| **Prisma 6** | Schema, migrations, Prisma Client (`@prisma/client`) |
| **SQLite** | ไม่ใช้แล้วใน schema ปัจจุบัน (ประวัติ migration เดิมอาจเป็น SQLite) |

โมเดลหลัก: User, Subscription, ReconciliationRecord, SkyAsset (และ enum ที่เกี่ยวข้อง)

---

## Internationalization (i18n)

- ข้อความ UI แยกใน `src/i18n/translations.ts`
- รองรับ **อังกฤษ (en)** และ **ไทย (th)** ผ่าน `LocaleContext`

---

## Authentication (ปัจจุบัน)

- **อีเมล + รหัสผ่าน** เก็บใน PostgreSQL
- **JWT** ใน `Authorization: Bearer`
- บัญชีผู้ดูแลระบบสำรอง: alias ล็อกอิน `admin` → อีเมล `admin@clutcher.app` (รายละเอียดในโค้ดเซิร์ฟเวอร์)

*(การย้ายไป Firebase Authentication / Identity Platform ยังไม่ได้ผูกในโค้ด — ดูแนวทางใน `docs/DEPLOY-GCP.md`)*

---

## DevOps & Deployment (ที่รองรับใน repo)

| ชั้น | เทคโนโลยี |
|-----|------------|
| Container | **Docker** (`Dockerfile`, entrypoint รัน `prisma migrate deploy`) |
| Local DB | **Docker Compose** — PostgreSQL 16 (`docker-compose.yml`) |
| CI/CD (ตัวอย่าง) | **Google Cloud Build** + **Artifact Registry** (`cloudbuild.yaml`) |
| API hosting (แนะนำ) | **Cloud Run** |
| DB บน cloud (แนะนำ) | **Cloud SQL (PostgreSQL)** |
| Frontend CDN (แนะนำ) | **Firebase Hosting** (`firebase.json`) |
| ไฟล์ static / รูป | **Cloud Storage** (ทางเลือก) หรือโฟลเดอร์ `uploads/` บนเครื่องเซิร์ฟเวอร์ |

---

## เครื่องมือพัฒนา

| เครื่องมือ | หมายเหตุ |
|------------|-----------|
| **concurrently** | รัน Vite + API พร้อมกัน (`npm run dev`) |
| **tsc** | `npm run lint` = `tsc --noEmit` |
| **@google/genai** | มีใน dependencies (ใช้เมื่อมีการเรียก Gemini / ฟีเจอร์ที่เกี่ยวข้อง) |

---

## สรุปภาพรวม

```
Browser (React + Vite build)
    → HTTP / JSON + JWT
        → Express API (Node + tsx)
            → Prisma → PostgreSQL
            → ไฟล์: ดิสก์ท้องถิ่น หรือ Google Cloud Storage
```

หากต้องการให้เอกสารนี้อ้างอิงเวอร์ชันแพ็กเกจแบบล็อกไว้ทุกครั้งที่ release สามารถเพิ่มขั้นตอนอ่านจาก `package-lock.json` ใน CI ได้
