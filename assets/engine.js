/* DEV EXIT ROOM — shared escape-room engine
   A room page calls ER.boot(config). See rooms/ep1.html for a full example. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const fmt = s => `${Math.floor(s / 60)}분 ${String(s % 60).padStart(2, '0')}초`;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- local progress (works offline) ---------- */
  const store = {
    get(k, d) { try { const v = localStorage.getItem('der:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('der:' + k, JSON.stringify(v)); } catch (e) {} }
  };

  /* ---------- online leaderboard API ---------- */
  const api = {
    async start(room) {
      try {
        const r = await fetch('/api/start', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room }) });
        if (!r.ok) return null; return (await r.json()).token || null;
      } catch (e) { return null; }
    },
    async finish(token, nick, hints) {
      const r = await fetch('/api/finish', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, nick, hints }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || '저장 실패');
      return j;
    },
    async scores(room) {
      try { const r = await fetch('/api/scores?room=' + encodeURIComponent(room)); if (!r.ok) return null; return await r.json(); }
      catch (e) { return null; }
    }
  };

  const S = { clues: {}, hints: 3, hintsUsed: 0, start: 0, ended: false, token: null, flags: {} };
  let C = null; // room config

  /* ---------- skeleton ---------- */
  function skeleton() {
    document.body.insertAdjacentHTML('afterbegin', `
<section id="intro" class="screen on" style="position:relative">
  <a class="back" href="../index.html">← 방 목록</a>
  <button class="skip" id="skipBtn">건너뛰기</button>
  <div class="clock" id="clock"></div>
  <div class="phone">
    <div class="phone-top"><div class="avatar" id="callerAv"></div><div><b id="callerName"></b><span id="callerOrg"></span></div></div>
    <div class="bubbles" id="introBubbles"></div>
    <div class="typing" id="typing"></div>
  </div>
  <div class="title-card" id="introTitle"><h1 id="roomTitle"></h1><p id="roomSub"></p></div>
  <button class="btn" id="startBtn" disabled>현장으로 출발 →</button>
</section>
<section id="game" class="screen">
  <div class="hud">
    <div class="timer" id="timer">--:--</div>
    <div class="goal" id="goal"></div>
    <button class="hbtn" id="hintBtn">💡 3</button>
    <button class="hbtn" id="menuBtn" aria-label="메뉴">☰</button>
  </div>
  <div class="inv" id="inv"><span>🎒 단서함 · 물건을 눌러 조사하세요</span></div>
  <div class="stage-scroll" id="stageScroll"><div class="stage" id="stage"></div></div>
  <div class="swipe-tip">👈 화면을 좌우로 밀어 방을 둘러보세요 👉</div>
</section>
<section id="ending" class="screen">
  <div class="badge" id="endBadge"></div>
  <h2 id="endTitle"></h2>
  <div class="story" id="endStory"></div>
  <div class="stats" id="endStats"></div>
  <div class="board-wrap">
    <div id="saveBox"><h4>🏆 명예의 전당에 기록 남기기</h4>
      <div class="row" style="margin-top:0"><input class="inp" id="nick" maxlength="12" placeholder="닉네임 (최대 12자)" autocomplete="nickname"><button class="btn" id="saveBtn">기록</button></div>
      <div class="msg" id="smsg"></div></div>
    <p class="lbmsg" id="noSave" style="display:none">TRUE END를 보면 명예의 전당에 기록할 수 있어요.</p>
    <h4 style="margin-top:14px">🏆 명예의 전당 · TOP 20</h4><div class="lb" id="lbEnd"><p class="lbmsg">불러오는 중…</p></div>
  </div>
  <div class="row" style="justify-content:center">
    <a class="btn" href="../index.html" style="text-decoration:none">🚪 다른 방 고르기</a>
    <button class="btn ghost" id="retryBtn">마지막 선택으로</button>
    <button class="btn ghost" onclick="location.reload()">처음부터</button>
  </div>
</section>
<div class="modal" id="modal"><div class="mbox" id="mbox">
  <div class="mhead"><h3 id="mtitle"></h3><button class="x" id="mclose" aria-label="닫기">×</button></div>
  <div class="mbody" id="mbody"></div>
</div></div>
<div class="toast" id="toast"></div>`);
  }

  /* ---------- intro ---------- */
  let skipIntro = false;
  async function intro() {
    $('#clock').innerHTML = `${C.clock}<small>${C.clockSub}</small>`;
    $('#callerAv').textContent = C.caller.avatar; $('#callerAv').style.background = C.caller.bg;
    $('#callerName').textContent = C.caller.name; $('#callerOrg').textContent = C.caller.org;
    $('#roomTitle').textContent = C.title; $('#roomSub').textContent = C.sub;
    const box = $('#introBubbles'), ty = $('#typing');
    $('#skipBtn').onclick = () => { skipIntro = true; };
    for (const [m, who] of C.intro) {
      if (!skipIntro) {
        ty.textContent = who === 1 ? '' : (C.caller.name.split(' ')[0] + '님이 입력 중…');
        await wait(who === 1 ? 650 : 750 + m.length * 11);
        ty.textContent = '';
      }
      const b = document.createElement('div');
      b.className = 'bubble' + (who === 1 ? ' me' : who === 2 ? ' sys' : '');
      b.innerHTML = m; box.appendChild(b);
    }
    $('#skipBtn').style.display = 'none';
    $('#introTitle').classList.add('on'); $('#startBtn').disabled = false;
  }
  function show(id) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('on')); $('#' + id).classList.add('on'); window.scrollTo(0, 0); }

  /* ---------- timer ---------- */
  const elapsed = () => Math.floor((Date.now() - S.start) / 1000);
  function tick() {
    if (!S.start || S.ended) return;
    const left = C.limit - elapsed(), t = $('#timer');
    if (left <= 0) { t.textContent = '00:00'; if (!S.over) { S.over = true; ending('timeout'); } return; }
    t.textContent = String(Math.floor(left / 60)).padStart(2, '0') + ':' + String(left % 60).padStart(2, '0');
    t.classList.toggle('danger', left < 300);
  }

  /* ---------- clues / toast / modal ---------- */
  function addClue(k) {
    if (S.clues[k]) return; S.clues[k] = 1;
    const inv = $('#inv'); if (inv.querySelector('span')) inv.innerHTML = '';
    const b = document.createElement('button'); b.className = 'item'; b.textContent = C.clues[k];
    b.onclick = () => open((C.clueOpen && C.clueOpen[k]) || k);
    inv.appendChild(b);
  }
  const has = k => !!S.clues[k];
  function toast(m, ms) { const t = $('#toast'); t.innerHTML = m; t.classList.add('on'); clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove('on'), ms || 4000); }
  function mark(k) { const el = document.querySelector(`[data-k="${k}"]`); if (el) { el.classList.add('seen'); el.classList.remove('pulse'); } }
  function modal(title, html) { $('#mtitle').innerHTML = title; $('#mbody').innerHTML = html; $('#modal').classList.add('on'); $('#mbox').scrollTop = 0; }
  function closeModal() { $('#modal').classList.remove('on'); }
  function open(k) { const f = C.props[k]; if (f) { mark(k); f(); } }
  function shake(el) { if (!el) return; el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }

  /* ---------- reusable puzzle widgets ---------- */
  // numeric keypad lock inside the current modal
  function keypad({ len, code, onOk, hint }) {
    $('#mbody').insertAdjacentHTML('beforeend', `
      <div class="lcd" id="lcd">${'_'.repeat(len)}</div>
      <div class="keypad" id="kp">${[1, 2, 3, 4, 5, 6, 7, 8, 9, 'C', 0, '⏎'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div>
      <div class="msg" id="kmsg" style="text-align:center">${hint || ''}</div>`);
    let v = ''; const lcd = $('#lcd');
    $('#kp').onclick = e => {
      const k = e.target.dataset.k; if (k === undefined) return;
      if (k === 'C') v = '';
      else if (k === '⏎') {
        if (v === code) return onOk();
        $('#kmsg').className = 'msg err'; $('#kmsg').textContent = '❌ 삐빅. 틀렸습니다.'; shake(lcd); v = '';
      } else if (v.length < len) v += k;
      lcd.textContent = (v + '_'.repeat(len)).slice(0, len);
    };
  }
  // password lock screen; check(v) returns true or an error string
  function pwLock({ title, user, avatar, prompt, check, onOk }) {
    modal(title, `<div class="lockscreen"><div class="avatar">${avatar || '🧑‍💻'}</div><b>${user}</b>
      <p class="desc" style="margin:6px 0 0">${prompt || '비밀번호를 입력하세요'}</p>
      <div class="row" style="max-width:340px;margin:16px auto 0"><input class="inp" id="pw" type="text" autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="••••••" autocomplete="off"><button class="btn" id="pwBtn">↵</button></div>
      <div class="msg" id="pmsg"></div></div>`);
    const go = () => {
      const v = $('#pw').value.trim().toLowerCase().replace(/\s+/g, '');
      const r = check(v);
      if (r === true) return onOk();
      $('#pmsg').className = 'msg err'; $('#pmsg').textContent = r || '비밀번호가 올바르지 않습니다.'; shake($('#pw'));
    };
    $('#pwBtn').onclick = go; $('#pw').onkeydown = e => { if (e.key === 'Enter') go(); };
  }
  // computer with tabs: tabs = [[key,label,render(el)]]
  function computer(title, tabs, stateKey) {
    const cur = S.flags[stateKey] || tabs[0][0];
    modal(title, `<div class="os"><div class="os-side">${tabs.map(([k, n]) => `<button data-t="${k}" class="${cur === k ? 'on' : ''}">${n}</button>`).join('')}</div><div class="os-main" id="osMain"></div></div>`);
    document.querySelectorAll('.os-side button').forEach(b => b.onclick = () => { S.flags[stateKey] = b.dataset.t; computer(title, tabs, stateKey); });
    tabs.find(t => t[0] === cur)[2]($('#osMain'));
  }
  // messenger: chans = {id:{name,dot,msgs:[[who,time,html]]}}, people = {who:[emoji,bg]}
  function messenger(el, chans, people, stateKey) {
    const cur = S.flags[stateKey] || Object.keys(chans)[0]; chans[cur].dot = 0;
    el.innerHTML = `<div class="chan">${Object.entries(chans).map(([k, v]) => `<button data-c="${k}" class="${cur === k ? 'on' : ''}">${v.name}${v.dot ? '<span class="dot"></span>' : ''}</button>`).join('')}</div>` +
      chans[cur].msgs.map(([w, t, m]) => { const p = people[w] || ['👤', '#1b2230']; return `<div class="cm"><div class="avatar" style="background:${p[1]}">${p[0]}</div><div><div class="who">${w}<span>${t}</span></div><div class="txt">${m}</div></div></div>`; }).join('');
    el.querySelectorAll('.chan button').forEach(b => b.onclick = () => { S.flags[stateKey] = b.dataset.c; messenger(el, chans, people, stateKey); });
  }
  // multiple-choice report form; groups = [[name,title,[[value,label]...]]]
  function report(el, { warn, groups, submit, onSubmit }) {
    el.innerHTML = `<p class="desc">${warn}</p>` + groups.map(([n, t, opts]) => `<div class="card"><h4>${t}</h4>${opts.map(([v, l]) => `<label class="opt"><input type="radio" name="${n}" value="${v}">${l}</label>`).join('')}</div>`).join('') +
      `<button class="btn wide" id="rsubmit">${submit}</button><div class="msg err" id="rmsg"></div>`;
    el.querySelector('#rsubmit').onclick = () => {
      const a = {}; for (const [n] of groups) { const c = el.querySelector(`input[name=${n}]:checked`); if (!c) { el.querySelector('#rmsg').textContent = '모든 항목을 선택하세요.'; return; } a[n] = c.value; }
      S.last = a; closeModal(); onSubmit(a);
    };
  }

  /* ---------- goal / hints ---------- */
  function updGoal() { $('#goal').innerHTML = '🎯 ' + C.goal(S, has); }

  /* ---------- endings + leaderboard ---------- */
  function ending(k) {
    S.ended = true; closeModal(); $('#toast').classList.remove('on');
    const [badge, col, title, story] = C.endings[k];
    $('#endBadge').textContent = badge; $('#endBadge').style.color = col; $('#endBadge').style.borderColor = col;
    $('#endTitle').textContent = title; $('#endStory').innerHTML = story;
    const e = Math.min(elapsed(), C.limit); S.endSec = e;
    const total = Object.keys(C.clues).length;
    $('#endStats').textContent = `소요 시간 ${fmt(e)} · 힌트 ${S.hintsUsed}회 · 단서 ${Object.keys(S.clues).length}/${total}`;
    const isTrue = k === 'true';
    $('#retryBtn').style.display = (isTrue || k === 'timeout') ? 'none' : '';
    $('#saveBox').style.display = isTrue ? '' : 'none';
    $('#noSave').style.display = isTrue ? 'none' : '';
    if (isTrue) {
      const prog = store.get('progress', {}); const p = prog[C.id];
      if (!p || e < p.best) prog[C.id] = { best: e, hints: S.hintsUsed, at: Date.now() };
      store.set('progress', prog);
      $('#nick').value = store.get('nick', '');
      if (!S.token) { $('#smsg').className = 'msg'; $('#smsg').textContent = '온라인 랭킹 서버에 연결되지 않아 이 기기에만 기록됐어요.'; }
    }
    const seen = store.get('endings', {}); (seen[C.id] = seen[C.id] || {})[k] = 1; store.set('endings', seen);
    show('ending'); loadBoard();
  }
  function renderBoard(data, myNick) {
    const el = $('#lbEnd'); el.innerHTML = '';
    if (!data) { el.innerHTML = '<p class="lbmsg">온라인 랭킹 서버에 연결되지 않았어요. (배포 후 Redis를 연결하면 켜져요)</p>'; return; }
    if (!data.rows.length) { el.innerHTML = '<p class="lbmsg">아직 기록이 없어요. 첫 번째 탈출자가 되어 보세요!</p>'; return; }
    const t = document.createElement('table'); t.innerHTML = '<tr><th>#</th><th>닉네임</th><th>시간</th><th>힌트</th></tr>';
    data.rows.forEach((r, i) => {
      const tr = document.createElement('tr'); if (myNick && r.nick === myNick) tr.className = 'me';
      [['rk', i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1], ['', r.nick], ['mono', fmt(r.sec)], ['mono', r.hints + '회']].forEach(([c, v]) => { const td = document.createElement('td'); td.className = c; td.textContent = v; tr.appendChild(td); });
      t.appendChild(tr);
    });
    const w = document.createElement('div'); w.className = 'tbl'; w.appendChild(t); el.appendChild(w);
  }
  async function loadBoard(myNick) { renderBoard(await api.scores(C.id), myNick || store.get('nick', '')); }
  async function save() {
    const m = $('#smsg'), nick = $('#nick').value.trim().slice(0, 12);
    if (!nick) { m.className = 'msg err'; m.textContent = '닉네임을 입력하세요.'; return; }
    if (!S.token) { m.className = 'msg err'; m.textContent = '온라인 랭킹 서버에 연결되지 않았어요.'; return; }
    $('#saveBtn').disabled = true; m.className = 'msg'; m.textContent = '저장 중…';
    try {
      const r = await api.finish(S.token, nick, S.hintsUsed);
      store.set('nick', nick);
      m.className = 'msg ok';
      m.textContent = r.improved ? `🏆 기록 완료! 서버 측정 ${fmt(r.sec)} · 현재 ${r.rank}위` : `이전 기록(${fmt(r.bestSec)})이 더 좋아서 유지했어요. 현재 ${r.rank}위`;
      loadBoard(nick);
    } catch (e) { m.className = 'msg err'; m.textContent = e.message; $('#saveBtn').disabled = false; }
  }

  /* ---------- menu ---------- */
  function menu() {
    modal('☰ 메뉴', `<p class="desc"><b>${esc(C.title)}</b><br>${esc(C.sub)}</p>
      <div class="card"><h4>📖 사건 개요</h4><p class="desc" style="margin:0">${C.brief}</p></div>
      <div class="row"><a class="btn ghost wide" href="../index.html" style="text-decoration:none;text-align:center">🚪 방 목록으로 (진행 상황은 사라져요)</a></div>`);
  }

  /* ---------- boot ---------- */
  function boot(config) {
    C = config;
    if (C.theme) document.documentElement.style.setProperty('--theme', C.theme);
    document.title = `${C.title} — DEV EXIT ROOM`;
    skeleton();
    $('#stage').innerHTML = C.stage;
    $('#stage').querySelectorAll('.hs').forEach(h => h.onclick = () => open(h.dataset.k));
    (C.pulse || []).forEach(k => { const el = document.querySelector(`[data-k="${k}"]`); el && el.classList.add('pulse'); });
    $('#mclose').onclick = closeModal;
    $('#modal').onclick = e => { if (e.target.id === 'modal') closeModal(); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
    $('#menuBtn').onclick = menu;
    $('#saveBtn').onclick = save;
    $('#retryBtn').onclick = () => { S.ended = false; show('game'); C.retry && C.retry(); };
    $('#hintBtn').onclick = () => {
      if (S.hints <= 0) return toast('💡 힌트를 모두 썼다. 이제 실력으로…');
      S.hints--; S.hintsUsed++; $('#hintBtn').textContent = '💡 ' + S.hints;
      toast('💡 ' + C.hint(S, has), 7000);
    };
    $('#startBtn').onclick = async () => {
      show('game'); S.start = Date.now(); tick(); setInterval(tick, 1000); updGoal();
      const sc = $('#stageScroll'); sc.scrollLeft = (sc.scrollWidth - sc.clientWidth) * (C.startScroll ?? 0.45);
      if (C.onStart) C.onStart();
      S.token = await api.start(C.id);
    };
    if (C.init) C.init();
    intro();
  }

  window.ER = { boot, S, $, wait, fmt, esc, store, api, addClue, has, toast, mark, modal, closeModal, open, shake, keypad, pwLock, computer, messenger, report, updGoal, ending };
})();
