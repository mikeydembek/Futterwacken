import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
  if (req.method !== 'PUT') return res.status(405).end();
  try {
    const { endpoint, timezone, hhmm } = req.body || {};
    if (!endpoint || !timezone || !hhmm) {
      return res.status(400).json({ error: 'Invalid payload' });
    }
    await sql`
      UPDATE subscriptions
      SET timezone = ${timezone}, hhmm = ${hhmm}, updated_at = NOW()
      WHERE endpoint = ${endpoint};
    `;
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error('/api/update-settings error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}