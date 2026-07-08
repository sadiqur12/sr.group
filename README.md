# SR Group AI Assistant — ব্যাকএন্ড সার্ভার

আপনার আগের `sr_group_ai_local.html` ফাইলটা ছিল সম্পূর্ণ standalone — ব্রাউজারের `localStorage`-এ সব ইউজার/চ্যাট ডেটা থাকতো, আর Gemini API key ব্রাউজারেই সেভ থাকতো (client-side)। সেটা এক ল্যাপটপে টেস্ট করার জন্য ঠিক ছিল, কিন্তু আসল প্রোডাক্টের জন্য না — কারণ:

- ডেটা শুধু একটা ব্রাউজারে থাকতো, অন্য ডিভাইস থেকে অ্যাক্সেস করা যেত না
- API key ব্রাউজারের কোডে visible থাকতো — যে কেউ Developer Tools খুলে key চুরি করতে পারতো
- পাসওয়ার্ড হ্যাশিং ছিল, কিন্তু কোনো real backend security ছিল না

এই ফোল্ডারে একটা **পূর্ণাঙ্গ ব্যাকএন্ড সার্ভার** আছে যেটা এই সমস্যাগুলো সমাধান করে:

- **Express.js** সার্ভার
- **SQLite** ডাটাবেস (real database — `data.sqlite` ফাইলে সব সেভ হয়)
- **JWT** দিয়ে ইউজার/অ্যাডমিন সেশন
- **bcrypt** দিয়ে পাসওয়ার্ড হ্যাশিং (industry-standard)
- **Gemini API key শুধু সার্ভারে থাকে** — ব্রাউজার কখনো এটা দেখতে পারে না
- Multi-user, multi-device সাপোর্ট — যেকোনো ডিভাইস থেকে লগইন করলেই নিজের চ্যাট হিস্ট্রি দেখা যাবে

## ফোল্ডার স্ট্রাকচার

```
sr-group-server/
├── package.json
├── .env.example        ← এটা কপি করে .env বানাবেন
├── src/
│   ├── server.js        ← মূল Express অ্যাপ
│   ├── db.js             ← SQLite টেবিল তৈরি
│   ├── auth.js           ← JWT সাইনিং/ভেরিফিকেশন
│   ├── settings.js       ← AI settings + system prompt
│   ├── gemini.js         ← Gemini API-র সাথে সার্ভার-সাইড কল
│   └── routes/
│       ├── auth.js       ← signup/login/forgot-password
│       ├── chat.js       ← কনভারসেশন + মেসেজ + AI রিপ্লাই
│       └── admin.js      ← কাস্টমার লিস্ট, ব্লক/আনব্লক, সেটিংস, পাসকোড
└── public/
    └── index.html        ← ফ্রন্টএন্ড (একই ডিজাইন, এখন API কল করে)
```

## লোকালি চালানো (নিজের ল্যাপটপে)

