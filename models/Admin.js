const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Admin user - .env থেকে প্রথমবার seed হবে, পরে Admin Panel থেকে পরিবর্তনযোগ্য
const adminSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, trim: true },
  password: { type: String, required: true }, // hashed
  updatedAt: { type: Date, default: Date.now }
});

// পাসওয়ার্ড মিলিয়ে দেখা
adminSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Seed helper: DB খালি থাকলে .env থেকে admin বানাও
adminSchema.statics.ensureDefaultAdmin = async function () {
  const Admin = this;
  const count = await Admin.countDocuments();
  if (count === 0) {
    const username = process.env.ADMIN_USERNAME || 'admin';
    const passwordPlain = process.env.ADMIN_PASSWORD || 'admin123';
    const hashed = await bcrypt.hash(passwordPlain, 12);
    await Admin.create({ username, password: hashed });
    console.log(`Default admin created -> username: ${username}`);
  }
};

module.exports = mongoose.model('Admin', adminSchema);
