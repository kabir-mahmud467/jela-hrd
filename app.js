require('dotenv').config();
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const { isDBReady, waitForDB, isDBError } = require('./config/db');
const Admin = require('./models/Admin');

const indexRoutes = require('./routes/index');
const darsRoutes = require('./routes/dars');
const duaRoutes = require('./routes/dua');
const ayatHadithRoutes = require('./routes/ayathadith');
const surahRoutes = require('./routes/surah');
const bibidhRoutes = require('./routes/bibidh');
const adminRoutes = require('./routes/admin');
const { securityMiddleware, sanitizeMiddleware, globalLimiter } = require('./middleware/security');
const { ipBanCheck } = require('./middleware/ipBan');
const { trafficMiddleware, flagEvent } = require('./middleware/traffic');
const { getAssetVer } = require('./config/assets');
const { toPlain: bnText } = require(path.join(__dirname, 'lib', 'bn-format.js'));
const { renderRich } = require(path.join(__dirname, 'lib', 'rich-html.js'));

const app = express();

let dbReady = false;
let dbLastError = null;
let dbRetryCount = 0;
let dbFixLogged = false;
let lastRetryAt = 0;
// Shared in-flight promise: concurrent caller-রা নতুন connect না ছুঁড়ে একই
// promise-এ wait করে — নাহলে startup/blip-এর সময় সব request একসাথে 500 খেত।
let dbPromise = null;
async function ensureDB() {
  if (dbReady && mongoose.connection.readyState === 1) return;
  if (dbPromise) {
    try {
      await dbPromise;
    } catch {
      // in-flight attempt ব্যর্থ — caller নিচের readyState দেখে সিদ্ধান্ত নেবে
    }
    return;
  }
  dbPromise = (async () => {
    try {
      await connectDB();
      await Admin.ensureDefaultAdmin();
      dbReady = true;
      dbLastError = null;
      dbRetryCount = 0;
      dbFixLogged = false;
      console.log('MongoDB ready');
    } catch (err) {
      dbReady = false;
      dbLastError = err;
      dbRetryCount += 1;
      // Spam প্রতিরোধ: প্রথমবার পূর্ণ fix দেখাও, পরে শুধু এক লাইনে retry count
      if (!dbFixLogged) {
        console.error('MongoDB NOT connected:', err.message);
        console.error('Fix: systemctl --user start jela-mongo (service: ~/.config/systemd/user/jela-mongo.service, dbpath ~/mongodb-data) অথবা .env-এ সঠিক MONGODB_URI দিন। auto-retry চলছে...');
        dbFixLogged = true;
      } else {
        console.error(`MongoDB retry #${dbRetryCount} failed: ${err.message}`);
      }
      throw err;
    } finally {
      dbPromise = null;
    }
  })();
  try {
    await dbPromise;
  } catch {
    // logged above — caller readyState/503 পথে যাবে, crash নয়
  }
}
function scheduleRetry() {
  // Exponential backoff: 10s -> 60s max, log spam ছাড়া
  const delay = Math.min(10000 * Math.pow(1.5, Math.min(dbRetryCount, 5)), 60000);
  setTimeout(async () => {
    if (!dbReady || mongoose.connection.readyState !== 1) {
      await ensureDB().catch(() => {});
    }
    scheduleRetry();
  }, delay).unref();
}
if (process.env.MONGODB_URI) {
  ensureDB();
  scheduleRetry();
} else {
  console.error('MONGODB_URI missing — .env / Vercel env এ সেট করুন।');
}

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  console.warn(
    'WARNING: SESSION_SECRET missing/short — production-এ কমপক্ষে ৩২ অক্ষরের random secret ব্যবহার করুন।'
  );
}
if (
  (process.env.ADMIN_USERNAME || 'admin') === 'admin' &&
  (process.env.ADMIN_PASSWORD || 'admin123') === 'admin123'
) {
  console.warn('WARNING: default admin credentials in use — /admin/settings থেকে দ্রুত পরিবর্তন করুন।');
}

// Security headers, sanitizers, HPP
securityMiddleware(app);
// Gzip — HTML/CSS/JS অনেক ছোট হয়, পেজ দ্রুত লোড হয়
app.use(compression());

// View engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Asset version (?v=) — সব EJS-এ <%= assetVer %> হিসেবে পাওয়া যাবে।
// CSS/JS বদলালে version বদলায়, তাই browser পুরনো cache দেখায় না।
app.use((req, res, next) => {
  res.locals.assetVer = getAssetVer();
  next();
});

// Favicon: file নেই — 204 (404 render + DB hit বাঁচে)
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Health check (Vercel/Uptime) — ban/limit-এর বাইরে, DB ছাড়াই কাজ করে
app.get('/healthz', (req, res) =>
  res.json({ ok: true, db: mongoose.connection.readyState === 1 ? 'up' : 'down' })
);

