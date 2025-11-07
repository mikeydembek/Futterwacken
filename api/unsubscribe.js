import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).end();
  try {
    const { endpoint } = req.body || {};
    if (!endpoint) return res.status(400).json({ error: 'Missing endpoint' });
    await sql`DELETE FROM subscriptions WHERE endpoint = ${endpoint};`;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('/api/unsubscribe error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}