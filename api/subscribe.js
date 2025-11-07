import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const { subscription, timezone, hhmm } = req.body || {};
    if (!subscription || !subscription.endpoint || !timezone || !hhmm) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    // Store as JSON text; upsert by endpoint
    await sql`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id SERIAL PRIMARY KEY,
        endpoint TEXT UNIQUE NOT NULL,
        subscription_json TEXT NOT NULL,
        timezone TEXT NOT NULL,
        hhmm TEXT NOT NULL,
        last_sent_date TEXT,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `;
    await sql`
      INSERT INTO subscriptions (endpoint, subscription_json, timezone, hhmm, last_sent_date, updated_at)
      VALUES (${subscription.endpoint}, ${JSON.stringify(subscription)}, ${timezone}, ${hhmm}, NULL, NOW())
      ON CONFLICT (endpoint)
      DO UPDATE SET subscription_json = EXCLUDED.subscription_json, timezone = EXCLUDED.timezone, hhmm = EXCLUDED.hhmm, updated_at = NOW();
    `;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('/api/subscribe error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}