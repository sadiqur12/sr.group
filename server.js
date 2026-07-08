import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

import db from './db.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import adminRoutes from './routes/admin.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json());

// প্রথমবার চালু হলে অ্যাডমিন পাসকোড আর AI settings-এর ডিফল্ট রো বসিয়ে দিচ্ছি
function seed() {
  const admin = db.prepare('SELECT * FROM admin_auth WHERE id = 1').get();
  if (!admin) {
    const defaultPasscode = process.env.ADMIN_DEFAULT_PASSCODE || 'srgroup2026';
    const hash = bcrypt.hashSync(defaultPasscode, 10);
    db.prepare('INSERT INTO admin_auth (id, passcode_hash) VALUES (1, ?)').run(hash);
    console.log(`[SR Group] অ্যাডমিন পাসকোড ডিফল্ট সেট হলো: "${defaultPasscode}" — অ্যাডমিন ড্যাশবোর্ড থেকে এখনই বদলে ফেলুন!`);
  }

  const settings = db.prepare('SELECT * FROM ai_settings WHERE id = 1').get();
  if (!settings) {
    db.prepare('INSERT INTO ai_settings (id, desc, tone, facts) VALUES (1, ?, ?, ?)').run('', '', '');
  }
}
seed();

if (!process.env.GEMINI_API_KEY) {
  console.warn('[SR Group] সতর্কতা: .env-এ GEMINI_API_KEY নেই। চ্যাট কাজ করবে না যতক্ষণ না এটা সেট করা হয়।');
}

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/admin', adminRoutes);

// ফ্রন্টএন্ড সার্ভ করছে
app.use(express.static(path.join(__dirname, '..', 'public')));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`SR Group সার্ভার চলছে: http://localhost:${PORT}`);
});