// Static assets — rate limit-এর আগেই serve করো (প্রতি পেজে CSS/JS গণনায় আসবে না)
// maxAge 1d + ?v= version query: version বদলালে browser নতুন ফাইল আনে, পুরনো cache সমস্যা হয় না।
// ?v= ছাড়া সরাসরি /css/style.css হিট করলে dev-এ no-cache যাতে এডিট সঙ্গে সঙ্গে দেখা যায়।
// lib/ (browser+Node shared modules) — একই /js/* URL-এ serve হয়; public-এ না
// পেলে এখানে খোঁজে, তাই Vercel-এও কাজ করে (public/ function-এ নাও থাকতে পারে)।
app.use(
  '/js',
  express.static(path.join(__dirname, 'lib'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  })
);
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (/\.(css|js)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }
  })
);

// IP ban check (DB + BANNED_IPS) — rate limit-এর আগেই ব্যানড IP বিদায়
// (async rejection কখনো ঝুলে থাকবে না — fail-open + forward)
app.use((req, res, next) => {
  Promise.resolve(ipBanCheck(req, res, next)).catch(next);
});
// Live traffic counter (in-memory, per-IP) — attacker IP দেখার জন্য
app.use(trafficMiddleware);
app.use(globalLimiter);

// Body parsers (size limit সহ) — sanitize-এর আগেই, যাতে POST body-ও sanitize হয়
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));

// NoSQL injection + HPP — body parser-এর পরে (body সহ sanitize হয়)
app.use(sanitizeMiddleware);

const isProd = process.env.NODE_ENV === 'production';
// COOKIE_SECURE: 'true'/'false' দিয়ে override করা যায়; default production-এ true.
// Local http production-এ (systemd service) COOKIE_SECURE=false দিতে হবে,
// নাহলে secure cookie http-তে set হয় না ও admin login টেকে না। HTTPS deploy-এ true রাখুন।
const cookieSecure =
  process.env.COOKIE_SECURE === 'true' ? true
  : process.env.COOKIE_SECURE === 'false' ? false
  : isProd;
// Session store: production-এ MongoStore (restart-এ login টেকে, MemoryStore leak warning যায়);
// MongoStore বানানো না গেলে MemoryStore fallback।
let sessionStore;
if (process.env.MONGODB_URI) {
  try {
    const { MongoStore } = require('connect-mongo');
    sessionStore = MongoStore.create({
      mongoUrl: process.env.MONGODB_URI,
      collectionName: 'sessions',
      ttl: 60 * 60 * 6
    });
    // 'error' listener না থাকলে store emit করলেই process crash করে —
    // তাই সবসময় listener রাখো (fail-open)।
    sessionStore.on('error', (err) => {
      console.error('Session store error (ignored, fail-open):', err && err.message);
    });
  } catch (err) {
    console.warn('MongoStore unavailable, MemoryStore fallback:', err.message);
  }
}
const sessionMiddleware = session({
  name: 'jela_hrd_sid',
  secret: process.env.SESSION_SECRET || 'jela_hrd_secret_change_me',
  resave: false,
  saveUninitialized: false,
  proxy: isProd,
  ...(sessionStore ? { store: sessionStore } : {}),
  cookie: {
    maxAge: 1000 * 60 * 60 * 6,
    httpOnly: true,
    sameSite: 'lax',
    secure: cookieSecure
  }
});
// Session store (Mongo) blip হলে 500 নয় — session ছাড়াই এগিয়ে যাও (fail-open)।
// Public পেজে session লাগে না; admin লগিন DB ছাড়া এমনিতেই সম্ভব নয়।
app.use((req, res, next) => {
  try {
    sessionMiddleware(req, res, (err) => {
      if (!err) return next();
      console.error(
        `Session store error on ${req.method} ${req.path} (fail-open): ${err.message}`
      );
      if (!req.session) {
        req.session = {
          regenerate: (cb) => { if (typeof cb === 'function') cb(); },
          save: (cb) => { if (typeof cb === 'function') cb(); },
          destroy: (cb) => { if (typeof cb === 'function') cb(); }
        };
      }
      next();
    });
  } catch (err) {
    console.error(`Session middleware threw (fail-open): ${err.message}`);
    next();
  }
});

// EJS safe defaults — কোনো route ভুলে variable না পাঠালেও
// ReferenceError → 500 হবে না (render-এর explicit মান অগ্রাধিকার পায়)।
app.use((req, res, next) => {
  res.locals.q = '';
  res.locals.phase = '';
  res.locals.kind = '';
  res.locals.phases = res.locals.phases || {};
  res.locals.cats = res.locals.cats || {};
  res.locals.items = [];
  res.locals.groups = [];
  res.locals.books = [];
  res.locals.notes = [];
  res.locals.lessons = [];
  res.locals.duas = [];
  res.locals.hint = null;
  res.locals.retryAfter = 0;
  res.locals.bnHtml = renderRich;
  res.locals.bnText = bnText;
  next();
});

// Health check (Vercel/Uptime) — DB ছাড়াই কাজ করে, db status জানায়
// (উপরে ban/limit-এর আগেই সংজ্ঞায়িত — এখানে ডুপ্লিকেট নয়)

