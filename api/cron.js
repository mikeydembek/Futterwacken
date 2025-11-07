import { sql } from '@vercel/postgres';
import webpush from 'web-push';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

// format current local time in HH:MM for a timezone
function nowHHMMInTZ(tz) {
  try {
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz });
    return fmt.format(new Date()); // "HH:MM"
  } catch {
    // fallback UTC
    const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' });
    return fmt.format(new Date());
  }
}

// today's date string in a timezone (YYYY-MM-DD)
function todayYYYYMMDDInTZ(tz) {
  const dFmt = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  return dFmt.format(new Date()); // "YYYY-MM-DD"
}

export default async function handler(req, res) {
  try {
    // fetch all subscriptions
    await sql`CREATE TABLE IF NOT EXISTS subscriptions (
      id SERIAL PRIMARY KEY,
      endpoint TEXT UNIQUE NOT NULL,
      subscription_json TEXT NOT NULL,
      timezone TEXT NOT NULL,
      hhmm TEXT NOT NULL,
      last_sent_date TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    );`;

    const { rows } = await sql`SELECT id, endpoint, subscription_json, timezone, hhmm, last_sent_date FROM subscriptions;`;
    const nowUTC = new Date();

    let sent = 0;
    for (const row of rows) {
      const tz = row.timezone || 'UTC';
      const hhmm = row.hhmm || '09:00';
      const localHHMM = nowHHMMInTZ(tz);
      const todayLocal = todayYYYYMMDDInTZ(tz);

      // Only send if local time matches the user's chosen time, and not already sent today
      if (localHHMM === hhmm && row.last_sent_date !== todayLocal) {
        try {
          const subscription = JSON.parse(row.subscription_json);
          const payload = JSON.stringify({
            title: 'Futterwacken Reminder',
            body: 'You have videos to review today!'
          });
          await webpush.sendNotification(subscription, payload, { TTL: 3600 });

          // mark as sent for this local day
          await sql`UPDATE subscriptions SET last_sent_date = ${todayLocal}, updated_at = NOW() WHERE id = ${row.id};`;
          sent++;
        } catch (err) {
          // Clean up gone/invalid subs
          if (err && (err.statusCode === 404 || err.statusCode === 410)) {
            await sql`DELETE FROM subscriptions WHERE id = ${row.id};`;
          } else {
            console.error('Push send error for id', row.id, err?.statusCode || err);
          }
        }
      }
    }

    return res.status(200).json({ ok: true, sent, at: nowUTC.toISOString() });
  } catch (e) {
    console.error('/api/cron error', e);
    return res.status(500).json({ error: 'Server error' });
  }
}