import { Router } from 'express';
import bcrypt from 'bcryptjs';
import db from '../db.js';
import { signAdminToken, requireAdmin } from '../auth.js';
import { getSettings, setSettings } from '../settings.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { passcode } = req.body || {};
  if (!passcode) return res.status(400).json({ error: 'Enter the admin passcode.' });

  const row = db.prepare('SELECT passcode_hash FROM admin_auth WHERE id = 1').get();
  const match = await bcrypt.compare(passcode, row.passcode_hash);
  if (!match) return res.status(401).json({ error: 'Wrong passcode.' });

  res.json({ token: signAdminToken() });
});

// এর নিচের সব রুট admin token লাগবে
router.use(requireAdmin);

router.get('/customers', (req, res) => {
  const rows = db
    .prepare(
      'SELECT name, email, created_at as createdAt, last_login_at as lastLoginAt, blocked FROM users ORDER BY created_at DESC'
    )
    .all();
  res.json({ customers: rows.map((r) => ({ ...r, blocked: !!r.blocked })) });
});

router.post('/customers/:email/block', (req, res) => {
  const email = req.params.email.toLowerCase();
  const user = db.prepare('SELECT blocked FROM users WHERE email = ?').get(email);
  if (!user) return res.status(404).json({ error: 'Customer not found.' });

  db.prepare('UPDATE users SET blocked = ? WHERE email = ?').run(user.blocked ? 0 : 1, email);
  res.json({ blocked: !user.blocked });
});

router.get('/customers/:email/conversations', (req, res) => {
  const email = req.params.email.toLowerCase();
  const rows = db
    .prepare('SELECT id, title, updated_at as updatedAt FROM conversations WHERE user_email = ? ORDER BY updated_at DESC')
    .all(email);
  res.json({ conversations: rows });
});

router.get('/conversations/:id/messages', (req, res) => {
  const rows = db
    .prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC')
    .all(req.params.id);
  res.json({ messages: rows });
});

router.get('/settings', (req, res) => {
  res.json(getSettings());
});

router.post('/settings', (req, res) => {
  const { desc, tone, facts } = req.body || {};
  setSettings({ desc, tone, facts });
  res.json({ ok: true });
});

router.post('/passcode', async (req, res) => {
  const { current, next } = req.body || {};
  if (!current || !next) return res.status(400).json({ error: 'Fill in all fields.' });
  if (next.length < 6) return res.status(400).json({ error: 'New passcode should be at least 6 characters.' });

  const row = db.prepare('SELECT passcode_hash FROM admin_auth WHERE id = 1').get();
  const match = await bcrypt.compare(current, row.passcode_hash);
  if (!match) return res.status(401).json({ error: 'Current passcode is incorrect.' });

  const newHash = await bcrypt.hash(next, 10);
  db.prepare('UPDATE admin_auth SET passcode_hash = ? WHERE id = 1').run(newHash);
  res.json({ ok: true });
});

export default router;
