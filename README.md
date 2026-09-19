# Jela HRD — Agent Handbook

> **Read this first.** This README is written for AI coding agents (and humans) who need to
> work on this project safely. Follow the conventions and gotchas below; they encode real bugs
> that have already been fixed once.

## 1. What this is

Bangla-language education site: গুরুত্বপূর্ণ প্রশ্নোত্তর (click-to-reveal Q&A), গুরুত্বপূর্ণ তথ্য,
বই লিংক, আলোচনা নোট — plus an admin panel to manage all content.

**Stack:** Node.js (≥18) + Express 4 + EJS + MongoDB (Mongoose 8) + express-session with
MongoDB-backed sessions (`connect-mongo`). No frontend framework. SVG icons only — **no emojis**
in UI. UI strings are in Bengali.

**Live on this machine (production):** http://localhost:3000 · Admin: `/admin/login` ·
Health: `/healthz` → `{"ok":true,"db":"up|down"}`

---

## 2. Repo map

```
server.js              Entry point. Listens on PORT (default 3000). Exports app (see §13).
app.js                 ALL app wiring: DB bootstrap+retry, security, session, routes, error handlers.
config/db.js           Cached mongoose connect (serverless-safe). bufferTimeoutMS=3000,
                       serverSelectionTimeoutMS=5000. Single shared promise.
config/assets.js       Asset version (?v=) from CSS/JS mtimes + package version. Exposed as
                       `assetVer` to ALL EJS — edit CSS/JS and version changes automatically.
routes/index.js        Public: /, /books (+/phase/:phase), /note (+/cat/:cat, /phase/:phase, :id detail; old /notes/* 301).
routes/dars.js         Public দারস: /dars, /dhara/:kind (2 ধারা), /:id detail.
routes/dua.js          Public দুআ (SEPARATE): /dua, /dhara/:cat (3 ভাগ), /:id detail.
routes/questions.js    Public Q&A: /questions, /subject/:subject, /phase/:phase, /id/:id, /:slugOrId.
routes/admin.js        Admin: login/logout, dashboard, CRUD (importants/books/notes/questions/dars/duas),
                       bans, security center, global search, JSON export, settings.
                       All mutating routes use adminWriteLimiter.
middleware/security.js helmet CSP, mongo-sanitize, hpp, 3 rate limiters (global/login/adminWrite).
                       429 handler auto-logs attacker IP to SecurityEvent.
middleware/ipBan.js    IP ban check (BANNED_IPS env + Ban collection, 60s cache). Sets req.clientIp.
                       Banned-hit auto-logged to SecurityEvent.
middleware/traffic.js  In-memory 15-min per-IP counters (live top talkers) + flagEvent() logger.
                       Only suspicious events hit Mongo — normal views never do.
middleware/auth.js     requireAdmin guard (redirects to /admin/login).
middleware/validate.js validateBody(kind, body) — single place for all admin form validation.
models/Question.js     question/answer/subject/chapter/phase/slug/views. Auto-slug hooks. PHASES enum.
models/Important.js    title/description/category/isPinned (notice board).
models/Book.js         title/author/link(description)/category. link MUST be http/https (schema validator).
models/Note.js         title/subject/content (discussion notes).
models/Admin.js        username + bcrypt hash. ensureDefaultAdmin() seeds from .env on first boot.
models/Ban.js          Banned IPs (unique).
models/SecurityEvent.js Attack log: ip/kind/path/method/ua/status. TTL 30 days (auto-delete).
seed.js                Demo data. Idempotent (only fills empty collections). Always disconnects (finally).
api/index.js           Vercel serverless entry (requires ../app). No app.listen here.
views/                 EJS. partials/{header,footer,icons,qa-list}. admin/partials/{head,nav,foot}
                       shared admin shell. admin/{dashboard,security,search,ban-list}. Error: 403/404/429/500.
public/css|js          Static (served BEFORE rate limiter). main.js = accordion + data-confirm + nav.
                        Loaded with ?v=<%= assetVer %> — CSS/JS edits show up without hard-refresh.
                        PWA: public/manifest.webmanifest + public/icons/*.png (installable),
                        public/sw.js (shell precache on install, network-first pages,
                        SWR static, JELA_PREFETCH full-pack), public/offline.html (fallback).
                        SW registration + install button (#installBtn) in public/js/main.js.
                        Full-content download lives ONLY in the installed app: #dlBanner/#dlBtn
                        card in header (standalone-only, progress bar, resume, "অ্যাপ আপডেট").
                        /offline-manifest.json (routes/index.js) lists every public URL for the pack.
.env / .env.example    Secrets/config. .env is gitignored — NEVER commit it.
```

