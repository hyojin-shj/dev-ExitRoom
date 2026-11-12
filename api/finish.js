// POST /api/finish {token, nick, hints} → {sec, rank, improved, bestSec}
// Clear time is measured on the server from the signed start token.
import { ROOMS, MAX_SEC, ready, redis, verify, cleanNick, json } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!ready()) return json(res, 503, { error: '랭킹 서버가 설정되지 않았어요.' });
  const { token, nick, hints } = req.body || {};
  const t = verify(token);
  if (!t || !ROOMS[t.room]) return json(res, 400, { error: '유효하지 않은 기록이에요. 처음부터 다시 플레이해 주세요.' });
  const name = cleanNick(nick);
  if (!name) return json(res, 400, { error: '닉네임을 입력하세요.' });
  const h = Math.max(0, Math.min(3, parseInt(hints, 10) || 0));
  const sec = Math.floor((Date.now() - t.t) / 1000);
  if (sec < ROOMS[t.room].min) return json(res, 400, { error: '기록이 비정상적으로 빨라요 🤔' });
  if (sec > MAX_SEC) return json(res, 400, { error: '플레이 시간이 너무 길어 기록할 수 없어요.' });

  try {
    const [first] = await redis(['SET', `used:${t.n}`, '1', 'NX', 'EX', String(MAX_SEC + 3600)]);
    if (first !== 'OK') return json(res, 409, { error: '이미 저장된 기록이에요.' });
    const key = `lb:${t.room}`;
    const score = sec * 10 + h; // time first, fewer hints breaks ties
    const [, rank, best] = await redis(['ZADD', key, 'LT', String(score), name], ['ZRANK', key, name], ['ZSCORE', key, name]);
    const bestScore = Number(best);
    json(res, 200, { sec, rank: Number(rank) + 1, improved: bestScore === score, bestSec: Math.floor(bestScore / 10) });
  } catch (e) {
    json(res, 500, { error: '저장 중 오류가 났어요.' });
  }
}
