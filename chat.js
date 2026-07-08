import { Router } from 'express';
import db from '../db.js';
import { requireUser } from '../auth.js';
import { callGemini } from '../gemini.js';
import { getSettings, buildSystemPrompt } from '../settings.js';

const router = Router();
router.use(requireUser);

router.get('/conversations', (req, res) => {
  const rows = db
    .prepare('SELECT id, title, updated_at as updatedAt FROM conversations WHERE user_email = ? ORDER BY updated_at DESC')
    .all(req.userEmail);
  res.json({ conversations: rows });
});

router.post('/conversations', (req, res) => {
  const now = new Date().toISOString();
  const info = db
    .prepare('INSERT INTO conversations (user_email, title, created_at, updated_at) VALUES (?, ?, ?, ?)')
    .run(req.userEmail, 'New chat', now, now);
  res.json({ id: info.lastInsertRowid, title: 'New chat', updatedAt: now });
});

router.get('/conversations/:id/messages', (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_email = ?').get(req.params.id, req.userEmail);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

  const rows = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC').all(conv.id);
  res.json({ messages: rows });
});

router.post('/conversations/:id/message', async (req, res) => {
  const conv = db.prepare('SELECT * FROM conversations WHERE id = ? AND user_email = ?').get(req.params.id, req.userEmail);
  if (!conv) return res.status(404).json({ error: 'Conversation not found.' });

  const text = ((req.body || {}).content || '').trim();
  if (!text) return res.status(400).json({ error: 'Message is empty.' });

  const now = new Date().toISOString();
  db.prepare('INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(
    conv.id,
    'user',
    text,
    now
  );

  const history = db.prepare('SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY id ASC').all(conv.id);
  const system = buildSystemPrompt(getSettings());
  const result = await callGemini(system, history);

  if (!result.ok) {
    // ব্যর্থ হওয়া user message-টা রেখেই দিচ্ছি যাতে history-এর ধারাবাহিকতা নষ্ট না হয়;
    // ইউজার আবার চেষ্টা করলে সেটা conversation-এ থেকে যাবে।
    return res.status(502).json({ error: result.error });
  }

  db.prepare('INSERT INTO messages (conversation_id, role, content, created_at) VALUES (?, ?, ?, ?)').run(
    conv.id,
    'assistant',
    result.text,
    new Date().toISOString()
  );

  let title = conv.title;
  if (title === 'New chat') title = text.slice(0, 40);

  db.prepare('UPDATE conversations SET updated_at = ?, title = ? WHERE id = ?').run(
    new Date().toISOString(),
    title,
    conv.id
  );

  res.json({ reply: result.text, title });
});

export default router;