---

## 3. Environment variables

| Key | Required | Default | Meaning |
|---|---|---|---|
| `PORT` | no | `3000` | HTTP port (`server.js`). |
| `NODE_ENV` | no | dev | `production` enables: secure-cookie default, `proxy:true`, terse 500 pages. |
| `MONGODB_URI` | **yes** | — | e.g. `mongodb://127.0.0.1:27017/jela_hrd`. Missing → clear startup error, DB pages 500. |
| `SESSION_SECRET` | **yes (prod)** | weak fallback | Must be ≥32 chars or a startup warning prints. Generate: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | first boot | `admin`/`admin123` | Seed the FIRST admin only. Afterwards the DB value wins; change via `/admin/settings`. Default combo prints a warning — change it. |
| `BANNED_IPS` | no | — | Comma-separated IPs, instant 403 (checked before rate limit). |
| `COOKIE_SECURE` | no | `true` if prod | **GOTCHA (§9):** set `false` for plain-HTTP production (local systemd service). `true`/default for HTTPS (Vercel). |

Setup: `cp .env.example .env` then fill the table above.

---

## 4. Run locally (dev)

```bash
npm install
npm run seed   # optional, idempotent demo data
npm run dev    # nodemon server.js
# or: npm start
```

- Site: http://localhost:3000 · Admin login: http://localhost:3000/admin/login (seeded from `.env`)
- Health: http://localhost:3000/healthz
- Requires MongoDB reachable at `MONGODB_URI` (§5). If DB is down, dynamic pages render a
  friendly 500 with a hint instead of hanging (buffer timeout is 3s).

---

## 5. Production on this machine (systemd, auto-start on boot)

Two **user-level** systemd units (no root needed). Linger is enabled (`loginctl show-user kabir`
→ `Linger=yes`), so they start at boot without login.

| Unit | File | What it does |
|---|---|---|
| `jela-mongo.service` | `~/.config/systemd/user/jela-mongo.service` | `mongod --dbpath ~/mongodb-data --bind_ip 127.0.0.1 --port 27017`, `Restart=always`. Data + log (`~/mongodb-data/mongod.log`) persist in `~/mongodb-data` (NOT `/tmp` — `/tmp` is wiped on reboot). |
| `jela-hrd.service` | `~/.config/systemd/user/jela-hrd.service` | `node server.js` in `~/Desktop/jela-hrd`, `NODE_ENV=production`, `COOKIE_SECURE=false`, `Restart=always`, starts after `jela-mongo`. |

```bash
systemctl --user status jela-mongo.service jela-hrd.service
systemctl --user restart jela-hrd.service        # deploy new code
systemctl --user restart jela-mongo.service     # app auto-reconnects via backoff, no app restart needed
journalctl --user -u jela-hrd.service -n 30     # app logs
journalctl --user -u jela-mongo.service -n 30   # mongo logs
systemctl --user enable jela-mongo.service jela-hrd.service   # already enabled = start on boot
```

> The system-wide `mongod.service` is broken on this kernel (SERVER-121912) — do NOT switch back
> to it. The user unit above is the supported path.

### MongoDB ops

```bash
# backup (run anytime; mongod stays up)
mkdir -p ~/backups && mongodump --out ~/backups/jela-$(date +%F)   # needs mongodb-database-tools
# restore
mongorestore ~/backups/jela-<date>/
```

---

## 6. Routes (complete)

**Public** (`routes/index.js`, `routes/questions.js`):