**ধাপ ১ — Node.js ইনস্টল আছে কিনা চেক করুন** (v18 বা তার উপরে দরকার):
```bash
node -v
```
না থাকলে [nodejs.org](https://nodejs.org) থেকে ইনস্টল করুন।

**ধাপ ২ — ডিপেন্ডেন্সি ইনস্টল করুন:**
```bash
cd sr-group-server
npm install
```

**ধাপ ৩ — `.env` ফাইল বানান:**
```bash
cp .env.example .env
```
তারপর `.env` ফাইলটা খুলে অন্তত এই দুইটা জিনিস বদলান:
- `GEMINI_API_KEY` → আপনার নিজের Gemini API key ([aistudio.google.com/apikey](https://aistudio.google.com/apikey) থেকে ফ্রিতে বানানো যায়)
- `JWT_SECRET` → যেকোনো লম্বা র‍্যান্ডম স্ট্রিং (যেমন: `openssl rand -hex 32` চালিয়ে বানাতে পারেন)

**ধাপ ৪ — সার্ভার চালু করুন:**
```bash
npm start
```
টার্মিনালে দেখাবে: `SR Group সার্ভার চলছে: http://localhost:3000`

**ধাপ ৫ — ব্রাউজারে খুলুন:** `http://localhost:3000`

প্রথমবার অ্যাডমিন ড্যাশবোর্ডে ঢুকতে ডিফল্ট পাসকোড: **`srgroup2026`** (ঢুকেই AI Settings ট্যাব থেকে বদলে ফেলুন)।

## এই সার্ভার অনলাইনে ডিপ্লয় করবেন কীভাবে?

এটা যেকোনো Node.js হোস্টিং-এ চালানো যাবে। কিছু সহজ ফ্রি/সস্তা অপশন:

- **Railway.app** বা **Render.com** — GitHub রিপোতে কোড পুশ করে কানেক্ট করলেই অটো ডিপ্লয় হয়ে যায়, environment variables (`.env`-এর ভ্যালুগুলো) ড্যাশবোর্ডে বসিয়ে দিতে হয়
- **VPS (DigitalOcean/Linode/স্থানীয় কোনো VPS প্রোভাইডার)** — নিজে সার্ভার সেটআপ করে `pm2` দিয়ে `node src/server.js` চালিয়ে রাখতে পারেন, সাথে Nginx দিয়ে ডোমেইন পয়েন্ট করবেন

⚠️ **গুরুত্বপূর্ণ:** যেখানেই ডিপ্লয় করুন, `.env` ফাইলটা কখনো GitHub-এ পাবলিকভাবে আপলোড করবেন না (`.gitignore`-এ এটা বাদ দেওয়াই আছে)। হোস্টিং প্ল্যাটফর্মের নিজস্ব "Environment Variables" সেকশনে গিয়ে `GEMINI_API_KEY`, `JWT_SECRET` ইত্যাদি বসাবেন।

## SQLite নাকি বড় ডাটাবেস দরকার?

এই সেটআপে SQLite ব্যবহার করা হয়েছে কারণ:
- সেটআপ ঝামেলাবিহীন (আলাদা ডাটাবেস সার্ভার লাগে না)
- কয়েকশো/কয়েক হাজার কাস্টমারের জন্য যথেষ্ট ফাস্ট

কাস্টমার সংখ্যা অনেক বেশি বেড়ে গেলে (হাজার হাজার concurrent ইউজার) ভবিষ্যতে PostgreSQL-এ মাইগ্রেট করা যাবে — `src/db.js`-এর কুয়েরিগুলো সহজেই অ্যাডাপ্ট করা যায়।

## নিরাপত্তা নোট

- পাসওয়ার্ড ও সিকিউরিটি অ্যানসার bcrypt দিয়ে হ্যাশ করে রাখা হয় — plaintext কখনো সেভ হয় না
- Gemini API key শুধু সার্ভারের `.env`-এ থাকে, কোনো API রেসপন্সে এটা ফেরত পাঠানো হয় না
- ইউজার সেশন JWT দিয়ে হয় (৩০ দিন মেয়াদ), অ্যাডমিন সেশন আলাদা টোকেন দিয়ে (১২ ঘণ্টা মেয়াদ)
- প্রোডাকশনে যাওয়ার আগে `JWT_SECRET` অবশ্যই একটা শক্তিশালী র‍্যান্ডম ভ্যালুতে বদলে নেবেন, ডিফল্ট রাখবেন না

## API endpoints (সংক্ষেপে)

| Method | Path | কাজ |
|---|---|---|
| POST | `/api/auth/signup` | নতুন কাস্টমার অ্যাকাউন্ট |
| POST | `/api/auth/login` | কাস্টমার লগইন |
| POST | `/api/auth/forgot/find` | ইমেইল যাচাই |
| POST | `/api/auth/forgot/reset` | পাসওয়ার্ড রিসেট |
| GET | `/api/chat/conversations` | নিজের কনভারসেশন লিস্ট |
| POST | `/api/chat/conversations` | নতুন চ্যাট শুরু |
| GET | `/api/chat/conversations/:id/messages` | মেসেজ হিস্ট্রি |
| POST | `/api/chat/conversations/:id/message` | মেসেজ পাঠানো (AI রিপ্লাই দেয়) |
| POST | `/api/admin/login` | অ্যাডমিন লগইন |
| GET | `/api/admin/customers` | সব কাস্টমারের লিস্ট |
| POST | `/api/admin/customers/:email/block` | ব্লক/আনব্লক |
| GET | `/api/admin/settings` | AI সেটিংস পড়া |
| POST | `/api/admin/settings` | AI সেটিংস সেভ করা |
| POST | `/api/admin/passcode` | অ্যাডমিন পাসকোড বদলানো |

সব `/api/chat/*` এবং `/api/admin/*` (login বাদে) রুটে `Authorization: Bearer <token>` হেডার লাগবে।
