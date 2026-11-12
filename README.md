# DEV EXIT ROOM 🚪💻

개발자라면 등골이 서늘해지는 **개발자 스릴러 방탈출** 웹 게임.
처음 접속하면 ROOM 01 인트로부터 바로 시작하고, 첫 방을 탈출하면 엔딩 아래에 다음 사건(ROOM 02·03)이 열립니다. 랭킹 서버(Vercel)에 배포한 경우 TRUE END를 본 사람은 닉네임으로 명예의 전당에 기록을 남길 수 있습니다.

| 방 | 제목 | 난이도 | 제한시간 | 테마 |
|---|---|---|---|---|
| ROOM 01 | 💸 $500 증발 사건 | ★☆☆ | 45분 | API 비용 폭탄 · 내부자 |
| ROOM 02 | 🗄 금요일 18:02, DROP TABLE | ★★☆ | 50분 | AI 에이전트 · 백업 복구 |
| ROOM 03 | 👻 04:44 유령 커밋 | ★★★ | 60분 | 보안 사고 · 공급망 |

- 모바일 우선 웹앱: 세로 화면에서는 방을 좌우로 밀어 둘러보고, 조사 창은 바텀시트로 열립니다.
- "홈 화면에 추가"하면 앱처럼 전체 화면으로 실행됩니다 (PWA).
- 빌드 과정 없음: 순수 HTML/CSS/JS + Vercel 서버리스 함수.

## 구조

```
index.html            방 선택 + 명예의 전당
rooms/ep1~3.html      각 방 (스테이지·단서·엔딩 데이터)
assets/engine.js      공용 방탈출 엔진 (인트로, 타이머, 단서함, 모달, 키패드, 엔딩, 랭킹)
assets/style.css      공용 스타일 (모바일 대응)
api/start.js          플레이 시작 시 서명된 시작 토큰 발급
api/finish.js         TRUE END 기록 저장 (클리어 시간은 서버가 직접 계산)
api/scores.js         방별 TOP 20 조회
```

## Vercel 배포

1. [vercel.com/new](https://vercel.com/new)에서 이 저장소를 Import → Framework Preset은 **Other**, 나머지 기본값 그대로 **Deploy**.
2. 랭킹 저장소 연결: 프로젝트 → **Storage** → **Upstash for Redis**(무료 플랜) 생성 후 이 프로젝트에 Connect.
   → `KV_REST_API_URL`, `KV_REST_API_TOKEN` 환경 변수가 자동으로 들어갑니다.
3. (권장) 프로젝트 → Settings → Environment Variables에 `GAME_SECRET` = 아무 긴 랜덤 문자열 추가.
4. **Redeploy** 하면 끝.

랭킹 저장소를 연결하지 않아도 게임은 그대로 동작하고, 기록은 플레이어 기기에만 남습니다.

## 새 방 추가하기

`rooms/ep1.html`을 복사해서 `stage`(방 그림), `props`(물건 클릭 시 동작), `clues`, `goal`, `hint`, `endings`를 바꾸고,
`index.html`의 `ROOMS` 배열과 `api/_lib.js`의 `ROOMS`에 방 ID를 추가하세요.

## 스포일러 주의 ⚠️

<details><summary>정답 보기</summary>

- ROOM 01: 노트북 `bug0314` → 서버랙 `4245` → demo-key / 준혁 / 라즈베리파이 크론
- ROOM 02: 금고 `1700` → 형광펜으로 티켓 칠하기 → OTP `482913` → 17:00 스냅샷 / 테오 / 숨겨진 지시를 AI가 실행
- ROOM 03: 콘솔 `miner` → 사물함 `137` → 도윤 토큰 Zk9 / 되돌린 뒤 배포 / 외부 공격자 / 퇴사자 계정 미정리 + 공개 dotfiles
</details>
