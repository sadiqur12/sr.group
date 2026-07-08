import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signUserToken } from '../auth.js';

const router = Router();
const FIXED_SECURITY_QUESTION = "What's a word only you would know?";

router.post('/signup', async (req, res) => {
  const { name, email: rawEmail, password, securityAnswer } = req.body || {};
  const email = (rawEmail || '').trim().toLowerCase();

  if (!name || !email || !password || !securityAnswer) {
    return res.status(400).json({ error: 'Fill in all fields, including the security answer.' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) return res.status(409).json({ error: 'An account with this email already exists.' });

  const passwordHash = await bcrypt.hash(password, 10);
  const securityHash = await bcrypt.hash(securityAnswer.trim().toLowerCase(), 10);
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO users (name, email, password_hash, security_answer_hash, created_at) VALUES (?, ?, ?, ?, ?)`
  ).run(name, email, passwordHash, securityHash, now);

  const token = signUserToken({ email });
  res.json({ token, user: { name, email } });
});

router.post('/login', async (req, res) => {
  const { email: rawEmail, password } = req.body || {};
  const email = (rawEmail || '').trim().toLowerCase();

  if (!email || !password) return res.status(400).json({ error: 'Enter your email and password.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'No account found with that email.' });
  if (user.blocked) {
    return res.status(403).json({
      error: 'This account has been suspended by SR Group. Please contact SR Group directly if you think this is a mistake.',
    });
  }

  const match = await bcrypt.compare(password, user.password_hash);
  if (!match) return res.status(401).json({ error: 'Incorrect password.' });

  db.prepare('UPDATE users SET last_login_at = ? WHERE email = ?').run(new Date().toISOString(), email);
  const token = signUserToken({ email });
  res.json({ token, user: { name: user.name, email: user.email } });
});

router.post('/forgot/find', (req, res) => {
  const email = ((req.body || {}).email || '').trim().toLowerCase();
  if (!email) return res.status(400).json({ error: 'Enter your email.' });

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'No account found with that email.' });

  res.json({ question: FIXED_SECURITY_QUESTION });
});

router.post('/forgot/reset', async (req, res) => {
  const { email: rawEmail, answer, newPassword } = req.body || {};
  const email = (rawEmail || '').trim().toLowerCase();

  if (!email || !answer || !newPassword) return res.status(400).json({ error: 'Fill in all fields.' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'No account found with that email.' });

  const match = await bcrypt.compare(answer.trim().toLowerCase(), user.security_answer_hash);
  if (!match) return res.status(401).json({ error: "That answer doesn't match." });

  const newHash = await bcrypt.hash(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE email = ?').run(newHash, email);
  res.json({ ok: true });
});

export default router;