// DB guard — DB-নির্ভর route-এ যাওয়ার আগে shared reconnect-এর জন্য অপেক্ষা করো.
// Blip/connecting অবস্থায় সঙ্গে সঙ্গে 500 না দিয়ে ~7s wait — transient
// সমস্যায় request নিজেই সেরে যায়। DB-ছাড়া পেজ (/, /healthz,
// login ফর্ম) সবসময় চলে। অজানা path DB ছাড়াই 404 হয়। সত্যিই DB
// unreachable থাকলে DB-নির্ভর route-এ 503 + Retry-After (500 নয়)।
const DB_FREE_GET = new Set(['/', '/admin/login']);
const DB_PREFIXES = [
  '/books', '/note', '/dars', '/dua', '/ayat-hadith',
  '/surah', '/bibidh', '/admin'
];
app.use((req, res, next) => {
  if (isDBReady()) return next();
  if (req.path === '/healthz' || req.path === '/favicon.ico') return next();
  if (req.method === 'GET' && DB_FREE_GET.has(req.path)) return next();
  if (!DB_PREFIXES.some((p) => req.path === p || req.path.startsWith(p + '/'))) {
    return next(); // কোনো router-এই মিলবে না → DB ছাড়াই 404
  }
  waitForDB(7000).then((ok) => {
    if (ok || isDBReady()) return next();
    const now = Date.now();
    if (now - lastRetryAt > 10000) {
      lastRetryAt = now;
      ensureDB().catch(() => {});
    }
    res.set('Retry-After', '5');
    const msg = dbLastError ? dbLastError.message : 'Database disconnected';
    const hint =
      process.env.NODE_ENV === 'production'
        ? 'ডাটাবেজ ব্যস্ত আছে — একটু পরে স্বয়ংক্রিয়ভাবে আবার চেষ্টা করুন।'
        : `ডাটাবেজ ব্যস্ত/বন্ধ: ${msg} — একটু পরে আবার চেষ্টা করুন।`;
    res.status(503).render('500', { hint, retryAfter: 5 }, (rErr, html) => {
      if (rErr) {
        console.error('503 page render failed:', rErr.message);
        if (!res.headersSent) res.status(503).send('Service busy — please retry shortly.');
        return;
      }
      res.send(html);
    });
  }).catch(next);
});

// Routes
app.use('/', indexRoutes);
app.use('/dars', darsRoutes);
app.use('/dua', duaRoutes);
app.use('/ayat-hadith', ayatHadithRoutes);
app.use('/surah', surahRoutes);
app.use('/bibidh', bibidhRoutes);
app.use('/api', require('./routes/sync'));
app.use('/admin', adminRoutes);

// 404 / 500
app.use((req, res) => {
  // 404 flood (scanner/bot) শনাক্ত করতে flag করো — throttle: একই IP থেকে ঘন ঘন 404 এলেই DB লেখো
  try {
    const { getTopIps } = require('./middleware/traffic');
    const top = getTopIps(200).find(t => t.ip === (req.clientIp || '').replace(/^::ffff:/i, ''));
    if (top && top.count >= 30) {
      flagEvent({
        ip: req.clientIp,
        kind: 'notfound',
        path: req.originalUrl || req.path,
        method: req.method,
        userAgent: req.get('user-agent') || '',
        status: 404
      });
    }
  } catch {
    // ignore
  }
  res.status(404).render('404', (rErr, html) => {
    if (rErr) {
      console.error('404 page render failed:', rErr.message);
      if (!res.headersSent) res.status(404).send('দুঃখিত, পেজটি পাওয়া যায়নি।');
      return;
    }
    res.send(html);
  });
});
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  // DB buffering stack trace spam প্রতিরোধ: এক লাইনে সংক্ষেপে
  if (err && isDBError(err)) {
    console.error(`Request ${req.method} ${req.path} failed (DB, 503): ${err.message}`);
    res.set('Retry-After', '5');
    const hint =
      process.env.NODE_ENV === 'production'
        ? 'ডাটাবেজ ব্যস্ত আছে — একটু পরে স্বয়ংক্রিয়ভাবে আবার চেষ্টা করুন।'
        : `ডাটাবেজ ব্যস্ত/বন্ধ: ${err.message} — একটু পরে আবার চেষ্টা করুন।`;
    res.status(503).render('500', { hint, retryAfter: 5 }, (rErr, html) => {
      if (rErr) {
        console.error('503 page render failed:', rErr.message);
        if (!res.headersSent) res.status(503).send('Service busy — please retry shortly.');
        return;
      }
      res.send(html);
    });
    return;
  }
  console.error(err);
  const hint =
    process.env.NODE_ENV === 'production'
      ? null
      : /Signature|session|Mongo|Mongoose|buffering|timed out|ECONNREFUSED/i.test((err && err.message) || '')
        ? `সম্ভবত Database/Session সমস্যা: ${err.message} — mongod চালু আছে কি না দেখুন।`
        : (err && err.message);
  res.status(500).render('500', { hint, retryAfter: 0 }, (rErr, html) => {
    if (rErr) {
      console.error('500 page render failed:', rErr.message);
      if (!res.headersSent) res.status(500).send('সার্ভারে সমস্যা হয়েছে।');
      return;
    }
    res.send(html);
  });
});

module.exports = app;
