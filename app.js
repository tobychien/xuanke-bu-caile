(() => {
  const C = window.COURSES, SK = window.SKILLS;
  const DAY = ['', '一', '二', '三', '四', '五', '六', '日'];
  const COLORS = ['#d9480f', '#1d4ed8', '#0f7b4f', '#b54708', '#7c3aed', '#0e7490'];
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = s => String(s ?? '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));

  // ---------- 儲存（localStorage 不可用時退回記憶體） ----------
  const mem = {};
  const store = {
    get(k, d) { try { const v = localStorage.getItem('yzu_' + k); return v ? JSON.parse(v) : (k in mem ? mem[k] : d); } catch { return k in mem ? mem[k] : d; } },
    set(k, v) { mem[k] = v; try { localStorage.setItem('yzu_' + k, JSON.stringify(v)); } catch { } }
  };
  let plan = store.get('plan', []);
  let goals = new Set(store.get('goals', []));
  let curCourse = C[0].code;
  let me = store.get('me', null);

  const GN = ['', '大一', '大二', '大三', '大四'];
  const gradeTxt = c => c.code.startsWith('GE-') ? '通識（各年級）' : c.grades.map(g => GN[g]).join('、');
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 2200); };
  const secName = (c, s) => s.title || c.name;
  const courseKey = (c, s) => c.code.startsWith('GE-') ? c.code + ':' + s.title : c.code;
  const findSec = id => { for (const c of C) for (const s of c.sections) if (s.id === id) return { c, s }; return null; };
  const timeText = slots => {
    const by = {}; slots.forEach(x => (by[x.d] = by[x.d] || []).push(x.p));
    return Object.keys(by).map(d => { const ps = by[d].sort((a, b) => a - b); return `週${DAY[d]} 第${ps.length > 1 ? ps[0] + '–' + ps[ps.length - 1] : ps[0]}節`; }).join('、');
  };

  // ---------- 分頁 ----------
  function show(tab) {
    const nav = { find: 'ask', auto: 'ask', reviews: 'courses' }[tab] || tab;
    $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === nav));
    $$('.panel').forEach(p => p.hidden = p.id !== 'tab-' + tab);
    if (tab === 'career') renderCareer();
    if (tab === 'auto') renderAuto();
    if (tab === 'plan') renderPlan();
    if (tab === 'courses') renderCourses();
    if (tab === 'reviews') renderReviews();
    window.scrollTo({ top: 0 });
  }
  $('#tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) show(b.dataset.tab); });
  $('#sem').textContent = '管理學院學士班 · ' + window.SEMESTER;

  // ---------- 評價資料 ----------
  const API = (window.API_URL || '').trim();
  // 後端 API：POST 一律用 text/plain，避免瀏覽器預檢（Apps Script 不支援 OPTIONS）
  const api = async (body) => { const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body), redirect: 'follow', credentials: 'omit', referrerPolicy: 'no-referrer' }); return r.json(); };
  let cloud = [];
  const approved = () => API ? cloud : store.get('approved', []);
  const allReviews = () => [...window.REVIEWS, ...approved()];
  async function loadCloud() {
    if (!API) return;
    try { const r = await (await fetch(API + '?action=list', { credentials: 'omit', referrerPolicy: 'no-referrer' })).json(); if (r.ok) { cloud = (r.items || []).map(x => ({ id: x.id, code: x.code, teacher: x.teacher, text: x.text, homework: x.homework, grading: x.grading, source: '學生投稿' })); store.set('cloudCache', cloud); } } catch { cloud = store.get('cloudCache', []); }
    if (!$('#tab-reviews').hidden) renderReviews(); if (!$('#tab-courses').hidden) renderCourses();
  }
  function agg(code, teacher, title) {
    const all = allReviews().filter(r => title ? (r.title && (title.includes(r.title) || r.title.includes(title)) && (!r.teacher || !teacher || r.teacher === teacher)) : (r.code === code && (!teacher || r.teacher === teacher)));
    if (!all.length) return null;
    const rs = all.filter(r => !r.other); // 他開的其他課，不算進這門課的星數
    const other = all.length - rs.length;
    const avg = k => { const v = rs.filter(r => r[k]).map(r => r[k]); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
    return { n: rs.length, other, homework: avg('homework'), grading: avg('grading'), gain: avg('gain'), rs };
  }
  const stars = n => n == null ? '—' : '★'.repeat(Math.round(n)) + '☆'.repeat(5 - Math.round(n));

  // ---------- 1. 幫我選課 ----------
  const goalBox = $('#goalChips');
  goalBox.innerHTML = Object.entries(SK).map(([k, v]) => `<button class="chip${goals.has(k) ? ' on' : ''}" data-k="${k}">${v}</button>`).join('');
  goalBox.addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    const k = b.dataset.k; goals.has(k) ? goals.delete(k) : goals.add(k);
    b.classList.toggle('on'); store.set('goals', [...goals]); renderRecs();
  });
  ['prefEarly', 'prefDay', 'prefLang', 'prefGrade'].forEach(id => $('#' + id).addEventListener('change', renderRecs));

  function secOK(s, p) {
    if (p.early && s.slots.some(x => x.p <= 2)) return false;
    if (p.day && s.slots.some(x => x.d === p.day)) return false;
    if (p.lang === 'zh' && s.english) return false;
    if (p.lang === 'en' && !s.english) return false;
    return true;
  }
  function renderRecs() {
    const p = { early: $('#prefEarly').checked, day: +$('#prefDay').value, lang: $('#prefLang').value };
    const g = [...goals]; const pg = +$('#prefGrade').value;
    const rows = C.filter(c => !pg || c.grades.includes(pg)).map(c => {
      const score = g.reduce((a, k) => a + (c.skills[k] || 0), 0);
      const ok = c.sections.filter(s => secOK(s, p));
      return { c, score, ok };
    }).filter(r => g.length ? r.score > 0 : true).sort((a, b) => (b.score - a.score) || (b.ok.length - a.ok.length)).slice(0, 12);
    const box = $('#recs');
    if (!g.length) { box.innerHTML = '<div class="empty">先選一個以上想培養的能力，我就會幫你排出課程順序。</div>'; return; }
    if (!rows.length) { box.innerHTML = '<div class="empty">目前這學期沒有符合這些能力的課，換個能力試試。</div>'; return; }
    box.innerHTML = rows.map((r, i) => {
      const { c } = r;
      const hit = g.filter(k => c.skills[k]).map(k => SK[k]);
      const teachers = [...new Set(r.ok.map(s => s.teacher))];
      const sub = r.ok.length === c.sections.length ? `${c.sections.length} 個班別都符合偏好` : `${c.sections.length} 個班別中，${r.ok.length} 個符合偏好`;
      return `<div class="card rec">
        <div class="rank">${i + 1}</div>
        <div>
          <h4>${esc(c.name)}</h4>
          <div class="meta">${esc(gradeTxt(c))} · ${esc(c.type)} · ${c.credit} 學分 · ${sub}</div>
          <p class="why">對應你的目標：<b>${hit.join('、')}</b>。學到：${c.learn.map(esc).join('、')}。</p>
          <div class="tags">${hit.map(h => `<span class="tag">${h}</span>`).join('')}${c.sections.some(s => s.english) ? '<span class="tag en">有英語授課班</span>' : ''}</div>
          ${r.ok.length ? `<p class="meta" style="margin-top:8px">符合偏好的老師：${teachers.map(esc).join('、')}</p>` : '<p class="meta" style="margin-top:8px;color:var(--bad)">沒有班別符合你的時間或語言偏好，可放寬條件。</p>'}
        </div>
        <button class="btn" data-open="${c.code}">看老師比較</button>
      </div>`;
    }).join('');
  }
  $('#recs').addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) { curCourse = b.dataset.open; show('courses'); } });

  // ---------- 2. 課程與老師 ----------
  const cf = { q: '', grade: 0, type: '' };
  const TYPES = [...new Set(C.map(c => c.type))];
  function renderCourseItems() {
    const list = C.filter(c => (!only4 || c.sections.some(s => starMap()[s.id] >= 4)) && (!cf.grade || c.grades.includes(cf.grade)) && (!cf.type || c.type === cf.type) && (!cf.q || (c.name + c.en + c.code + c.sections.map(s => s.teacher).join('')).toLowerCase().includes(cf.q.toLowerCase())));
    $('#courseItems').innerHTML = list.length ? list.map(c => `<button class="${c.code === curCourse ? 'on' : ''}" data-c="${c.code}"><b>${esc(c.name)}</b><span>${esc(gradeTxt(c))} · ${esc(c.type)} · ${c.credit} 學分 · ${c.sections.length} 班</span></button>`).join('') : '<div class="empty">沒有符合的課程</div>';
  }
  function renderCourses() {
    if (!$('#courseItems')) {
      $('#courseList').innerHTML = `<div class="cfilter"><input id="cfQ" type="search" placeholder="搜尋課名、老師、代碼"><label class="check"><input type="checkbox" id="cfOnly4" ${only4 ? 'checked' : ''}> 只看推薦 4 星以上</label><div class="row2"><select id="cfGrade"><option value="0">全部年級</option>${[1, 2, 3, 4].map(g => `<option value="${g}">${GN[g]}</option>`).join('')}</select><select id="cfType"><option value="">全部修別</option>${TYPES.map(t => `<option>${esc(t)}</option>`).join('')}</select></div></div><div id="courseItems"></div>`;
    }
    renderCourseItems();
    const c = C.find(x => x.code === curCourse);
    const rev = agg(c.code);
    $('#courseDetail').innerHTML = `
      <div class="card">
        <div class="row-between"><div><h2 style="font-size:28px">${esc(c.name)}</h2><div class="meta">${esc(c.en)}</div><button class="btn sm" style="margin-top:8px" data-rev="${c.code}">看評價與投稿</button></div>
          <div class="tags" style="margin:0">${c.programs.map(p => `<span class="tag gray">${esc(p.replace(/^「|」/g, ''))}</span>`).join('')}</div></div>
        <div class="kv">
          <div><small>年級</small><b>${esc(gradeTxt(c))}</b></div>
          <div><small>修別</small><b>${esc(c.type)}</b></div>
          <div><small>學分</small><b>${c.credit}</b></div>
          <div><small>班別</small><b>${c.sections.length} 個</b></div>
          <div><small>先修</small><b>${esc(/無|None|无/.test(c.prereq) ? '無' : c.prereq.slice(0, 16))}</b></div>
        </div>
        <p style="margin-top:16px">${esc(c.objective)}${c.objective.length >= 420 ? '…' : ''}</p>
        <h3>你會學到</h3><div class="tags" style="margin-top:0">${c.learn.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>
        <h3>建議先具備</h3><div class="tags" style="margin-top:0">${c.need.map(x => `<span class="tag need">${esc(x)}</span>`).join('')}</div>
        ${c.auto ? '<p class="meta" style="margin-top:10px">這門課的技能與建議由 AI 依官方大綱自動彙整，僅供參考。</p>' : ''}<h3>適合誰</h3><p>${esc(c.fit)}　<span class="meta">可銜接：${c.careers.map(esc).join('、')}</span></p>
      </div>
      <div class="card">
        <div class="row-between"><h3>老師與班別比較</h3><span class="meta">${rev ? `已有 ${rev.n} 則評價` : '還沒有評價，成為第一個投稿者'}</span></div>
        <div class="table-wrap"><table>
          <thead><tr><th>班別 / 老師</th><th>時間</th><th>成績配分</th><th>推薦指數<br><small class="meta">估算</small></th><th>同學心得</th><th></th></tr></thead>
          <tbody>${c.sections.map(s => secRow(c, s)).join('')}</tbody></table></div>
        ${legend(c)}
        <p class="hint">成績配分取自官方課程大綱，授課教師仍可能調整。推薦指數是依成績配分與同學心得估算的課程負擔與學習量，不是對老師的評分。</p>
      </div>`;
  }
  const gradeColors = {};
  function gcolor(item) { if (!(item in gradeColors)) gradeColors[item] = COLORS[Object.keys(gradeColors).length % COLORS.length]; return gradeColors[item]; }
  function bar(g) {
    if (!g.length) return '<span class="meta">大綱未列</span>';
    const tot = g.reduce((a, b) => a + b.weight, 0) || 1;
    return `<div class="bar" title="${g.map(x => x.item + ' ' + x.weight + '%').join('、')}">${g.map(x => `<i style="width:${x.weight / tot * 100}%;background:${gcolor(x.item)}"></i>`).join('')}</div>
      <div class="meta" style="font-size:12px;margin-top:4px">${g.slice(0, 3).map(x => esc(x.item) + ' ' + x.weight + '%').join(' · ')}${g.length > 3 ? ' …' : ''}</div>`;
  }
  function legend(c) {
    const items = [...new Set(c.sections.flatMap(s => s.grading.map(g => g.item)))].slice(0, 8);
    return items.length ? `<div class="legend">${items.map(i => `<em style="--c:${gcolor(i)}">${esc(i)}</em>`).join('')}</div>` : '';
  }
  function secRow(c, s) {
    const a = agg(c.code, s.teacher, c.code.startsWith('GE-') ? s.title : undefined); const inPlan = plan.includes(s.id);
    return `<tr>
      <td>${s.title ? '<b>' + esc(s.title) + '</b><br>' : ''}<b>${esc(s.cls)}　${esc(s.teacher)}</b><div class="meta">${esc(s.cohort || '')}${s.english ? ' · <span class="tag en">英語授課</span>' : ''}</div></td>
      <td>${esc(timeText(s.slots))}<div class="meta">${esc(s.rooms.join('、'))}</div></td>
      <td style="min-width:180px">${bar(s.grading)}</td>
      <td><span class="stars">${stars(starMap()[s.id])}</span></td>
      <td>${a && a.n ? `<span class="stars">${stars(a.gain ?? a.grading)}</span><div class="meta">${a.n} 則${a.other ? ' · 另有他課 ' + a.other : ''}</div>` : a ? `<span class="meta">本課尚無<br>他課心得 ${a.other} 則</span>` : '<span class="meta">尚無</span>'}</td>
      <td><button class="btn sm ${inPlan ? '' : 'accent'}" data-add="${esc(s.id)}">${inPlan ? '已加入' : '加入課表'}</button></td></tr>`;
  }
  $('#courseList').addEventListener('input', e => { if (e.target.id === 'cfQ') { cf.q = e.target.value; renderCourseItems(); } });
  $('#courseList').addEventListener('change', e => { if (e.target.id === 'cfOnly4') { only4 = e.target.checked; store.set('only4', only4); renderCourseItems(); } if (e.target.id === 'cfGrade') { cf.grade = +e.target.value; renderCourseItems(); } if (e.target.id === 'cfType') { cf.type = e.target.value; renderCourseItems(); } });
  $('#courseList').addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { curCourse = b.dataset.c; renderCourses(); } });
  $('#courseDetail').addEventListener('click', e => { const rv = e.target.closest('[data-rev]'); if (rv) { $('#revCourse').value = rv.dataset.rev; show('reviews'); return; } const b = e.target.closest('[data-add]'); if (b) { addToPlan(b.dataset.add); renderCourses(); } });

  // ---------- 3. 模擬課表 ----------
  function addToPlan(id) {
    const f = findSec(id); if (!f) return;
    const same = plan.find(x => { const o = findSec(x); return courseKey(o.c, o.s) === courseKey(f.c, f.s); });
    if (same === id) { plan = plan.filter(x => x !== id); toast('已移出課表'); }
    else { plan = plan.filter(x => x !== same); plan.push(id); toast(same ? `已改選 ${secName(f.c, f.s)} ${f.s.cls} 班` : `已加入 ${secName(f.c, f.s)}`); }
    store.set('plan', plan); updateBadge();
  }
  function updateBadge() { const b = $('#planCount'); b.textContent = plan.length; b.hidden = !plan.length; }
  function conflicts() {
    const seen = {}, clash = new Set();
    plan.forEach(id => findSec(id).s.slots.forEach(x => { const k = x.d + '-' + x.p; if (seen[k]) { clash.add(k); } else seen[k] = id; }));
    return clash;
  }
  // 選課面板的篩選狀態：day=0 表示不限星期；exact 是點格子時鎖定的單一節次
  const RANGES = { all: [1, 14], am: [1, 4], noon: [5, 5], pm: [6, 9], eve: [10, 14] };
  const pick = { day: 0, range: 'all', exact: null };
  const periodTime = p => { const m = 8 * 60 + 10 + (p - 1) * 60; return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0'); };
  function renderGrid(clash) {
    const cell = {};
    plan.forEach(id => { const { c, s } = findSec(id); s.slots.forEach(x => { (cell[x.d + '-' + x.p] = cell[x.d + '-' + x.p] || []).push({ id, name: secName(c, s) }); }); });
    let h = '<div class="grid"><div></div>' + [1, 2, 3, 4, 5].map(d => `<div class="h">週${DAY[d]}</div>`).join('');
    for (let p = 1; p <= 12; p++) {
      h += `<div class="p"><span>${p}<small>${periodTime(p)}</small></span></div>`;
      for (let d = 1; d <= 5; d++) {
        const k = d + '-' + p, v = cell[k] || [];
        const on = pick.exact && pick.day === d && pick.exact === p;
        h += `<div class="c ${v.length ? 'has' : ''} ${clash.has(k) ? 'clash' : ''} ${on ? 'focus' : ''}" data-d="${d}" data-p="${p}" role="button" tabindex="0" aria-label="週${DAY[d]}第${p}節，點擊查看可選課程">${v.map(x => `<span class="cn">${esc(x.name)}<button class="cx" data-rm="${esc(x.id)}" aria-label="移除 ${esc(x.name)}">×</button></span>`).join('')}</div>`;
      }
    }
    $('#grid').innerHTML = h + '</div>';
  }
  function matchSections() {
    const [lo, hi] = pick.exact ? [pick.exact, pick.exact] : RANGES[pick.range];
    const out = [];
    C.forEach(c => c.sections.forEach(s => { if (s.slots.some(x => (!pick.day || x.d === pick.day) && x.p >= lo && x.p <= hi)) out.push({ c, s }); }));
    return out.sort((a, b) => (Math.min(...a.s.slots.map(x => x.d * 100 + x.p)) - Math.min(...b.s.slots.map(x => x.d * 100 + x.p))) || a.c.code.localeCompare(b.c.code));
  }
  function clashWith(s, selfId) { // 回傳會跟這個班別衝堂的已選課名稱
    const names = new Set();
    plan.forEach(id => { if (id === selfId) return; const o = findSec(id); if (courseKey(o.c, o.s) === courseKey(findSec(selfId).c, findSec(selfId).s)) return; if (o.s.slots.some(x => s.slots.some(y => y.d === x.d && y.p === x.p))) names.add(secName(o.c, o.s)); });
    return [...names];
  }
  function renderPicker() {
    const label = (pick.day ? '週' + DAY[pick.day] : '每天') + (pick.exact ? ` 第${pick.exact}節` : { all: '', am: ' 上午（第1–4節）', noon: ' 中午（第5節）', pm: ' 下午（第6–9節）', eve: ' 晚間（第10節起）' }[pick.range]);
    const idle = !pick.day && pick.range === 'all' && !pick.exact;
    const all = idle ? [] : matchSections(), list = all.slice(0, 60);
    $('#pickerBox').innerHTML = `<div class="row-between"><h3 style="margin:0">可選課程 · ${label}</h3><span class="meta">${idle ? '' : all.length + ' 個班別'}</span></div>
      <div class="prefs" style="margin:12px 0">
        <label class="field">星期<select id="pkDay"><option value="0">不限</option>${[1, 2, 3, 4, 5].map(d => `<option value="${d}" ${pick.day === d ? 'selected' : ''}>週${DAY[d]}</option>`).join('')}</select></label>
        <label class="field">時段<select id="pkRange"><option value="all">全天</option><option value="am">上午（1–4）</option><option value="noon">中午（5）</option><option value="pm">下午（6–9）</option><option value="eve">晚間（10–）</option></select></label>
        ${pick.exact ? '<button class="ghost" id="pkClear">取消鎖定單一節次</button>' : ''}
      </div>
      <div>${list.length ? list.map(({ c, s }) => {
        const sel = plan.includes(s.id); const sameCourse = plan.find(id => { const o = findSec(id); return courseKey(o.c, o.s) === courseKey(c, s) && id !== s.id; }); const cl = sel ? [] : clashWith(s, s.id);
        const btn = sel ? `<button class="btn sm" data-pkrm="${esc(s.id)}">移除</button>` : `<button class="btn sm accent" data-pkadd="${esc(s.id)}">${sameCourse ? '改選此班' : '加入'}${cl.length ? '（衝堂）' : ''}</button>`;
        return `<div class="sel ${sel ? 'picked' : ''}"><div><b>${esc(secName(c, s))}</b> <small>${esc(s.cls)} 班 · ${esc(s.teacher)}${s.english ? ' · 英語授課' : ''}</small><br><small>${esc(timeText(s.slots))}</small>${sel ? ' <span class="tag en">已選</span>' : ''}${cl.length ? `<br><small style="color:var(--bad)">會與「${cl.map(esc).join('、')}」衝堂</small>` : ''}${sameCourse && !sel ? `<br><small>你已選此課的 ${esc(findSec(sameCourse).s.cls)} 班，加入會改選</small>` : ''}</div>${btn}</div>`;
      }).join('') + (all.length > list.length ? `<div class="meta" style="padding:10px">還有 ${all.length - list.length} 個班別，請縮小星期或時段。</div>` : '') : (idle ? '<div class="empty">點上方課表的任一格，這裡會列出該時段可以選的課。</div>' : '<div class="empty">這個時段沒有開課。</div>')}</div>`;
    $('#pkRange').value = pick.range;
  }
  function renderPlan() {
    const clash = conflicts(); renderGrid(clash); renderPicker();
    const credits = plan.reduce((a, id) => a + (findSec(id).c.credit || 0), 0);
    $('#planSummary').innerHTML = `<h3>已選 ${plan.length} 門</h3>
      <div class="stat"><div><b>${credits}</b><span>總學分</span></div><div><b>${new Set(plan.map(id => findSec(id).s.teacher)).size}</b><span>位老師</span></div><div><b>${clash.size}</b><span>個衝堂節次</span></div></div>
      ${clash.size ? '<div class="alert bad">有衝堂，請改選其他班別。紅色格子是衝堂的節次。</div>' : plan.length ? '<div class="alert ok">目前沒有衝堂。</div>' : ''}
      <div style="margin-top:12px">${plan.length ? plan.map(id => { const { c, s } = findSec(id); return `<div class="sel"><div><b>${esc(secName(c, s))}</b> <small>${esc(s.cls)} 班 · ${esc(s.teacher)}</small><br><small>${esc(timeText(s.slots))}</small></div><button class="xbtn" aria-label="移除" data-rm="${esc(id)}">×</button></div>`; }).join('') : '<div class="empty">還沒有課，到「課程與老師」加入班別。</div>'}</div>`;
    renderFuture();
  }
  function cellPick(e) {
    const rm = e.target.closest('[data-rm]'); if (rm) { plan = plan.filter(x => x !== rm.dataset.rm); store.set('plan', plan); updateBadge(); toast('已移出課表'); renderPlan(); return; }
    const c = e.target.closest('.c'); if (!c) return;
    pick.day = +c.dataset.d; pick.exact = +c.dataset.p; pick.range = 'all'; renderGrid(conflicts()); renderPicker();
    $('#pickerBox').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
  $('#grid').addEventListener('click', cellPick);
  $('#grid').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('c')) { e.preventDefault(); cellPick(e); } });
  $('#pickerBox').addEventListener('change', e => {
    if (e.target.id === 'pkDay') { pick.day = +e.target.value; pick.exact = null; }
    if (e.target.id === 'pkRange') { pick.range = e.target.value; pick.exact = null; }
    renderGrid(conflicts()); renderPicker();
  });
  $('#pickerBox').addEventListener('click', e => {
    if (e.target.id === 'pkClear') { pick.exact = null; renderGrid(conflicts()); renderPicker(); return; }
    const add = e.target.closest('[data-pkadd]'), rm = e.target.closest('[data-pkrm]');
    if (add) { addToPlan(add.dataset.pkadd); renderPlan(); }
    if (rm) { plan = plan.filter(x => x !== rm.dataset.pkrm); store.set('plan', plan); updateBadge(); toast('已移出課表'); renderPlan(); }
  });
  $('#planSummary').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (b) { plan = plan.filter(x => x !== b.dataset.rm); store.set('plan', plan); updateBadge(); renderPlan(); } });
  $('#clearPlan').addEventListener('click', () => { plan = []; store.set('plan', plan); updateBadge(); renderPlan(); });

  function renderFuture() {
    const box = $('#futureCard');
    if (!plan.length) { box.innerHTML = '<h3>未來建議方向</h3><div class="empty">選幾門課後，我會分析你的能力分布，並建議下一步。</div>'; return; }
    const tot = {}, careers = {}, progs = new Set(); const chosen = plan.map(id => findSec(id).c);
    chosen.forEach(c => { Object.entries(c.skills).forEach(([k, v]) => tot[k] = (tot[k] || 0) + v); c.careers.forEach(x => careers[x] = (careers[x] || 0) + 1); c.programs.forEach(p => progs.add(p.replace(/^「|」/g, ''))); });
    const ranked = Object.entries(tot).sort((a, b) => b[1] - a[1]); const mx = ranked[0][1];
    const top = ranked.slice(0, 2).map(x => SK[x[0]]);
    const missing = Object.keys(SK).filter(k => !tot[k]);
    const next = C.filter(c => !plan.some(id => findSec(id).c.code === c.code)).map(c => ({ c, v: missing.reduce((a, k) => a + (c.skills[k] || 0), 0) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 2);
    box.innerHTML = `<h3>未來建議方向</h3>
      ${ranked.map(([k, v]) => `<div class="sk"><span>${SK[k]}</span><div class="t"><i style="width:${v / mx * 100}%"></i></div><b>${v}</b></div>`).join('')}
      <p style="margin-top:12px">這份課表偏向<b>${top.join('、')}</b>。${Object.keys(careers).length ? '可以往 <b>' + Object.entries(careers).sort((a, b) => b[1] - a[1]).slice(0, 3).map(x => esc(x[0])).join('、') + '</b> 發展。' : ''}</p>
      ${progs.size ? `<p class="meta" style="margin-top:8px">相關學程：${[...progs].slice(0, 4).map(esc).join('、')}</p>` : ''}
      ${next.length ? `<h3>可以補強</h3>${next.map(x => `<div class="sel"><div><b>${esc(x.c.name)}</b><br><small>補上：${Object.keys(x.c.skills).filter(k => !tot[k]).map(k => SK[k]).join('、')}</small></div><button class="btn sm" data-open="${x.c.code}">看班別</button></div>`).join('')}` : ''}`;
  }
  $('#futureCard').addEventListener('click', e => { const b = e.target.closest('[data-open]'); if (b) { curCourse = b.dataset.open; show('courses'); } });

  // ---------- 4. 評價與投稿 ----------
  const revSel = $('#revCourse');
  revSel.innerHTML = C.map(c => `<option value="${c.code}">${esc(c.name)}</option>`).join('') + '<option value="GE-ALL">通識：歷年心得（不分領域）</option>';
  revSel.addEventListener('change', renderReviews);
  function renderReviews() {
    const code = revSel.value || C[0].code; revSel.value = code;
    const c = C.find(x => x.code === code) || { name: '通識：歷年心得' };
    const rs = allReviews().filter(r => code === 'GE-ALL' ? r.code.startsWith('GE') : r.code === code);
    $('#revList').innerHTML = rs.length ? rs.map(r => `<div class="review">
        <div class="row-between"><span class="who">${r.title ? esc(r.title) + (r.teacher ? ' · ' : '') : ''}${r.teacher ? esc(r.teacher) + ' 老師' : ''}</span><span class="tag gray">${esc(r.source || '學生投稿')}</span></div>
        ${r.score || r.when ? `<div class="meta">${[r.score, r.when].filter(Boolean).map(esc).join(' · ')}</div>` : ''}${r.summary ? `<p>${esc(r.summary)}</p>` : ''}${r.note ? `<p class="meta" style="margin-top:6px">⚠ ${esc(r.note)}</p>` : ''}
        ${r.text ? `<p>${esc(r.text)}</p>` : ''}
        ${(r.points || []).length ? `<div class="tags">${r.points.map(x => `<span class="tag">${esc(x)}</span>`).join('')}</div>` : ''}
        <div class="meta" style="margin-top:8px">作業量 <span class="stars">${stars(r.homework)}</span>　給分 <span class="stars">${stars(r.grading)}</span>${r.derived ? '<br><span style="font-size:12px">星數是依貼文描述的成績與評分項目換算，不是原作者打的分數</span>' : ''}</div></div>`).join('')
      : `<div class="empty">「${esc(c.name)}」還沒有評價。<br>右邊匿名投稿，審核通過後會顯示在這裡。</div>`;
    renderForm(code);
  }
  function renderForm(code) {
    const c = C.find(x => x.code === code);
    if (!c) { $('#revForm').dataset.code = ''; $('#revForm').innerHTML = '<h3>匿名投稿評價</h3><p class="hint" style="margin-top:0">這個選項是歷年心得的彙整。要投稿請先在上方選擇該通識的領域（人文藝術、社會科學、自然科學、生命科學）。</p>'; return; } const teachers = [...new Set(c.sections.map(s => s.teacher))];
    const rate = (id, label) => `<label>${label}<select id="${id}"><option value="">不評</option>${[5, 4, 3, 2, 1].map(n => `<option value="${n}">${n}</option>`).join('')}</select></label>`;
    if (!$('#revForm').dataset.code || $('#revForm').dataset.code !== code) {
      $('#revForm').dataset.code = code;
      $('#revForm').innerHTML = `<h3>匿名投稿評價</h3><p class="hint" style="margin-top:0">不會收集姓名或學號。內容會先經 AI 預審，再由人工確認後上架。</p>
      <div class="msg ok" style="margin-bottom:10px">請只寫客觀事實：上課怎麼進行、作業與考試的份量、成績由哪些項目組成、需要什麼先備知識。避免情緒用語、對老師個人的評價與沒有根據的傳聞，違反的投稿不會上架。</div>
      <div class="form">
        <label>老師<select id="fTeacher">${teachers.map(t => `<option>${esc(t)}</option>`).join('')}</select></label>
        <div class="rates">${rate('fHw', '作業量（5=很多）')}${rate('fGr', '成績分布（5=偏高）')}</div>
        <label>課程描述<textarea id="fText" maxlength="300" placeholder="例如：成績由小考 30%、期中 30%、期末 40% 組成；每週一份作業；期末需分組報告。"></textarea></label>
        <div class="row-between" style="margin-top:14px"><span class="meta" id="fCount">0 / 300</span><button class="btn accent" id="fSubmit">送出審核</button></div>
        <input id="fHp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
        <div id="fMsg"></div></div>`;
      $('#fText').addEventListener('input', e => $('#fCount').textContent = e.target.value.length + ' / 300');
      $('#fSubmit').addEventListener('click', submitReview);
    }
  }
  // AI 預審（規則版）：偵測個資、人身攻擊、內容太短。正式版改接 Claude 判斷。
  function precheck(t) {
    const why = [];
    if (t.trim().length < 15) why.push('內容太短，請至少寫 15 個字');
    if (/(\+?886|09)\d{2}[- ]?\d{3}[- ]?\d{3}/.test(t) || /[\w.+-]+@[\w-]+\.[\w.]+/.test(t)) why.push('疑似包含電話或 Email');
    if (/(line\s*id|ig\s*[:：]|@\w{3,})/i.test(t)) why.push('疑似包含社群帳號');
    if (/\b[A-Za-z]?\d{7,9}\b/.test(t)) why.push('疑似包含學號或證號');
    if (/(白痴|智障|去死|廢物|垃圾人|幹你|王八|婊)/.test(t)) why.push('含有人身攻擊或不當用語');
    if (/(性騷|騷擾|收賄|貪污|抄襲.*老師|違法)/.test(t)) why.push('含有嚴重指控，需人工查證');
    if (/(很爛|超爛|爛課|踩雷|避雷|大雷|地雷|坑人|很糟|超糟|最糟|垃圾|誤人子弟|敷衍|不負責|災難|地獄|神課|天使|超讚|超強|大推|必選|千萬別|千萬不要|避雷|崩潰|氣死|火大|噁心|討厭|可怕)/.test(t)) why.push('含有主觀或情緒用語，請改成客觀描述（例如具體的作業量、考試方式、成績組成）');
    if (/(聽說|據說|好像|傳聞|有人說)/.test(t)) why.push('含有未經查證的傳聞，請只寫自己親身經歷的事');
    return why;
  }
  const ERR = { too_short: '內容太短', too_long: '內容太長', rejected: '內容未通過預審', rate_limited: '投稿太頻繁，請稍後再試', busy: '目前待審核的投稿太多，請稍後再試', bad_course: '課程資料有誤', server_error: '伺服器暫時有問題，請稍後再試' };
  async function submitReview() {
    const text = $('#fText').value.trim(); const msg = $('#fMsg'); const why = precheck(text);
    if (why.length) { msg.innerHTML = `<div class="msg warn">這則投稿暫時無法送出：${why.join('；')}。請修改後再送出。</div>`; return; }
    if (API) {
      let cid = store.get('cid', ''); if (!cid) { cid = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2) + Date.now()).replace(/[^A-Za-z0-9_-]/g, ''); store.set('cid', cid); }
      const btn = $('#fSubmit'); btn.disabled = true; msg.innerHTML = '<div class="hint">送出中…</div>';
      try {
        const r = await api({ action: 'submit', cid, code: $('#revForm').dataset.code, teacher: $('#fTeacher').value, text, homework: +$('#fHw').value || null, grading: +$('#fGr').value || null, hp: ($('#fHp') || {}).value || '' });
        if (r.ok) { msg.innerHTML = '<div class="msg ok">已送出，人工確認後會顯示在評價列表。</div>'; $('#fText').value = ''; $('#fCount').textContent = '0 / 300'; }
        else msg.innerHTML = `<div class="msg warn">${esc(ERR[r.error] || '送出失敗')}${r.reasons ? '：' + r.reasons.map(esc).join('；') : ''}</div>`;
      } catch { msg.innerHTML = '<div class="msg warn">連不上伺服器，請稍後再試。</div>'; }
      btn.disabled = false; return;
    }
    const item = { id: 'r' + Date.now(), code: $('#revForm').dataset.code, teacher: $('#fTeacher').value, text, homework: +$('#fHw').value || null, grading: +$('#fGr').value || null, source: '學生投稿', ai: why.length ? { level: 'flag', reasons: why } : { level: 'pass', reasons: [] } };
    store.set('pending', [...store.get('pending', []), item]);
    msg.innerHTML = why.length
      ? `<div class="msg warn">AI 預審標記：${why.join('；')}。已送交人工審核，不會直接上架。</div>`
      : '<div class="msg ok">AI 預審通過，已送交人工審核，確認後會顯示在評價列表。</div>';
    $('#fText').value = ''; $('#fCount').textContent = '0 / 300';
  }

  if (API) loadCloud();

  // ---------- 6. 自動選課 ----------
  const MODES = {
    cool: ['最涼', '考試少、平時分高、作業輕'],
    learn: ['學最多', '作業與實作多、技能涵蓋廣'],
    balance: ['均衡', '涼與學習各半'],
    tight: ['時間最順', '上課天數少、空堂少']
  };
  const COHORTS = [['', '不限'], ['行銷與人資', '行銷與人資'], ['財金', '財金'], ['國企管', '國企管'], ['會計', '會計'], ['英專', '英專班']];
  const MUST_TYPES = ['院必修', '管院共同必修', '共同必修'];
  // ---------- 畢業要求（教務處「管理學院學士班必修科目表」，依入學學年） ----------
  const ENTRY = { 1: 115, 2: 114, 3: 113, 4: 112 };
  const REQS = window.REQS || {};
  const cat = code => C.find(c => c.code === code);
  let REQC = null;
  function reqInfo() {
    if (REQC !== null) return REQC || null;
    REQC = false;
    if (!me || !me.program || me.grade < 2) return null;
    const [kind, name] = me.program.split('|'); const R = REQS[ENTRY[me.grade]]; if (!R) return null;
    const conc = (R[kind] || R.CM).conc.find(c => c.name === name); if (!conc) return null;
    const single = new Set(), groups = [];
    conc.required.forEach(g => g.length === 1 ? single.add(g[0]) : groups.push(g));
    const dept = (kind === 'CMBP' && R.CMBP.dept.length ? R.CMBP.dept : R.CM.dept); dept.forEach(d => single.add(d.code));
    REQC = { conc, kind, dept, single, groups, done: new Set(me.done || []), entry: ENTRY[me.grade] };
    return REQC;
  }
  function reqPlan(g) {
    const ri = reqInfo(); if (!ri) return null;
    const offered = code => { const c = cat(code); return c && !ri.done.has(code) && c.sections.some(s => (s.grade || 1) >= g && (s.grade || 1) <= g + 1); };
    const must = [...ri.single].filter(offered);
    const opt = new Set(); ri.groups.forEach(gr => gr.forEach(x => opt.add(x))); ri.conc.courses.forEach(k => opt.add(k.code));
    must.forEach(x => opt.delete(x));
    const pool = [...opt].filter(offered);
    return { must, pool, req: new Set([...must, ...pool]) };
  }
  let REQA = new Set();
  const defaultMust = (g = 1) => { const rp = me && g === me.grade ? reqPlan(g) : null; return rp ? rp.must : defaultMustOld(g); };
  const defaultPool = (g = 1) => { const rp = me && g === me.grade ? reqPlan(g) : null; const old = defaultPoolOld(g); return rp ? [...new Set([...rp.pool, ...old.filter(x => !rp.must.includes(x))])] : old; };
  const defaultMustOld = (g = 1) => C.filter(c => MUST_TYPES.includes(c.type) && c.grades.includes(g)).map(c => c.code);
  const defaultPoolOld = (g = 1) => C.filter(c => !MUST_TYPES.includes(c.type) && (c.code.startsWith('GE-') || c.grades.includes(g))).map(c => c.code);
  const stAuto = store.get('auto', {}); if (stAuto.v !== 3) { delete stAuto.must; delete stAuto.pool; }
  let only4 = store.get('only4', true), only4Eff = only4;
  const auto = Object.assign({ v: 3, mode: 'cool', grade: 1, cohort: '', early: false, day: 0, lang: 'any', level: 'any', target: 18, must: defaultMust(), pool: defaultPool() }, stAuto, { v: 3 });
  const setGrade = g => { auto.grade = g; auto.must = defaultMust(g); auto.pool = defaultPool(g); if (g > 1) auto.cohort = ''; };
  const secGradeOK = (c, s) => c.code.startsWith('GE-') || (s.grade || 1) === auto.grade || (REQA.has(c.code) && (s.grade || 1) >= auto.grade && (s.grade || 1) <= auto.grade + 1);
  let autoRes = null;
  const saveAuto = () => store.set('auto', auto);

  // 依官方成績配分分類
  function weights(s) {
    let exam = 0, quiz = 0, hw = 0, att = 0, team = 0;
    s.grading.forEach(g => {
      const n = g.item, w = g.weight;
      if (/quiz|小考|測驗/i.test(n)) quiz += w;
      else if (/考|exam|midterm|final/i.test(n)) exam += w;
      else if (/平時|出席|參與|participation|attendance|表現|課堂/i.test(n)) att += w;
      else if (/作業|homework|assignment|報告|report|paper|專題|project|presentation|簡報|團隊|team|group|實作|MyET/i.test(n)) hw += w;
      if (/團隊|小組|team|group|專題|project/i.test(n)) team += w;
    });
    return { exam: exam + quiz * 0.5, hw: hw + quiz * 0.5, att, team, known: s.grading.length > 0 };
  }
  function rawScores(c, s) {
    const w = weights(s); const a = agg(c.code, s.teacher, c.code.startsWith('GE-') ? s.title : undefined); const cr = s.credit ?? c.credit ?? 0;
    let cool = 60 - 0.55 * w.exam - 0.35 * w.hw + 0.25 * w.att - (w.team ? 6 : 0) - (s.lab ? 5 : 0) - (s.english ? 6 : 0) - cr * 2;
    const fit = goals.size ? [...goals].reduce((x, k) => x + (c.skills[k] || 0), 0) * 6 : Object.values(c.skills).reduce((x, v) => x + v, 0) * 2;
    let learn = fit + 0.3 * w.hw + (w.team ? 4 : 0) + (s.english ? 5 : 0) + (s.service ? 3 : 0) + (s.lab ? 3 : 0) + cr * 3;
    if (a) {
      if (a.homework) cool += (3 - a.homework) * 6;
      if (a.grading) cool += (a.grading - 3) * 6;
      if (a.gain) learn += (a.gain - 3) * 8;
    }
    const ri = reqInfo(); if (ri && ri.conc.courses.some(k => k.code === c.code)) { cool += 14; learn += 14; }
    return { cool, learn, w };
  }
  function buildScores() {
    const rows = []; C.forEach(c => c.sections.forEach(s => rows.push({ c, s, ...rawScores(c, s) })));
    const norm = k => { const v = rows.map(r => r[k]); const lo = Math.min(...v), hi = Math.max(...v); rows.forEach(r => r[k + 'N'] = hi === lo ? 50 : (r[k] - lo) / (hi - lo) * 100); };
    norm('cool'); norm('learn');
    const map = {}; rows.forEach(r => map[r.s.id] = r); return map;
  }
  const secCredit = (c, s) => s.credit ?? c.credit ?? 0;
  const cohortOK = (s, co) => !co || !s.cohort || s.cohort.includes(co);

  function solve() {
    const S = buildScores(); const warn = []; { const rp = me && auto.grade === me.grade ? reqPlan(auto.grade) : null; REQA = rp ? rp.req : new Set(); }
    const val = r => auto.mode === 'cool' ? r.coolN : auto.mode === 'learn' ? r.learnN : (r.coolN + r.learnN) / 2 * (auto.mode === 'tight' ? 0.3 : 1);
    const baseOK = s => !(auto.early && s.slots.some(x => x.p <= 2)) && !(auto.day && s.slots.some(x => x.d === auto.day))
      && !(auto.lang === 'zh' && s.english) && !(auto.lang === 'en' && !s.english);
    const mk = (c, pool) => {
      let list = c.sections.filter(s => baseOK(s) && secGradeOK(c, s) && cohortOK(s, auto.cohort) && !(c.code === 'LC101' && auto.level !== 'any' && s.level !== auto.level))
        .map(s => ({ s, r: S[s.id], v: val(S[s.id]) }));
      if (only4Eff) { const good = list.filter(e => starMap()[e.s.id] >= 4); if (pool || good.length) list = good; }
      list.sort((a, b) => b.v - a.v);
      if (pool) list = list.slice(0, 8); // 補學分用的課只留分數最高的 8 個班，避免搜尋爆量
      return { c, pool, list, max: list.length ? list[0].v : 0 };
    };
    const must = []; const poolG = [];
    for (const code of auto.must) {
      const c = C.find(x => x.code === code); if (!c) continue;
      const g = mk(c, false);
      if (!g.list.length) {
        const anyBase = c.sections.some(s => baseOK(s));
        if (auto.cohort && anyBase) { warn.push(`「${c.name}」這學期沒有開給「${auto.cohort}」配班，已略過。`); continue; }
        return { err: `「${c.name}」沒有符合條件的班別，請放寬限制（早課、星期、語言、英語分級）或取消這門必修。` };
      }
      must.push(g);
    }
    for (const code of auto.pool) { const c = C.find(x => x.code === code); if (!c) continue; const g = mk(c, true); if (g.list.length) poolG.push(g); }
    poolG.sort((x, y) => y.max - x.max); if (poolG.length > 14) poolG.length = 14;
    if (!must.length && !poolG.length) return { err: '沒有可排的課，請先勾選要修的課。' };

    const TARGET = +auto.target || 0, PEN = 100;
    function search(mustSet) {
      const groups = [...mustSet.slice().sort((a, b) => a.list.length - b.list.length), ...poolG];
      const n = groups.length;
      const sufV = [], sufCr = []; let av = 0, ac = 0;
      for (let i = n - 1; i >= 0; i--) { av += groups[i].max; ac += Math.max(0, ...groups[i].list.map(e => secCredit(groups[i].c, e.s))); sufV[i] = av; sufCr[i] = ac; }
      const best = []; let nodes = 0; const pickd = []; const occ = new Set(); const dayCnt = {};
      function finish(total, credits) {
        let pen = PEN * Math.abs(credits - TARGET);
        if (auto.mode === 'tight') {
          const by = {}; pickd.forEach(e => e.s.slots.forEach(x => (by[x.d] = by[x.d] || new Set()).add(x.p)));
          let gaps = 0; Object.values(by).forEach(set => { const a = [...set]; gaps += Math.max(...a) - Math.min(...a) + 1 - a.length; });
          pen += Object.keys(by).length * 25 + gaps * 10;
        }
        const t = total - pen;
        const key = pickd.map(e => e.s.id).sort().join('|');
        if (best.some(b => b.key === key)) return;
        if (best.length < 3 || t > best[best.length - 1].t) { best.push({ key, t, credits, items: pickd.slice() }); best.sort((a, b) => b.t - a.t); if (best.length > 3) best.pop(); }
      }
      function dfs(i, total, credits) {
        if (++nodes > 3e6) return;
        if (i === n) { finish(total, credits); return; }
        if (best.length === 3) {
          const usedDays = auto.mode === 'tight' ? Object.keys(dayCnt).length * 25 : 0;
          const ub = total + sufV[i] - PEN * Math.max(0, credits - TARGET) - PEN * Math.max(0, TARGET - credits - sufCr[i]) - usedDays;
          if (ub <= best[2].t) return;
        }
        const g = groups[i];
        for (const e of g.list) {
          const keys = e.s.slots.map(x => x.d + '-' + x.p);
          if (keys.some(k => occ.has(k))) continue;
          keys.forEach(k => occ.add(k)); e.s.slots.forEach(x => dayCnt[x.d] = (dayCnt[x.d] || 0) + 1);
          pickd.push({ ...e, c: g.c, pool: g.pool });
          dfs(i + 1, total + e.v, credits + secCredit(g.c, e.s));
          pickd.pop(); keys.forEach(k => occ.delete(k)); e.s.slots.forEach(x => { if (!--dayCnt[x.d]) delete dayCnt[x.d]; });
        }
        if (g.pool) dfs(i + 1, total, credits); // 補學分用的課可以不選
      }
      dfs(0, 0, 0);
      return best;
    }

    let best = search(must);
    if (!best.length) { // 必修全排進去一定衝堂：逐步少修 1～3 門
      const combos = (arr, k) => k === 0 ? [[]] : arr.flatMap((x, i) => combos(arr.slice(i + 1), k - 1).map(r => [x, ...r]));
      for (let k = 1; k <= Math.min(3, must.length - 1) && !best.length; k++) {
        const found = [];
        for (const sub of combos(must, k)) {
          const r = search(must.filter(x => !sub.includes(x)));
          r.forEach(b => { b.dropped = sub.map(x => x.c.name); found.push(b); });
        }
        found.sort((a, b) => b.t - a.t); best = found.slice(0, 3);
      }
    }
    if (!best.length) return { err: '這些必修在你的限制下一定會衝堂。可以取消幾門，或放寬早課／星期的限制。' };
    return { sols: best.map(b => ({ t: b.t, credits: b.credits, dropped: b.dropped || [], items: b.items.sort((x, y) => (x.pool - y.pool) || x.c.code.localeCompare(y.c.code)) })), warn, target: TARGET };
  }

  function syncChips() { $$('#goalChips .chip, #autoGoals .chip').forEach(b => b.classList.toggle('on', goals.has(b.dataset.k))); }
  function courseChip(c, list, grp) {
    const on = list.includes(c.code);
    return `<label class="chip ${on ? 'on' : ''}"><input type="checkbox" data-grp="${grp}" data-course="${c.code}" ${on ? 'checked' : ''} hidden>${esc(c.name)} · ${c.credit}</label>`;
  }
  function renderAuto() {
    const mustC = C.filter(c => MUST_TYPES.includes(c.type) && c.grades.includes(auto.grade)), poolC = C.filter(c => !MUST_TYPES.includes(c.type) && (c.code.startsWith('GE-') || c.grades.includes(auto.grade)));
    $('#autoBox').innerHTML = `<div class="card">
      <h3>1. 你想要什麼樣的課表</h3>
      <div class="modes">${Object.entries(MODES).map(([k, v]) => `<button class="mode ${auto.mode === k ? 'on' : ''}" data-mode="${k}"><b>${v[0]}</b><span>${v[1]}</span></button>`).join('')}</div>
      <h3>2. 想培養的能力 <small>會影響「學最多」的分數，與「幫我選課」同步</small></h3>
      <div id="autoGoals" class="chips">${Object.entries(SK).map(([k, v]) => `<button class="chip ${goals.has(k) ? 'on' : ''}" data-k="${k}">${v}</button>`).join('')}</div>
      <h3>3. 限制條件</h3>
      <div class="prefs">
        <label class="field">年級<select id="aGrade">${[1, 2, 3, 4].map(g => `<option value="${g}" ${auto.grade === g ? 'selected' : ''}>${GN[g]}</option>`).join('')}</select></label>
        ${auto.grade === 1 ? `<label class="field">我的配班<select id="aCohort">${COHORTS.map(([v, t]) => `<option value="${v}" ${auto.cohort === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>` : ''}
        <label class="field">目標學分<input type="number" id="aTarget" min="0" max="28" value="${auto.target}" style="width:72px"></label>
        <label class="check"><input type="checkbox" id="aEarly" ${auto.early ? 'checked' : ''}> 避開早課（第 1–2 節）</label>
        <label class="field">避開星期<select id="aDay"><option value="0">不限</option>${[1, 2, 3, 4, 5].map(d => `<option value="${d}" ${auto.day === d ? 'selected' : ''}>週${DAY[d]}</option>`).join('')}</select></label>
        <label class="field">授課語言<select id="aLang"><option value="any">不限</option><option value="zh" ${auto.lang === 'zh' ? 'selected' : ''}>只要中文</option><option value="en" ${auto.lang === 'en' ? 'selected' : ''}>只要英語</option></select></label>
        <label class="field">英語（一）程度<select id="aLevel">${[['any', '不限'], ['基礎', '基礎'], ['中階', '中階'], ['進階', '進階']].map(([v, t]) => `<option value="${v}" ${auto.level === v ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      </div>
      <h3>4. 一定要修的課 <small>${GN[auto.grade]}的院必修與共同必修，每門都會幫你挑一個班別</small></h3>
      <div class="chips">${mustC.map(c => courseChip(c, auto.must, 'must')).join('')}</div>
      <h3>5. 學分不夠時，拿來補滿的課 <small>選修與通識，只在湊不到目標學分時才會排進去（分數最高的前 14 門）</small></h3>
      <div class="chips">${poolC.map(c => courseChip(c, auto.pool, 'pool')).join('')}</div>
      <div class="row-between" style="margin-top:20px"><span class="hint" style="margin:0">「涼」與「學習」是依官方成績配分估算，評價上線後會一併納入。英語（一）實際班級由語文中心依分級配班，這裡的時段僅供預估。</span><button class="btn accent" id="runAuto">幫我排課表</button></div>
    </div>`;
    renderAutoResult();
  }
  function reasonFor(e) {
    const { w } = e.r, s = e.s;
    if (!w.known) return (s.english ? '英語授課 · ' : '') + '大綱未列成績配分';
    const bits = [`考試占 ${Math.round(w.exam)}%`];
    if (w.att) bits.push(`平時／出席 ${Math.round(w.att)}%`);
    if (w.hw) bits.push(`作業報告 ${Math.round(w.hw)}%`);
    if (w.team) bits.push('含小組專題');
    if (s.lab) bits.push('有實習課');
    if (s.english) bits.push('英語授課');
    return bits.join(' · ');
  }
  function renderAutoResult() {
    const box = $('#autoResult');
    if (!autoRes) { box.innerHTML = ''; return; }
    if (autoRes.err) { box.innerHTML = `<div class="card" style="margin-top:16px"><div class="alert bad" style="margin:0">${esc(autoRes.err)}</div></div>`; return; }
    const warns = (autoRes.warn || []).map(w => `<div class="alert bad" style="margin:16px 0 0;background:var(--warn-soft);color:var(--warn)">${esc(w)}</div>`).join('');
    box.innerHTML = warns + autoRes.sols.map((sol, i) => {
      const days = new Set(sol.items.flatMap(e => e.s.slots.map(x => x.d))).size;
      const cool = Math.round(sol.items.reduce((a, e) => a + e.r.coolN, 0) / sol.items.length), learn = Math.round(sol.items.reduce((a, e) => a + e.r.learnN, 0) / sol.items.length);
      const gap = sol.credits - autoRes.target;
      const credNote = gap === 0 ? '剛好達到目標學分' : gap < 0 ? `比目標少 ${-gap} 學分（沒有更多不衝堂的課可補）` : `比目標多 ${gap} 學分（必修已超過目標）`;
      const row = e => `<div class="sel"><div><b>${esc(secName(e.c, e.s))}</b> <small>${esc(e.s.cls)} 班 · ${esc(e.s.teacher)} · ${secCredit(e.c, e.s)} 學分</small><br><small>${esc(timeText(e.s.slots))}</small><br><small style="color:var(--muted)">${esc(reasonFor(e))}</small></div><div class="score"><small>涼 ${Math.round(e.r.coolN)}</small><small>學 ${Math.round(e.r.learnN)}</small></div></div>`;
      const mustItems = sol.items.filter(e => !e.pool), poolItems = sol.items.filter(e => e.pool);
      return `<div class="card result" style="margin-top:16px">
        <div class="row-between"><div><span class="tag ${i ? 'gray' : 'en'}">${i ? '備選 ' + i : '最推薦'}</span> <b style="font-size:18px;margin-left:6px">${sol.credits} 學分 · 每週 ${days} 天</b><div class="meta" style="margin-top:2px">${credNote}</div></div>
          <button class="btn ${i ? '' : 'accent'}" data-apply="${i}">套用到模擬課表</button></div>
        ${sol.dropped.length ? `<div class="alert bad" style="margin:12px 0 0;background:var(--warn-soft);color:var(--warn)">必修全排進去一定會衝堂，這份先排除：${sol.dropped.map(esc).join('、')}。</div>` : ''}
        <div class="meters"><div><small>涼度</small><div class="t"><i style="width:${cool}%"></i></div><b>${cool}</b></div><div><small>學習度</small><div class="t"><i style="width:${learn}%;background:var(--blue)"></i></div><b>${learn}</b></div></div>
        ${mustItems.map(row).join('')}
        ${poolItems.length ? `<div class="meta" style="margin:14px 0 2px;font-weight:700">補滿學分的課</div>${poolItems.map(row).join('')}` : ''}
      </div>`;
    }).join('');
  }
  $('#autoBox').addEventListener('click', e => {
    const m = e.target.closest('[data-mode]'); if (m) { auto.mode = m.dataset.mode; saveAuto(); $$('#autoBox .mode').forEach(b => b.classList.toggle('on', b === m)); return; }
    const g = e.target.closest('#autoGoals .chip'); if (g) { const k = g.dataset.k; goals.has(k) ? goals.delete(k) : goals.add(k); store.set('goals', [...goals]); syncChips(); renderRecs(); return; }
    if (e.target.id === 'runAuto') { only4Eff = only4; autoRes = solve(); if (autoRes.err && only4) { only4Eff = false; autoRes = solve(); } renderAutoResult(); $('#autoResult').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
  $('#autoBox').addEventListener('change', e => {
    const t = e.target;
    if (t.id === 'aGrade') { setGrade(+t.value); saveAuto(); renderAuto(); return; }
    if (t.id === 'aCohort') auto.cohort = t.value;
    if (t.id === 'aEarly') auto.early = t.checked;
    if (t.id === 'aDay') auto.day = +t.value;
    if (t.id === 'aLang') auto.lang = t.value;
    if (t.id === 'aLevel') auto.level = t.value;
    if (t.id === 'aTarget') auto.target = Math.max(0, Math.min(28, +t.value || 0));
    if (t.dataset.course) {
      const list = auto[t.dataset.grp]; const code = t.dataset.course;
      auto[t.dataset.grp] = t.checked ? [...new Set([...list, code])] : list.filter(x => x !== code);
      t.closest('.chip').classList.toggle('on', t.checked);
    }
    saveAuto();
  });
  $('#autoResult').addEventListener('click', e => {
    const b = e.target.closest('[data-apply]'); if (!b || !autoRes || !autoRes.sols) return;
    plan = autoRes.sols[+b.dataset.apply].items.map(x => x.s.id); store.set('plan', plan); updateBadge(); toast('已套用到模擬課表'); show('plan');
  });

  // ---------- 0. 問問顧問（規則式理解，不需要連網；超出範圍會老實說明） ----------
  const KW = {
    code: /程式|python|coding|寫扣|人工智慧|\bai\b|自動化|演算法/i, data: /資料|數據|data|統計|excel|spss|分析師/i,
    fin: /財會|會計|財務|理財|投資|金融|報表/, econ: /經濟|總經|市場分析/, mgmt: /管理|領導|創業|企管|經營/,
    comm: /溝通|表達|簡報|寫作|口條|企劃|行銷/, team: /團隊|分組|小組|合作/, math: /數學|微積分|數理|量化/,
    eng: /英文|英語|多益|toeic|口說|外商|時事/i, ethics: /永續|esg|倫理|社會企業|公益/i
  };
  const EXAMPLES = ['我想學程式和時事英文，不要早八', '想要最涼的課表，週五不想上課', '我不知道怎麼排才能快點畢業，有點焦慮', '我是財金系，想走資料分析，排 20 學分', '我大三，想走財務金融，不要週五'];
  const CH = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5 };
  let lastAsk = '';
  function parseAsk(t) {
    const tk = t.replace(/(行銷|人資|財金|會計|國企|國際企業|英專)(?:系|一|班|組|學程)/g, '');
    const p = { sk: Object.keys(KW).filter(k => KW[k].test(tk)) };
    const cool = /涼|輕鬆|好過|不想太累|不要太累|省力/.test(t), learn = /學多|學到|紮實|充實|成長/.test(t), tight = /集中|少.{0,2}天|空堂|通勤/.test(t);
    p.mode = tight ? 'tight' : cool && learn ? 'balance' : cool ? (p.sk.length && !/最涼/.test(t) ? 'balance' : 'cool') : learn ? 'learn' : (p.sk.length ? 'learn' : 'balance');
    p.early = /早八|早課|早起|不要.{0,3}早上/.test(t);
    const d = t.match(/(?:不想上?|不要上?|避開|不能上|沒辦法上)\s*(?:週|星期|禮拜)([一二三四五])/) || t.match(/(?:週|星期|禮拜)([一二三四五])\s*(?:要打工|要實習|不上|沒空|不能上|不要上|不想上)/);
    p.day = d ? CH[d[1]] : 0;
    p.lang = /不(?:要|想).{0,4}(?:英語授課|全英)/.test(t) ? 'zh' : /英語授課|全英/.test(t) ? 'en' : 'any';
    const cr = t.match(/(\d{1,2})\s*學分/); p.target = cr && +cr[1] >= 1 && +cr[1] <= 28 ? +cr[1] : 0;
    const co = t.match(/(行銷|人資|財金|會計|國企|國際企業|英專)(?:系|一|班|組|學程)/);
    p.cohort = co ? ({ 行銷: '行銷與人資', 人資: '行銷與人資', 財金: '財金', 會計: '會計', 國企: '國企管', 國際企業: '國企管', 英專: '英專' })[co[1]] : null;
    const gm = t.match(/大([一二三四])|([一二三四])年級/); p.grade = gm ? '一二三四'.indexOf(gm[1] || gm[2]) + 1 : 0;
    p.graduate = /畢業|修完|提早|四年|抵免|學分夠不夠/.test(t);
    p.anxious = /焦慮|不知道|迷惘|迷茫|不安|壓力|害怕|擔心|慌|沒方向|徬徨|很煩/.test(t);
    p.asked = !!(/排|課表/.test(t) || p.grade || p.sk.length || cool || learn || tight || p.early || p.day || p.target || p.lang !== 'any');
    return p;
  }
  let relaxed = [], relaxed4 = false;
  function runAuto(sk, mode, o = {}) {
    goals = new Set(sk); store.set('goals', [...goals]); relaxed = [];
    if (o.grade && o.grade !== auto.grade) setGrade(o.grade);
    auto.mode = mode; auto.lang = o.lang || 'any';
    auto.target = o.target || 18;
    if (o.cohort) auto.cohort = o.cohort;
    // 限制太緊排不出來時，依序放寬星期、早課，並告訴使用者
    const tries = [[!!o.early, o.day || 0, []], [!!o.early, 0, o.day ? ['週' + DAY[o.day]] : []], [false, o.day || 0, o.early ? ['早課'] : []], [false, 0, [o.day ? '週' + DAY[o.day] : '', o.early ? '早課' : ''].filter(Boolean)]];
    relaxed4 = false; let found = false;
    for (const strict of (only4 ? [true, false] : [false])) {
      for (const [early, day, rel] of tries) {
        if (rel.length === 0 && tries.indexOf(tries.find(t => t[2] === rel)) > 0) continue;
        only4Eff = strict; auto.early = early; auto.day = day; autoRes = solve();
        if (!autoRes.err) { relaxed = rel; found = true; break; }
      }
      if (found) { relaxed4 = only4 && !strict; break; }
    }
    saveAuto(); syncChips(); renderRecs();
  }
  const miniRow = e => `<div class="sel"><div><b>${esc(secName(e.c, e.s))}</b> <small>${esc(e.s.cls)} 班 · ${esc(e.s.teacher)} · ${secCredit(e.c, e.s)} 學分</small><br><small>${esc(timeText(e.s.slots))}</small></div></div>`;
  function reqCard() {
    const ri = reqInfo(); if (!ri) return me && me.grade > 1 ? '<div class="card reply"><p>你還沒選學程。到右上角「我的設定」選好學程，我就能依你的必修科目表幫你算還缺什麼。</p></div>' : '';
    const done = ri.done; const rp = reqPlan(me.grade); const left = [...ri.single].filter(c => !done.has(c)).map(c => { const k = ri.dept.find(d => d.code === c) || ri.conc.courses.find(d => d.code === c) || { name: c }; return { name: k.name, on: !!(rp && rp.req.has(c)) }; });
    const groupsLeft = ri.groups.filter(g => !g.some(c => done.has(c))).map(g => g.map(c => (ri.conc.courses.find(d => d.code === c) || { name: c }).name).join('或'));
    const cc = ri.conc.courses.filter(k => done.has(k.code)).length;
    return `<div class="card reply"><h3>你的畢業進度：${esc(ri.conc.name)}</h3>
      <p class="meta">依 ${ri.entry} 學年度入學的必修科目表；${me.done && me.done.length ? '已扣掉你勾選修過的 ' + me.done.length + ' 門。' : '你還沒勾選修過的課，下面是尚未扣除的清單。'}</p>
      <p style="margin-top:8px">學程要選 <b>${ri.conc.pick || '?'}</b> 門（共 ${ri.conc.total} 門），已修 ${cc} 門。</p>
      <p style="margin-top:6px"><b>這學期可以修的必修</b>：${left.filter(x => x.on).map(x => esc(x.name)).join('、') || '沒有'}</p>
      <p class="meta" style="margin-top:4px">另有 ${left.filter(x => !x.on).length} 門必修這學期沒開，或不是你這個年級要修的；修過的請按下面的按鈕勾起來。</p>
      ${groupsLeft.length ? `<p style="margin-top:6px"><b>二選一</b>：${groupsLeft.map(esc).join('；')}</p>` : ''}
      ${ri.kind === 'CMBP' && (REQS[ri.entry].CMBP.second) ? `<p class="meta" style="margin-top:8px">英專班另有「第二外語」要修滿 8 學分，畢業前需修畢一種第二外語。</p>` : ''}
      <div class="row2"><button class="btn" id="openRec">勾選我修過的課</button></div></div>`;
  }
  function gradCard() {
    return reqCard() + `<div class="card reply"><h3>想快點畢業，先搞清楚學分怎麼組成</h3>
      <div class="kv"><b>畢業總學分</b><span>128 學分</span><b>共同必修＋通識</b><span>27 學分（通識最多只採計 10 學分，超修不算畢業學分）</span><b>院共同必修</b><span>42 學分</span><b>主修學程</b><span>24–30 學分；另有輔修學程 9–12 學分</span><b>體育</b><span>4 學期（0 學分，但必須修滿）</span><b>數位應用課程</b><span>至少通過 2 門</span><b>職涯素養</b><span>畢業前須修畢（職涯護照）</span></div>
      <p class="hint">以上整理自 113 學年度管院學士班必修科目表，你的入學學年可能不同，請對照自己的畢業審查表。</p>
      <h4>用算術看每學期要修多少</h4>
      <p>128 學分平均分到 8 學期是每學期 16 學分；想 7 學期畢業，每學期要約 18.3 學分。能不能提早畢業、學分上限是多少，請向系辦或導師確認，我無法替學校做決定。</p>
      <p class="meta">我手上只有 115-1 的課程，沒有你的修課紀錄，所以只能排「這學期」，不能排完整四年。</p>
      <div class="row2"><button class="btn accent" data-grad="16">幫我排 16 學分的這學期</button><button class="btn" data-grad="18">排 18 學分</button></div></div>`;
  }
  function renderAskReply(t) {
    lastAsk = t; const p = parseAsk(t); const box = $('#askReply'); let html = '';
    const heard = [...(p.grade ? [GN[p.grade]] : []), ...p.sk.map(k => SK[k]), ...(p.early ? ['避開早課'] : []), ...(p.day ? ['避開週' + DAY[p.day]] : []), ...(p.target ? [p.target + ' 學分'] : []), ...(p.lang === 'en' ? ['英語授課'] : p.lang === 'zh' ? ['中文授課'] : [])];
    if (p.anxious) {
      html += `<div class="card reply"><h3>先放輕鬆，一次只決定一件事</h3>
        <p>還沒想清楚未來要做什麼、不知道怎麼安排大學生活，是很多同學都會遇到的狀況。這些問題不用一次解決，可以拆成三小步：</p>
        <ol><li><b>先決定這學期的負擔</b>：想排得輕鬆、均衡，還是學多一點？想修幾學分？</li><li><b>再挑一兩個有興趣的能力</b>：不用先確定職業，到「職涯方向」頁看看各方向需要什麼。</li><li><b>看排出來的課表</b>：不滿意可以點格子換課，下學期還能再調整。</li></ol>
        <p class="meta">如果焦慮已經影響到睡眠或日常生活，建議找學校的諮商中心聊聊，他們有專業的協助；我只是排課的工具，沒辦法取代。</p>
        <div class="row2"><button class="btn" data-go="career">看職涯方向</button>${p.asked ? '' : '<button class="btn accent" data-quick="1">先幫我排一份均衡的課表</button>'}</div></div>`;
    }
    if (p.graduate) html += gradCard();
    if (p.asked) {
      runAuto(p.sk, p.mode, p);
      if (/時事/.test(t)) html += `<div class="card reply"><div class="alert bad" style="margin:0;background:var(--warn-soft);color:var(--warn)">目前資料裡沒有名為「時事英文」的課。最接近的是英語（一）與課室英文（CM121）；語言中心另有主題式英語課，我還沒納入。</div></div>`;
      const sols = autoRes && autoRes.sols;
      html += `<div class="card reply"><h3>我幫你排的課表</h3>
        <label class="check" style="margin-bottom:8px"><input type="checkbox" id="only4Ck" ${only4 ? 'checked' : ''}> 只排推薦 4 星以上的課（估算）</label>
        ${relaxed4 ? '<div class="alert bad" style="margin:0 0 8px;background:var(--warn-soft);color:var(--warn)">推薦 4 星以上的課排不出不衝堂的課表，已放寬星等限制。</div>' : ''}
        <div class="chips" style="margin:6px 0 10px">${heard.length ? heard.map(h => `<span class="tag">${esc(h)}</span>`).join('') : '<span class="tag gray">沒有特別限制，用均衡風格</span>'}<span class="tag en">${MODES[auto.mode][0]}</span></div>
        <label class="field" style="margin-bottom:10px;${auto.grade === 1 && !majorOf() ? '' : 'display:none'}">我的配班<select id="askCohort">${COHORTS.map(([v, tx]) => `<option value="${v}" ${auto.cohort === v ? 'selected' : ''}>${tx}</option>`).join('')}</select></label>
        ${auto.grade === 1 && !auto.cohort ? '<p class="meta">還沒選配班，體育、英語、中文閱讀可能排到不是你的班，請先選配班。</p>' : ''}
        ${relaxed.length ? `<div class="alert bad" style="margin:8px 0;background:var(--warn-soft);color:var(--warn)">照你的限制，必修課排不出不衝堂的課表，所以先放寬「${relaxed.join('、')}」。</div>` : ''}${((autoRes && autoRes.warn) || []).map(w => `<div class="alert bad" style="margin:8px 0;background:var(--warn-soft);color:var(--warn)">${esc(w)}</div>`).join('')}
        ${autoRes.err ? `<div class="alert bad">${esc(autoRes.err)}</div>` : sols ? `<div class="meta" style="margin-bottom:6px">${sols[0].credits} 學分 · 每週 ${new Set(sols[0].items.flatMap(e => e.s.slots.map(x => x.d))).size} 天${sols[0].credits > autoRes.target && autoRes.target ? '（比目標多 ' + (sols[0].credits - autoRes.target) + ' 學分，必修已超過目標）' : ''}${sols[0].dropped.length ? ' · 必修會衝堂，先排除：' + sols[0].dropped.map(esc).join('、') : ''}</div>${sols[0].items.map(miniRow).join('')}
        <div class="row2"><button class="btn accent" data-askapply="1">套用到模擬課表</button><button class="btn" data-go="auto">到自動選課微調</button></div>
        <p class="meta" style="margin-top:10px">涼度與學習度是依官方成績配分估算，社群評價只當參考。</p>` : ''}</div>`;
    }
    if (!p.anxious && !p.graduate && !p.asked) html = `<div class="card reply"><h3>這句我還看不太懂</h3><p>我目前能處理這幾類問題：</p><ol><li>想學什麼能力（程式、資料分析、財會、英文、溝通…）</li><li>上課偏好（避開早八、避開某一天、要幾學分、涼一點或學多一點）</li><li>畢業學分怎麼算</li><li>不知道方向時，先看「職涯方向」</li></ol><p class="meta">試試點上面的範例，或換個說法。</p></div>`;
    box.innerHTML = html;
  }
  $('#askEx').innerHTML = EXAMPLES.map((x, i) => `<button class="chip" data-ex="${i}">${esc(x)}</button>`).join('');
  $('#tab-ask').addEventListener('click', e => {
    const ex = e.target.closest('[data-ex]'); if (ex) { $('#askText').value = EXAMPLES[+ex.dataset.ex]; renderAskReply($('#askText').value); return; }
    if (e.target.id === 'askGo') { const t = $('#askText').value.trim(); if (t) renderAskReply(t); else toast('先打一句話告訴我你的狀況'); return; }
    if (e.target.id === 'openRec') { renderRec(); $('#rec').hidden = false; return; }
    if (e.target.dataset.quick) { renderAskReply('幫我排一份均衡的課表'); return; }
    const g = e.target.closest('[data-grad]'); if (g) { runAuto([], 'balance', { target: +g.dataset.grad }); show('auto'); return; }
    const go = e.target.closest('[data-go]'); if (go) { show(go.dataset.go); return; }
    if (e.target.dataset.askapply && autoRes && autoRes.sols) { plan = autoRes.sols[0].items.map(x => x.s.id); store.set('plan', plan); updateBadge(); toast('已套用到模擬課表'); show('plan'); }
  });
  $('#tab-ask').addEventListener('change', e => { if (e.target.id === 'only4Ck') { only4 = e.target.checked; store.set('only4', only4); renderAskReply(lastAsk); return; } if (e.target.id === 'askCohort') { auto.cohort = e.target.value; saveAuto(); renderAskReply(lastAsk); } });
  $('#askText').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) $('#askGo').click(); });

  // ---------- 0.5 職涯方向 ----------
  const DIRS = [
    { n: '資料分析／數位轉型', sk: ['data', 'code', 'math'], tip: '先把 Excel 與基礎統計練熟，再學 SQL 與 Python，用一份真實資料做一個小專題放進履歷。' },
    { n: '會計／審計／財務', sk: ['fin', 'math'], tip: '盡早確認要不要走會計相關學程，並留意各學期修課的先後順序。' },
    { n: '財金／量化投資', sk: ['fin', 'econ', 'math', 'code'], tip: '微積分與統計是基礎，可以搭配程式練習簡單的資料分析。' },
    { n: '人資與組織管理', sk: ['mgmt', 'comm', 'team'], tip: '多參與小組專題或社團幹部，累積帶人與溝通的實際經驗。' },
    { n: '行銷企劃', sk: ['comm', 'data', 'mgmt'], tip: '練習用數據說明想法，並把企劃與報告整理成作品集。' },
    { n: 'ESG／永續與社會企業', sk: ['ethics', 'comm', 'team'], tip: '從有田野調查與小組實作的課開始，累積可展示的專案經驗。' },
    { n: '國際企業／外商', sk: ['eng', 'comm', 'mgmt'], tip: '英語口說需要持續練習，並留意英語授課課程與交換機會。' },
    { n: '創業', sk: ['mgmt', 'fin', 'comm', 'team'], tip: '財務基礎、溝通與團隊合作缺一不可，可從小型專案或比賽累積經驗。' },
    { n: '研究所升學', sk: ['math', 'econ', 'data', 'eng'], tip: '提早確認目標系所的先備課程與語言門檻。' }
  ];
  const bestOf = k => Math.max(0, ...C.map(c => c.skills[k] || 0));
  function renderCareer() {
    $('#careerList').innerHTML = DIRS.map((d, i) => {
      const rel = C.map(c => ({ c, v: d.sk.reduce((a, k) => a + (c.skills[k] || 0), 0) })).filter(x => x.v > 0).sort((a, b) => b.v - a.v).slice(0, 4);
      return `<div class="card dir"><h4>${esc(d.n)}</h4>
        <div class="meta" style="margin-top:8px">需要的能力</div>
        <div class="tags">${d.sk.map(k => { const b = bestOf(k); return `<span class="tag ${b >= 2 ? 'en' : b === 1 ? 'gray' : 'miss'}">${esc(SK[k])}${b >= 2 ? ' · 本學期有課' : b === 1 ? ' · 只有輕度涵蓋' : ' · 本學期沒有課'}</span>`; }).join('')}</div>
        <div class="meta" style="margin-top:12px">這學期可以修</div>
        <p>${rel.length ? rel.map(x => esc(x.c.name) + '（' + esc(gradeTxt(x.c)) + '）').join('、') : '目前沒有直接對應的課'}</p>
        <div class="meta" style="margin-top:8px">可以先做的事</div><p>${esc(d.tip)}</p>
        <div class="row2"><button class="btn accent" data-dir="${i}">用這個方向排課表</button></div></div>`;
    }).join('') + '<p class="hint">方向與課程的對應是 AI 依課程大綱彙整，不是官方分類。「本學期沒有課」代表管院學士班 115-1 沒有開，高年級或其他系所可能有。</p>';
  }
  $('#careerList').addEventListener('click', e => {
    const b = e.target.closest('[data-dir]'); if (!b) return;
    runAuto(DIRS[+b.dataset.dir].sk, 'balance'); show('auto');
  });


  // ---------- 推薦星等（估算）：把所有班別的涼度與學習度平均後，依名次分成 1–5 星 ----------
  let STAR = null;
  function starMap() {
    if (STAR) return STAR;
    const g = goals; goals = new Set(); const S = buildScores(); goals = g;
    const rows = Object.values(S).map(r => ({ id: r.s.id, v: (r.coolN + r.learnN) / 2 })).sort((x, y) => x.v - y.v), n = rows.length;
    STAR = {}; rows.forEach((r, i) => { const p = n > 1 ? i / (n - 1) : 1; STAR[r.id] = p >= 0.8 ? 5 : p >= 0.55 ? 4 : p >= 0.3 ? 3 : p >= 0.1 ? 2 : 1; });
    return STAR;
  }

  // ---------- 個人設定：綽號、年級、主修（第一次進來填一次） ----------
  const MAJORS = [['數位行銷與人力資源', '行銷與人資', /行銷|人力|人資|消費|品牌|組織|領導/], ['財務金融', '財金', /財務|金融|投資|證券|衍生|保險|財經|不動產/], ['國際企業管理', '國企管', /國際|全球|跨文化|貿易|策略/], ['會計', '會計', /會計|審計|稅|成本|財報/], ['英專班（英語專班）', '英專', /^$/]];
  const majorOf = () => (me && MAJORS.find(m => m[0] === me.major)) || null;
  $('#onMajor').innerHTML = '<option value="">還沒決定</option>' + MAJORS.map(m => `<option>${esc(m[0])}</option>`).join('');
  function applyMe() {
    REQC = null; STAR = null;
    if (!me) return;
    if (me.grade !== auto.grade) setGrade(me.grade);
    const mj = majorOf(); auto.cohort = me.grade === 1 && mj ? mj[1] : (me.grade === 1 ? auto.cohort : '');
    saveAuto(); STAR = null; REQC = null; if (me.grade > 1) { auto.must = defaultMust(me.grade); auto.pool = defaultPool(me.grade); saveAuto(); }
    $('#hello').textContent = me.nick ? `嗨，${me.nick}` : '';
    const mb = $('#meBtn'); mb.hidden = false; mb.textContent = [me.nick || '我的設定', GN[me.grade], me.grade > 1 ? ((me.program || '').split('|')[1] || '') : (me.major ? me.major.replace(/（.*）/, '') : '')].filter(Boolean).join(' · '); $('#recBtn').hidden = !reqInfo();
  }
  function fillProg() {
    const g = +$('#onGrade').value, R = REQS[ENTRY[g]];
    $('#onMajWrap').hidden = g > 1; $('#onProgWrap').hidden = g === 1;
    if (g > 1 && R) {
      $('#onEntry').textContent = '入學學年 ' + ENTRY[g] + ' 的必修科目表';
      $('#onProg').innerHTML = '<option value="">還沒決定</option>' + R.CM.conc.map(c => `<option value="CM|${esc(c.name)}">${esc(c.name)}</option>`).join('') + R.CMBP.conc.map(c => `<option value="CMBP|${esc(c.name)}">英專班・${esc(c.name)}</option>`).join('');
      if (me && me.grade === g && me.program) $('#onProg').value = me.program;
    }
  }
  $('#onGrade').addEventListener('change', fillProg);
  function openOnb() { $('#onNick').value = (me && me.nick) || ''; $('#onGrade').value = String((me && me.grade) || 1); $('#onMajor').value = (me && me.major) || ''; fillProg(); $('#onb').hidden = false; }
  $('#onSave').addEventListener('click', () => { { const g = +$('#onGrade').value; const same = me && me.grade === g; me = { nick: $('#onNick').value.trim(), grade: g, major: g === 1 ? $('#onMajor').value : '', program: g > 1 ? $('#onProg').value : '', done: same ? (me.done || []) : [] }; } store.set('me', me); $('#onb').hidden = true; applyMe(); renderRecs(); if (!$('#tab-ask').hidden) $('#askReply').innerHTML = ''; toast('設定好了'); });
  $('#onSkip').addEventListener('click', () => { me = me || { nick: '', grade: 1, major: '', skipped: true }; store.set('me', me); $('#onb').hidden = true; applyMe(); });
  $('#meBtn').addEventListener('click', openOnb);
  function renderRec() {
    const ri = reqInfo(); if (!ri) { $('#recBody').innerHTML = '<p class="hint">先在「我的設定」選好年級與學程。</p>'; return; }
    const done = new Set(me.done || []); const reqCodes = new Set(ri.conc.required.flat());
    const row = (k, star) => `<label class="rk"><input type="checkbox" data-done="${k.code}" ${done.has(k.code) ? 'checked' : ''}><span>${esc(k.name)}${star ? ' <b class="tag need">必修</b>' : ''}<small>${k.code} · ${k.credit} 學分${cat(k.code) ? ' · 本學期有開' : ''}</small></span></label>`;
    const dc = ri.dept.filter(k => done.has(k.code)).length, cc = ri.conc.courses.filter(k => done.has(k.code)).length;
    $('#recBody').innerHTML = `<p class="hint" style="margin-top:6px">勾選你已經修過的課，排課時會自動跳過，並優先排還沒修的必修。資料來自教務處 ${ri.entry} 學年度入學的必修科目表。</p>
      <h3>管院共同必修　<small>已修 ${dc} / ${ri.dept.length} 門</small></h3>${ri.dept.map(k => row(k, false)).join('')}
      <h3>${esc(ri.conc.name)}　<small>要選 ${ri.conc.pick || '?'} 門（共 ${ri.conc.total} 門）· 已修 ${cc} 門</small></h3>${ri.conc.courses.map(k => row(k, reqCodes.has(k.code))).join('')}`;
  }
  // ---------- 匯入「畢業審查」檔（只在瀏覽器內讀取，不上傳） ----------
  // GitHub Pages 版自己託管 pdf.js（不信任外部 CDN）；Artifact 預覽版沒有 vendor 檔，改用 cdnjs
  const PDF_BASE = /github\.io$/.test(location.hostname) || location.hostname === 'localhost' ? 'vendor/' : 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
  const loadScript = src => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('載入失敗：' + src)); document.head.appendChild(s); });
  async function fileToLines(f) {
    const name = f.name.toLowerCase();
    if (/\.pdf$/.test(name)) {
      await loadScript(PDF_BASE + 'pdf.min.js');
      pdfjsLib.GlobalWorkerOptions.workerSrc = PDF_BASE + 'pdf.worker.min.js';
      const doc = await pdfjsLib.getDocument({ data: await f.arrayBuffer(), isEvalSupported: false }).promise; const lines = [];
      for (let p = 1; p <= doc.numPages; p++) {
        const tc = await (await doc.getPage(p)).getTextContent(); const rows = {};
        tc.items.forEach(it => { const y = Math.round(it.transform[5] / 3); (rows[y] = rows[y] || []).push(it); });
        Object.keys(rows).map(Number).sort((x, y) => y - x).forEach(y => lines.push(rows[y].sort((x, z) => x.transform[4] - z.transform[4]).map(i => i.str).join(' ')));
      }
      return lines;
    }
    if (/\.(xlsx|xls)$/.test(name)) throw new Error('目前不支援 Excel，請改用 PDF 或另存成 CSV');
    const buf = await f.arrayBuffer(); let t = new TextDecoder('utf-8').decode(buf);
    if (t.includes('\uFFFD')) { try { t = new TextDecoder('big5').decode(buf); } catch { } }
    if (/\.html?$/.test(name)) t = (new DOMParser().parseFromString(t, 'text/html').body.textContent || '').replace(/[ \t]+/g, ' ');
    return t.split(/\r?\n/);
  }
  function auditParse(lines) {
    const known = new Map();
    C.forEach(c => known.set(c.code, c.name));
    Object.values(REQS).forEach(y => ['CM', 'CMBP'].forEach(k => { y[k].dept.forEach(d => known.set(d.code, d.name)); y[k].conc.forEach(c => c.courses.forEach(d => known.set(d.code, d.name))); (y[k].elective || []).forEach(d => known.set(d.code, d.name)); }));
    const found = new Map();
    lines.forEach(ln => {
      (ln.match(/[A-Z]{2,3}\d{3}/g) || []).forEach(code => {
        if (!known.has(code)) return;
        const rest = ln.split(code).join(' ');
        let st = 'unknown';
        if (/未通過|未過|未送成績|\(\d\)\d學分\/|不及格|未修|尚缺|缺修|修課中|修習中|在修|退選|待修/.test(rest)) st = 'no';
        else if (/通過|及格|抵免|免修|已修|\bPass\b|(?:^|\D)(?:100|[6-9]\d)(?:\D|$)|(?:^|[\s,|;])[A-C][+-]?(?:[\s,|;]|$)/.test(rest)) st = 'yes';
        const prev = found.get(code);
        const rank = { yes: 2, unknown: 1, no: 0 };
        if (!prev || rank[st] > rank[prev.st]) found.set(code, { code, name: known.get(code), st, ln: ln.trim().slice(0, 80) });
      });
    });
    return [...found.values()];
  }
  let imp = [], impMeta = {};
  // 從報表抓入學學年與主修（修業年度；抓不到就用最早的學期代碼）
  function auditMeta(lines) {
    const txt = lines.join('\n'); const m = {};
    const mj = txt.match(/主修[：:]\s*([^）)\s]+)/); if (mj) m.major = mj[1];
    let y = (txt.match(/修業年度[:：\s]*(\d{3})/) || [])[1];
    if (!y) { const ys = (txt.match(/(?:^|\D)(11\d)[125](?:\D|$)/g) || []).map(s => +s.replace(/\D/g, '').slice(0, 3)); if (ys.length) y = Math.min(...ys); }
    y = +y; if (ENTRY[116 - y] === y) { m.entry = y; m.grade = 116 - y; }
    return m;
  }
  function renderImport() {
    const box = $('#recImport'); if (!imp.length) { box.innerHTML = ''; return; }
    const lab = { yes: '看起來已通過', unknown: '無法判斷', no: '看起來未通過／未修' };
    box.innerHTML = `<div class="imp"><b>讀到 ${imp.length} 門課</b><p class="hint">請確認勾選的是你已經修過並通過的課，再按「套用」。我是依每一列的文字（成績、通過、未通過…）猜的，不確定的預設不勾。</p>
      ${impMeta.grade ? `<label class="rk"><input type="checkbox" id="impProfile" ${me && me.grade === impMeta.grade ? '' : 'checked'}><span>同時更新我的設定：入學 ${impMeta.entry} 學年（${GN[impMeta.grade]}）${impMeta.major ? '、報表主修「' + esc(impMeta.major) + '」' : ''}<small>學程請之後在「我的設定」自己選</small></span></label>` : ''}
      ${imp.map((x, i) => `<label class="rk"><input type="checkbox" data-imp="${i}" ${x.st === 'yes' ? 'checked' : ''}><span>${esc(x.name)}<small>${x.code} · ${lab[x.st]} · ${esc(x.ln)}</small></span></label>`).join('')}
      <div class="row2"><button class="btn accent" id="impApply">套用到修課紀錄</button></div></div>`;
  }
  $('#recFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return; $('#recImport').innerHTML = '<p class="hint">讀取中…</p>';
    try {
      const lines = await fileToLines(f); imp = auditParse(lines); impMeta = auditMeta(lines);
      if (imp.length < 3) { $('#recImport').innerHTML = '<div class="imp"><p>這份檔案裡我只認得 ' + imp.length + ' 門課，格式可能和我預期的不一樣。你可以把檔案傳給我，我再調整讀取方式；目前請先手動勾選。</p></div>'; imp = []; return; }
      renderImport();
    } catch (err) { $('#recImport').innerHTML = '<div class="imp"><p>讀取失敗：' + esc(err.message) + '。請改用 Excel 或 CSV 試試，或手動勾選。</p></div>'; }
    e.target.value = '';
  });
  $('#recImport').addEventListener('click', e => {
    if (e.target.id !== 'impApply') return;
    const s = new Set(me.done || []); $$('#recImport [data-imp]').forEach(c => { const x = imp[+c.dataset.imp]; c.checked ? s.add(x.code) : s.delete(x.code); });
    me.done = [...s]; const up = $('#impProfile'); if (up && up.checked && impMeta.grade && me.grade !== impMeta.grade) { me.grade = impMeta.grade; me.program = ''; me.major = ''; }
    store.set('me', me); REQC = null; imp = []; $('#recImport').innerHTML = ''; renderRec(); toast('已套用修課紀錄');
  });
  $('#recBtn').addEventListener('click', () => { renderRec(); $('#rec').hidden = false; });
  $('#recClose').addEventListener('click', () => { $('#rec').hidden = true; applyMe(); });
  $('#recBody').addEventListener('change', e => { const c = e.target.dataset.done; if (!c) return; const s = new Set(me.done || []); e.target.checked ? s.add(c) : s.delete(c); me.done = [...s]; store.set('me', me); REQC = null; renderRec(); });
  applyMe(); if (!me) openOnb();
  updateBadge(); renderRecs();
  window.__yzu = { show, addToPlan, renderPlan };
})();    if (/.(xlsx|xls)$/.test(name)) throw new Error('目前不支援 Excel，請改用 PDF 或另存成 CSV');