| Method | Path | Notes |
|---|---|---|
| GET | `/` | Home: latest 12 Q&A (`select` + `lean`), `subjects`, counts. Single `distinct` query (don't regress to two). |
| GET | `/questions?q=&subject=&phase=` | List, max 200 docs, `limit(200).lean()`. |
| GET | `/questions/subject/:subject` | Per-subject page. |
| GET | `/questions/phase/:phase` | Phase page; unknown phase → 404. |
| GET | `/questions/id/:id` | Legacy id link → 301 to canonical slug. Invalid ObjectId → 404 (no CastError). |
| GET | `/questions/new` | Redirects to `/questions` (prevents clash with `/:slugOrId`). Order matters: keep BEFORE `/:slugOrId`. |
| GET | `/questions/:slugOrId` | Detail: slug first, then ObjectId fallback. Increments `views` best-effort. Id-URL → 301 slug. |
| GET | `/gurutto`, `/gurutto/:id` | Notices (pinned first). `:id` validates ObjectId. |
| GET | `/books?q=&phase=`, `/books/phase/:phase` | Books, ৩ পর্বে ভাগ (প্রশ্নের পর্বের মতো)। Max 200. |
| GET | `/note?q=&cat=&phase=`, `/note/cat/:cat`, `/note/phase/:phase` | নোট — ধরন (আলোচনা/বই) + ৩ পর্ব ফিল্টারসহ। Max 200. |
| GET | `/note/:id` | ObjectId validated. |
| GET | `/dars?q=&kind=&phase=`, `/dars/dhara/:kind`, `/dars/porbo/:phase`, `/dars/:id` | দারস — ২ ধারা + ৩ পর্ব (প্রশ্নের পর্ব)। ধারা পেজে `?phase=`, পর্ব পেজে `?kind=` চলে। Max 200. |
| GET | `/dua?q=&cat=&phase=`, `/dua/dhara/:cat`, `/dua/porbo/:phase`, `/dua/:id` | মাসনুন দুআ — SEPARATE route, ৩ ভাগ + ৩ পর্ব। ভাগ পেজে `?phase=`, পর্ব পেজে `?cat=` চলে। Max 200. |
| GET | `/healthz` | No auth/ban/limit. `{"ok":true,"db":"up\|down"}`. |
| GET | `/favicon.ico` | `204` (avoids 404-render + DB hit). |

**Admin** (`routes/admin.js`, all except login behind `requireAdmin`):

| Method | Path | Notes |
|---|---|---|
| GET/POST | `/admin/login` | `loginLimiter` (10/15min, skips successful). Regenerates session on success. Falls back to `.env` creds only when DB has no such user. |
| GET | `/admin/logout` | Destroys session. |
| GET | `/admin` | Dashboard counts (5 parallel `countDocuments`). |
| CRUD | `/admin/importants`, `/books`, `/notes`, `/dars`, `/duas` | List (limit 500) / `new` / POST create / `:id/edit` / POST `:id` update / POST `:id/delete`. Serial order: arrows move rows instantly in-DOM (`public/js/admin-reorder.js`, ES5, localStorage draft `jela_order_<path>`); ONE save POSTs `ids` to `/:path/reorder` (single `bulkWrite`, single reload). Per-click `:id/move/up\|down` stays as no-JS fallback. Tables need `data-reorder="<crud-path>"` + `data-id` rows or the JS stays dormant. |
| CRUD | `/admin/questions` | Same shape; create/update go through `validateBody('question')`; updates use `doc.save()` so slug hooks run. |
| GET/POST | `/admin/bans` | `net.isIP`-validated. Cannot ban own IP (`req.clientIp`). Duplicate → friendly error. Clears ban cache. POST from `/admin/security` redirects back there. `?ip=` prefills the form. |
| POST | `/admin/bans/:id/delete` | Unban + clear cache. |
| GET | `/admin/security` | **Security center:** live top-IPs (15-min in-memory), 24h offenders + recent events (DB), one-click ban per IP, export, clear logs. |
| POST | `/admin/security/clear` | Delete all SecurityEvents. |
| GET | `/admin/search?q=` | Global admin search across questions/books/notes/dars/duas/importants (max 20 each). |
| GET | `/admin/export/:type` | `all` = full JSON backup download; `security` = SecurityEvent log download. |
| GET/POST | `/admin/settings` | Requires current password. Duplicate username (11000) → friendly error, not 500. |

---

## 7. Data models & the `phase` feature

`Question.phase` enum (defined ONCE in `models/Question.js`, exposed as `PHASES`/`PHASE_VALUES`):

```
abedonpotrer-purbe  = আবেদনপত্রের পূর্বে
proshnopotrer-purbe = প্রশ্নপত্রের পূর্বে
shopother-purbe     = শপথের পূর্বে
```

**To add/rename a phase you must touch all of these** (a past bug left phase unwired):
`models/Question.js` (enum) → `middleware/validate.js` (`PHASE_VALUES` + default) →
`views/admin/question-form.ejs` (`<select>`) → `routes/admin.js` (save `doc.phase`) →
`routes/questions.js` (`buildFilter` + `/phase/:phase` + `select`) → `views/questions.ejs`
(chips) + `views/partials/qa-list.ejs` + `views/question-details.ejs` (badges) → `seed.js`.

**Books + আলোচনা নোট share the same 3 phases** (single source: `PHASE_VALUES` in
`models/Question.js`, imported by `models/Book.js` + `models/Note.js`):
`routes/index.js` (`/books`, `/books/phase/:phase`, `/note`, `/note/cat/:cat`, `/note/phase/:phase`) →
`views/books.ejs` + `views/note.ejs` (ধরন dropdown + phase tabs) + `views/admin/book-form.ejs` +
`views/admin/note-form.ejs` (`<select>`) → `middleware/validate.js` (kind `book`/`note`).

**Dars kinds** (defined ONCE in `models/Dars.js` as `DARS`/`DARS_VALUES`):
`darsul-quran` = দারসুল কুরআন, `darsul-hadis` = দারসুল হাদিস — PLUS the shared
3 phases (`phase` field, `PHASE_VALUES` from `models/Question.js`).
Chain: `models/Dars.js` → `middleware/validate.js` (kind `dars`) → `routes/dars.js`
(`/`, `/dhara/:kind`, `/porbo/:phase`, `/:id` — order matters: `/dhara/*` + `/porbo/*`
BEFORE `/:id`) → `app.js` (`app.use('/dars', ...)`) → `views/dars.ejs` +
`views/dars-details.ejs` → `views/admin/dars-form.ejs` + `dars-list.ejs` →
`routes/admin.js` (crudRoutes dars + dashboard count) → `seed.js`.

**Masnun Dua is a SEPARATE section** (NOT under dars — own model/routes/views),
also with 3 ভাগ + 3 পর্ব:
kinds defined ONCE in `models/Dua.js` as `DUA_CATS`/`DUA_VALUES`:
`sokal-sondha` = সকাল-সন্ধ্যার দুআ, `doinondin` = দৈনন্দিন কাজের দুআ,
`bipod-sofor` = বিপদ ও সফরের দুআ; `phase` shared.
Chain: `models/Dua.js` → `middleware/validate.js` (kind `dua`) → `routes/dua.js`
(`/`, `/dhara/:cat`, `/porbo/:phase`, `/:id`) → `app.js` (`app.use('/dua', ...)`) →
`views/dua.ejs` + `views/dua-details.ejs` → `views/admin/dua-form.ejs` +
`dua-list.ejs` → `routes/admin.js` (crudRoutes duas + dashboard count) → `seed.js`.

**UI tokens** (`public/css/theme.css` `:root`): SolaimanLipi-first font stack,
radius `15/12/10px`, focus ring `rgb(0,179,241) 0 0 0 2px` on ALL interactive
elements (keyboard users — never remove). Palette: near-black paper `#05070b`,
card `#0c1420`, line `#1c2c44`, accent sky `#00a9e0`, red `#e93e3f` (accents
only). Dark premium cinematic theme (scroll-film system): huge tight-tracked
display type (`clamp(44px,7.5vw,92px)` hero), generous section rhythm,
fade+rise 24px scroll reveals (`.reveal` + IntersectionObserver in
`public/js/main.js`), film-grain overlay.
Homepage (`views/index.ejs`) is compact: hero → scroll-scrubbed 3D book
(`.book-film` 260vh track + sticky stage, cover angle driven by
`public/js/book3d.js` with rAF lerp — ES5, `prefers-reduced-motion` snaps
open) → member checklist. Token NAMES in
`theme.css` are unchanged (admin shell shares them); text colors use
`var(--ink)`, never `var(--navy)` on dark surfaces.
Content lists use SOCIAL cards (`.feed` + `.card.social`: avatar + title + meta +
tags + excerpt + footer action) — NOT plain boxes. Buttons must stay visually
distinct: `.btn.primary` (ভরাট নীল) vs `.btn` (আউটলাইন) vs `.search button`
(জোড়া) vs `.phase-tab` (বাক্স+বাম দাগ) vs `.chip` (ছোট পিল) vs `.more`
(টেক্সট লিংক). Logo: inline SVG book+star emblem (`.logo-emblem`) in header/footer.

**Slug rules** (`models/Question.js`): Bengali range `0980–09FF` preserved, lowercased, spaces→`-`,
max 80 chars, fallback `proshno`. Uniqueness loop (≤5 tries, random suffix). `pre('save')` skips
when question unchanged; `pre('findOneAndUpdate')` re-slugs only when `question` changes.
Admin question updates use `doc.save()`, NOT `findByIdAndUpdate`, so hooks fire — keep it that way.

---

## 8. Auth & sessions

- Login: `Admin.findOne({username})` + `bcrypt.compare`. Success → `req.session.regenerate()` +
  `req.session.admin = {id, username}` (fixation-safe). Then `/admin/settings` changes persist to DB.
- Store: `connect-mongo` `MongoStore` (`sessions` collection, 6h TTL) when `MONGODB_URI` is set;
  MemoryStore fallback otherwise (dev only — prints the well-known warning).
- Cookie: `httpOnly`, `sameSite=lax`, 6h, name `jela_hrd_sid`. `secure` follows `COOKIE_SECURE` (§3).
- **Login-loop gotcha:** if admin login 302s but `/admin` bounces back to login, the session cookie
  wasn't stored — cause is `secure:true` over plain HTTP. Fix: `COOKIE_SECURE=false` (local) — the
  systemd unit already sets this. Don't "fix" by deleting `secure`; HTTPS deployments need it.

---

## 9. Security model (do not weaken)

- **CSP** (`middleware/security.js`): `script-src 'self'` + `script-src-attr 'none'` — **NO inline
  handlers in any EJS** (`onclick`/`onsubmit`/`onload` are blocked). Delete confirmations use
  `<form data-confirm="…">` + the delegated listener in `public/js/main.js`. Verify with:
  `grep -rn --include='*.ejs' -e 'onclick' -e 'onsubmit' views/ public/` → must print nothing.
- Rate limits: global 300/15min per IP (static assets + `/healthz` + `/favicon.ico` are served
  BEFORE the limiter and don't count); login 10/15min (successes skipped); admin writes 60/min.
  Breaches render `429.ejs`.
- IP bans beat rate limits (`ipBanCheck` runs first; 60s cache, `clearBanCache()` on change).
- `express-mongo-sanitize` + `hpp` + 100kb body caps on every request.
- Validation: `validateBody()` trims + slices ALL fields; search regex escaped; IPs via `net.isIP`;
  ObjectIds validated before query; EJS uses `<%= %>` (escaped) — never `<%- %>` for user data.
  `Book.link` additionally schema-validated to http/https AND re-checked in `books.ejs`.
- Views must null-guard DB fields (`(x||'').substring(...)`, `x ? new Date(x)… : ''`) — lean docs
  from old rows can miss fields and crash renders.

---

## 10. Conventions for agents (PR checklist)

1. **EJS:** escaped `<%= %>`, no inline JS handlers, SVG `<use href="#i-…">` icons (see
   `views/partials/icons.ejs`), Bengali UI copy.
2. **DB:** `.lean()` on reads, `select()` only needed fields, `limit()` on every list (200 public /
   500 admin). Never add an unbounded `find()`.
3. **Validation:** new admin fields go in `validateBody()` + matching Mongoose schema limits.
4. **Phases:** follow the 7-file chain in §7.
5. **Ordering:** in `routes/questions.js`, `/new`, `/subject/*`, `/phase/*`, `/id/*` must stay BEFORE
   `/:slugOrId`.
6. **Middleware order in `app.js` is load-bearing:** compression → favicon/healthz → assetVer locals → static →
   ipBan → traffic → limiter → parsers → session → dbGuard → routes. Don't reorder without reason.
7. **Assets:** every `<link>`/`<script>` for `/css|/js` MUST carry `?v=<%= assetVer %>` (see `views/partials/header.ejs`).
   New admin pages MUST use `views/admin/partials/{head,nav,foot}` (shared shell, versioned, mobile toggle included).
   Never add an unversioned `/css/style.css` or `/js/main.js` URL.
7. **Secrets:** never commit `.env`; never log secrets; session password changes via `/admin/settings`.
8. **PWA/offline:** new public pages MUST be added to `/offline-manifest.json` (`routes/index.js`)
   or the in-app download pack misses them. SW caching logic changes → bump `CACHE`
   (`public/sw.js`). `/sw.js` is served `no-store` (see `app.js` setHeaders) — keep it that way.
   `public/js/main.js` + `public/sw.js` MUST stay **ES5** (var/function/Promise chains —
   no arrows, const/let, async/await, template literals, optional chaining,
   includes/startsWith, classList.toggle-force) so old-Android Chrome can parse
   them, otherwise install breaks on those devices.
8. **Vercel:** `api/index.js` has no `app.listen` (`server.js` guards with `require.main`); routing
   via `vercel.json` rewrites; sessions need `connect-mongo` (already wired) on serverless.

---

## 11. Troubleshooting

| Symptom | Cause → Fix |
|---|---|
| `MongoDB NOT connected: ECONNREFUSED` repeating | mongod down → `systemctl --user start jela-mongo`. App backoffs automatically (single full fix line, then `retry #N` lines, 10s→60s). |
| Dynamic pages 500, `/healthz` says `db:down` | Same as above; static + healthz still work by design. |
| Login 302s then back to login | Secure cookie on HTTP → ensure `COOKIE_SECURE=false` in this env (§8). |
| 403 on own IP | Self-ban blocked in UI; check `BANNED_IPS` / `Ban` collection. |
| CSS বদলে সাইটে দেখা যায় না | পুরনো cache ছিল — এখন সব CSS/JS `?v=<%= assetVer %>` সহ লোড হয় (`config/assets.js`: CSS/JS mtime বদলালে version বদলায়)। তবুও না দেখালে hard-refresh (Ctrl+Shift+R) বা `systemctl --user restart jela-hrd.service`। সরাসরি `/css/style.css` (v ছাড়া) খুলে দেখো না — browser 1d cache দেখাবে। |
| 429 page | Rate limit hit (+ auto-logged in Security center); wait or tune `middleware/security.js`. |
| `MemoryStore is not designed for production` | `connect-mongo` didn't load (needs `MONGODB_URI`); `npm install` then restart. |
| System `mongod.service` fails (kernel check) | Known — use `jela-mongo.service`, never the system unit. |
| `MONGODB_URI missing` at boot | `.env` absent/misread — `dotenv` loads from project root; service sets `WorkingDirectory` + `EnvironmentFile`, keep both. |

---

## 12. Verify your change (run before finishing)

```bash
node --check app.js server.js routes/*.js middleware/*.js models/*.js seed.js
curl -s http://127.0.0.1:3000/healthz                        # {"ok":true,"db":"up"}
curl -s -o /dev/null -w "home:%{http_code}\n" http://127.0.0.1:3000/
curl -s -o /dev/null -w "questions:%{http_code}\n" http://127.0.0.1:3000/questions
grep -rn --include='*.ejs' -e 'onclick' -e 'onsubmit' views/ public/ || echo CLEAN
systemctl --user is-active jela-mongo.service jela-hrd.service  # both "active"
```

After code changes: `systemctl --user restart jela-hrd.service` (sessions survive — MongoStore).

---

## 13. Deploy notes (Vercel) & git

- Vercel env: `MONGODB_URI` (Atlas), `SESSION_SECRET`, `ADMIN_USERNAME`, `ADMIN_PASSWORD`,
  `NODE_ENV=production` (leave `COOKIE_SECURE` unset → defaults to `true` on HTTPS). Then visit
  `/admin/login` → `/admin/settings` to set a strong password.
- Git: `git init -b main && git add . && git commit -m "..." && gh repo create jela-hrd --public --source=. --push`.
  `.env` and `node_modules/` are gitignored — never commit them.
