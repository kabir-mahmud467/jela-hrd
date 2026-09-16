require('dotenv').config();
const express = require('express');
const compression = require('compression');
const session = require('express-session');
const path = require('path');
const mongoose = require('mongoose');

const connectDB = require('./config/db');
const Admin = require('./models/Admin');

const indexRoutes = require('./routes/index');
const questionsRoutes = require('./routes/questions');
const darsRoutes = require('./routes/dars');
const duaRoutes = require('./routes/dua');
const adminRoutes = require('./routes/admin');
const { securityMiddleware, globalLimiter } = require('./middleware/security');
const { ipBanCheck } = require('./middleware/ipBan');
const { trafficMiddleware, flagEvent } = require('./middleware/traffic');
const { getAssetVer } = require('./config/assets');

const app = express();

let dbReady = false;
let dbLastError = null;
let dbConnecting = false;
let dbRetryCount = 0;
let dbFixLogged = false;
let lastRetryAt = 0;
async function ensureDB() {
  if (dbReady && mongoose.connection.readyState === 1) return;
  if (dbConnecting) return; // single-flight: overlapping caller (startup + interval + guard) একবারই connect করবে
  dbConnecting = true;
  try {
    await connectDB();
    await Admin.ensureDefaultAdmin();
    dbReady = true;
    dbLastError = null;
    dbRetryCount = 0;
    dbFixLogged = false;
    console.log('MongoDB ready');
  } catch (err) {
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
  } finally {
    dbConnecting = false;
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
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true,
    lastModified: true,
    setHeaders: (res, filePath) => {
      if (/sw\.js$/.test(filePath)) {
        // Service worker: browser 24h-এ একবারই update check করে — max-age দিলে
        // নতুন version আরও দেরিতে আসে, তাই no-cache।
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Service-Worker-Allowed', '/');
      } else if (/manifest\.webmanifest$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.setHeader('Content-Type', 'application/manifest+json');
      } else if (/\.(css|js)$/.test(filePath)) {
        res.setHeader('Cache-Control', 'public, max-age=86400');
      }
    }
  })
);

// IP ban check (DB + BANNED_IPS) — rate limit-এর আগেই ব্যানড IP বিদায়
app.use(ipBanCheck);
// Live traffic counter (in-memory, per-IP) — attacker IP দেখার জন্য
app.use(trafficMiddleware);
app.use(globalLimiter);

// Body parsers (size limit সহ)
app.use(express.urlencoded({ extended: false, limit: '100kb' }));
app.use(express.json({ limit: '100kb' }));

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
  } catch (err) {
    console.warn('MongoStore unavailable, MemoryStore fallback:', err.message);
  }
}
app.use(
  session({
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
  })
);

// Health check (Vercel/Uptime) — DB ছাড়াই কাজ করে, db status জানায়
// (উপরে ban/limit-এর আগেই সংজ্ঞায়িত — এখানে ডুপ্লিকেট নয়)

// DB guard — mongoose পুরোপুরি disconnected (0) থাকলে সঙ্গে সঙ্গে 500,
// "connecting" (2) হলে request-কে যেতে দাও (bufferTimeout 3s-এ fail হবে)।
// Throttle: প্রতি request-এ ensureDB() ডাকলে thundering herd + log spam হয়,
// তাই 10s-এ সর্বোচ্চ একবার background retry ট্রিগার করো।
app.use((req, res, next) => {
  if (mongoose.connection.readyState === 0 && req.path !== '/healthz') {
    const now = Date.now();
    if (now - lastRetryAt > 10000) {
      lastRetryAt = now;
      ensureDB().catch(() => {});
    }
    const msg = dbLastError ? dbLastError.message : 'Database disconnected';
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).render('500', { hint: null });
    }
    return res.status(500).render('500', {
      hint: `সম্ভবত Database সমস্যা: ${msg} — mongod চালু আছে কি না দেখুন।`
    });
  }
  next();
});

// Routes — প্রতিটি প্রশ্নের আলাদা route সহ
app.use('/', indexRoutes);
app.use('/questions', questionsRoutes);
app.use('/dars', darsRoutes);
app.use('/dua', duaRoutes);
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
  res.status(404).render('404');
});
app.use((err, req, res, next) => {
  // DB buffering stack trace spam প্রতিরোধ: এক লাইনে সংক্ষেপে
  if (/buffering|timed out|ECONNREFUSED|ENOTFOUND|Mongo/i.test(err.message || '')) {
    console.error(`Request ${req.method} ${req.path} failed: ${err.message}`);
  } else {
    console.error(err);
  }
  const hint =
    process.env.NODE_ENV === 'production'
      ? null
      : /Signature|session|Mongo|Mongoose|buffering|timed out|ECONNREFUSED/i.test(err.message || '')
        ? `সম্ভবত Database/Session সমস্যা: ${err.message} — mongod চালু আছে কি না দেখুন।`
        : err.message;
  res.status(500).render('500', { hint });
});

module.exports = app;
