// Shared helpers for the leaderboard API (files starting with _ are not routes on Vercel).
import crypto from 'node:crypto';

// Minimum plausible clear time per room (seconds) — rejects obviously fake submissions.
export const ROOMS = { ep1: { min: 90 }, ep2: { min: 120 }, ep3: { min: 150 } };
export const MAX_SEC = 3 * 60 * 60;

const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const SECRET = process.env.GAME_SECRET || TOKEN || '';

export const ready = () => Boolean(URL_ && TOKEN && SECRET);

// Upstash Redis REST pipeline: cmds = [["ZADD", ...], ...]
export async function redis(...cmds) {
  const r = await fetch(URL_.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmds)
  });
  if (!r.ok) throw new Error('redis ' + r.status);
  const out = await r.json();
  return out.map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

export function sign(obj) {
  const p = Buffer.from(JSON.stringify(obj)).toString('base64url');
  const s = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  return `${p}.${s}`;
}
export function verify(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [p, s] = token.split('.');
  const want = crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
  const a = Buffer.from(s || ''), b = Buffer.from(want);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try { return JSON.parse(Buffer.from(p, 'base64url').toString()); } catch { return null; }
}

export function cleanNick(n) {
  if (typeof n !== 'string') return '';
  return n.normalize('NFC').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12);
}

export function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}
