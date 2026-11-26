# Taskfolio – Shravan's version (Task 3: AI Integration)

Individual version of the GRP 10 To-Do app (forked from
[To-do-project-GRP10](https://github.com/shravankasar37/To-do-project-GRP10)) by **Shravan Sunil Kasar**.

**Stack:** Angular · Node.js + Fastify · PostgreSQL · Gemini API · Grok (xAI) API

## What's new in this version
| Area | Feature |
|---|---|
| 🌙 Dark mode | Light/Dark switch on every screen, remembered per browser |
| 🔐 Logins | Separate **User login** and **Admin login** tabs, group on registration, **My profile** with name, group and password change |
| 🔔 Notifications | Admin sends announcements to **all users or one group**; users get a bell with unread count plus overdue / due-today / due-tomorrow task alerts; admin sees read counts |
| ✨ AI Assistant | 8 AI features, each runnable with **Gemini, Grok or both side by side** with response times |

### AI features (Gemini vs Grok, same prompt)
1. **AI Daily Planner** – time-slotted plan for today from pending tasks *(assigned feature)*
2. **AI Overdue Rescue Plan** – what to finish today + realistic new dates (one click to apply)
3. **AI Time Estimator** – minutes per task with steps (saved on the task)
4. **AI Weekly Progress Report** – last 7 days in numbers with highlights and tips
5. **Smart Due-Date Suggester** – sensible due date based on priority and workload
6. **AI Task Description Writer** – description + checklist from a short title
7. **Ask Your Tasks** – questions in plain English answered from your own tasks
8. **AI Notification Writer** (admin) – rough note → clear announcement

Every real AI call is timed and stored, and **📊 Gemini vs Grok – speed comparison** shows the average response time
per feature – used for the group comparison document.

## Run locally
1. Database: `database/README.md` (fresh install: `schema.sql` + `seed.sql`; existing database: `migrations/002_task3_features.sql`)
2. Backend: `backend/README.md` – copy `.env.example` to `.env`, add your **own** Gemini and Grok keys
3. Frontend: `cd frontend` → `npm install` → `npm start` → http://localhost:4200

## Security
API keys live only in `backend/.env` locally and in Render → Environment when hosted. They are never sent to the browser
and never committed. AI calls are limited per user per minute.
