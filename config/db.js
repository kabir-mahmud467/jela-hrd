const mongoose = require('mongoose');

// Fail fast when DB is down instead of hanging each request for 10s.
mongoose.set('bufferTimeoutMS', 3000);

let cached = global._mongoose;
if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI is missing. .env / Vercel env এ সেট করুন।');
  }
  if (cached.conn && mongoose.connection.readyState === 1) return cached.conn;
  if (!cached.promise) {
    cached.promise = mongoose
      .connect(uri, {
        maxPoolSize: 5,
        serverSelectionTimeoutMS: 5000, // DB down থাকলে ৩০সে ঝুলে না থেকে ৫সে-এ fail
        connectTimeoutMS: 5000
      })
      .then(m => m)
      .catch(err => {
        cached.promise = null; // পরের request আবার retry করতে পারবে
        cached.conn = null;
        throw err;
      });
  }
  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.conn = null;
    throw err;
  }
  return cached.conn;
}

function isDBReady() {
  return mongoose.connection.readyState === 1;
}

// DB reconnect-এর জন্য অপেক্ষা করো (shared promise — concurrent request একসাথে wait করে)।
// timeoutMs-এর মধ্যে ready না হলে false (500 নয় — caller 503/retry সিদ্ধান্ত নেবে)।
async function waitForDB(timeoutMs = 7000) {
  if (isDBReady()) return true;
  try {
    await Promise.race([
      connectDB().catch(() => null),
      new Promise(resolve => setTimeout(resolve, timeoutMs))
    ]);
  } catch {
    // ignore — নিচে readyState দেখে সিদ্ধান্ত
  }
  return isDBReady();
}

// Transient DB/connection সমস্যা চেনো — এগুলোতে 500 নয়, 503 + Retry-After।
function isDBError(err) {
  return /buffering|timed out|timedout|ECONNREFUSED|ENOTFOUND|EPIPE|ETIMEDOUT|topology|server selection|Mongo|Mongoose/i.test(
    (err && err.message) || ''
  );
}

module.exports = connectDB;
module.exports.connectDB = connectDB;
module.exports.isDBReady = isDBReady;
module.exports.waitForDB = waitForDB;
module.exports.isDBError = isDBError;
