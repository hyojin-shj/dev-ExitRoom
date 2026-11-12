// GET /api/scores?room=ep1 → {rows:[{nick,sec,hints}], total}
import { ROOMS, ready, redis, json } from './_lib.js';

export default async function handler(req, res) {
  const room = (req.query && req.query.room) || new URL(req.url, 'http://x').searchParams.get('room');
  if (!ROOMS[room]) return json(res, 400, { error: '알 수 없는 방' });
  if (!ready()) return json(res, 503, { error: '랭킹 서버 미설정' });
  try {
    const key = `lb:${room}`;
    const [flat, total] = await redis(['ZRANGE', key, '0', '19', 'WITHSCORES'], ['ZCARD', key]);
    const rows = [];
    for (let i = 0; i < flat.length; i += 2) { const s = Number(flat[i + 1]); rows.push({ nick: flat[i], sec: Math.floor(s / 10), hints: s % 10 }); }
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=30');
    res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ rows, total: Number(total) }));
  } catch (e) { json(res, 500, { error: '불러오기 실패' }); }
}
