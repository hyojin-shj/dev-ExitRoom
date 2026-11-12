// POST /api/start {room} → {token}  (server remembers the start time inside a signed token)
import crypto from 'node:crypto';
import { ROOMS, ready, sign, json } from './_lib.js';

export default function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!ready()) return json(res, 503, { error: '랭킹 서버 미설정' });
  const room = req.body && req.body.room;
  if (!ROOMS[room]) return json(res, 400, { error: '알 수 없는 방' });
  json(res, 200, { token: sign({ room, t: Date.now(), n: crypto.randomUUID() }) });
}
