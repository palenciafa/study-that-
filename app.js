// ─── Storage ───────────────────────────────────────────
const STORAGE_KEY = 'studytracker_sessions_v2';

function getSessions() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function saveSessions(sessions) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

// ─── Helpers ───────────────────────────────────────────
const CAT_COLORS = {
  study: '#378ADD', review: '#1D9E75', practice: '#D4537E',
  reading: '#EF9F27', lecture: '#7F77DD', project: '#D85A30'
};
const CAT_EMOJI = {
  study: '📚', review: '🔁', practice: '✏️',
  reading: '📖', lecture: '🎓', project: '💻'
};
const DAYS_SHORT = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function fmtDur(mins) {
  if (!mins) return '0m';
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function getWeekDates() {
  const now = new Date();
  const dow = now.getDay();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now);
    d.setDate(now.getDate() - dow + i);
    return d.toISOString().slice(0, 10);
  });
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 2200);
}

// ─── Sidebar Today Widget ───────────────────────────────
function updateSidebarToday() {
  const sessions = getSessions();
  const today = todayStr();
  const todayMins = sessions.filter(s => s.date === today).reduce((a, s) => a + s.dur, 0);
  const goalMins = 4 * 60; // 4h daily goal
  document.getElementById('sidebar-today').textContent = fmtDur(todayMins);
  const pct = Math.min(100, Math.round((todayMins / goalMins) * 100));
  document.getElementById('sidebar-bar').style.width = pct + '%';
}

// ─── Tab Routing ───────────────────────────────────────
let currentTab = 'log';
function switchTab(tab) {
  document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelector(`[data-tab="${tab}"]`).classList.add('active');
  currentTab = tab;
  if (tab === 'log') renderLogStats();
  if (tab === 'sessions') renderSessions();
  if (tab === 'weekly') renderWeekly();
  if (tab === 'monthly') renderMonthly();
  // close sidebar on mobile
  document.getElementById('sidebar').classList.remove('open');
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ─── Hamburger ───────────────────────────────────────
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('sidebar').classList.toggle('open');
});

// ─── Duration Preview ─────────────────────────────────
function updateDurPreview() {
  const s = document.getElementById('log-start').value;
  const e = document.getElementById('log-end').value;
  const el = document.getElementById('dur-preview');
  if (s && e) {
    const dur = timeToMins(e) - timeToMins(s);
    if (dur > 0) {
      el.textContent = `⏱ Duration: ${fmtDur(dur)}`;
      el.classList.add('has-dur');
    } else {
      el.textContent = 'End time must be after start time';
      el.classList.remove('has-dur');
    }
  } else {
    el.textContent = 'Enter times to see duration';
    el.classList.remove('has-dur');
  }
}
document.getElementById('log-start').addEventListener('change', updateDurPreview);
document.getElementById('log-end').addEventListener('change', updateDurPreview);

// ─── Log Session ─────────────────────────────────────
document.getElementById('btn-log').addEventListener('click', () => {
  const date = document.getElementById('log-date').value;
  const subject = document.getElementById('log-subject').value.trim();
  const start = document.getElementById('log-start').value;
  const end = document.getElementById('log-end').value;
  const cat = document.getElementById('log-cat').value;
  const notes = document.getElementById('log-notes').value.trim();

  if (!date) { toast('⚠ Please select a date.'); return; }
  if (!subject) { toast('⚠ Please enter a subject.'); return; }
  if (!start || !end) { toast('⚠ Please enter start and end times.'); return; }
  const dur = timeToMins(end) - timeToMins(start);
  if (dur <= 0) { toast('⚠ End time must be after start time.'); return; }

  const sessions = getSessions();
  sessions.unshift({ id: Date.now(), date, subject, start, end, dur, cat, notes });
  saveSessions(sessions);

  document.getElementById('log-subject').value = '';
  document.getElementById('log-start').value = '';
  document.getElementById('log-end').value = '';
  document.getElementById('log-notes').value = '';
  document.getElementById('dur-preview').textContent = 'Enter times to see duration';
  document.getElementById('dur-preview').classList.remove('has-dur');

  updateSidebarToday();
  renderLogStats();
  toast('✓ Session logged!');
});

// ─── Log Tab Quick Stats ──────────────────────────────
function renderLogStats() {
  const sessions = getSessions();
  const today = todayStr();
  const todayMins = sessions.filter(s => s.date === today).reduce((a, s) => a + s.dur, 0);
  const week = getWeekDates();
  const weekMins = sessions.filter(s => week.includes(s.date)).reduce((a, s) => a + s.dur, 0);
  const total = sessions.reduce((a, s) => a + s.dur, 0);
  const container = document.getElementById('log-quick-stats');
  container.innerHTML = `
    <div class="q-stat"><div class="q-stat-val">${fmtDur(todayMins)}</div><div class="q-stat-lbl">Today</div></div>
    <div class="q-stat"><div class="q-stat-val">${fmtDur(weekMins)}</div><div class="q-stat-lbl">This Week</div></div>
    <div class="q-stat"><div class="q-stat-val">${sessions.length}</div><div class="q-stat-lbl">Total Sessions</div></div>
    <div class="q-stat"><div class="q-stat-val">${fmtDur(total)}</div><div class="q-stat-lbl">Total Time</div></div>
  `;
}

// ─── Sessions Tab ────────────────────────────────────
function renderSessions() {
  const all = getSessions();
  const catFilter = document.getElementById('filter-cat').value;
  const searchFilter = document.getElementById('filter-search').value.toLowerCase();

  const filtered = all.filter(s => {
    if (catFilter && s.cat !== catFilter) return false;
    if (searchFilter && !s.subject.toLowerCase().includes(searchFilter)) return false;
    return true;
  });

  const total = all.reduce((a, s) => a + s.dur, 0);
  const subjects = new Set(all.map(s => s.subject)).size;
  const today = todayStr();
  const todayMins = all.filter(s => s.date === today).reduce((a, s) => a + s.dur, 0);

  document.getElementById('sessions-stats').innerHTML = `
    <div class="stat-card"><div class="stat-val accent">${fmtDur(total)}</div><div class="stat-lbl">Total Studied</div></div>
    <div class="stat-card"><div class="stat-val">${all.length}</div><div class="stat-lbl">Sessions</div></div>
    <div class="stat-card"><div class="stat-val">${subjects}</div><div class="stat-lbl">Subjects</div></div>
    <div class="stat-card"><div class="stat-val">${fmtDur(todayMins)}</div><div class="stat-lbl">Today</div></div>
  `;

  const list = document.getElementById('session-list');
  if (!filtered.length) {
    list.innerHTML = '<div class="empty-state">No sessions found. Start logging!</div>';
    return;
  }
  list.innerHTML = filtered.map(s => `
    <div class="session-item">
      <div class="s-dot" style="background:${CAT_COLORS[s.cat]}"></div>
      <div class="s-body">
        <div class="s-subject">${CAT_EMOJI[s.cat]} ${s.subject}</div>
        <div class="s-meta">${s.date} &nbsp;·&nbsp; ${s.start}–${s.end} &nbsp;·&nbsp; ${s.cat}</div>
        ${s.notes ? `<div class="s-notes">${s.notes}</div>` : ''}
      </div>
      <div class="s-dur">${fmtDur(s.dur)}</div>
      <button class="s-del" onclick="deleteSession(${s.id})" title="Delete">✕</button>
    </div>
  `).join('');
}

function deleteSession(id) {
  if (!confirm('Remove this session?')) return;
  const sessions = getSessions().filter(s => s.id !== id);
  saveSessions(sessions);
  renderSessions();
  updateSidebarToday();
  toast('Session removed.');
}

// ─── Weekly Tab ──────────────────────────────────────
function renderWeekly() {
  const sessions = getSessions();
  const week = getWeekDates();
  const today = todayStr();

  const now = new Date();
  const sundayLabel = new Date(now); sundayLabel.setDate(now.getDate() - now.getDay());
  const saturdayLabel = new Date(sundayLabel); saturdayLabel.setDate(sundayLabel.getDate() + 6);
  document.getElementById('week-range-label').textContent =
    `${sundayLabel.toLocaleDateString('en-US', { month:'long', day:'numeric' })} – ${saturdayLabel.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}`;

  const byDay = week.map(d => sessions.filter(s => s.date === d));
  const dayMins = byDay.map(ds => ds.reduce((a, s) => a + s.dur, 0));
  const weekSessions = sessions.filter(s => week.includes(s.date));
  const weekTotal = dayMins.reduce((a, m) => a + m, 0);
  const maxMins = Math.max(...dayMins, 30);
  const activeDays = dayMins.filter(m => m > 0).length;

  document.getElementById('week-stats').innerHTML = `
    <div class="stat-card"><div class="stat-val accent">${fmtDur(weekTotal)}</div><div class="stat-lbl">This Week</div></div>
    <div class="stat-card"><div class="stat-val">${weekSessions.length}</div><div class="stat-lbl">Sessions</div></div>
    <div class="stat-card"><div class="stat-val">${activeDays}</div><div class="stat-lbl">Active Days</div></div>
    <div class="stat-card"><div class="stat-val">${weekTotal ? fmtDur(Math.round(weekTotal / Math.max(activeDays,1))) : '–'}</div><div class="stat-lbl">Avg / Day</div></div>
  `;

  const chart = document.getElementById('week-chart');
  chart.innerHTML = week.map((d, i) => {
    const mins = dayMins[i];
    const pct = Math.round((mins / maxMins) * 100);
    const isToday = d === today;
    return `
      <div class="bar-col">
        <div class="bar-val">${mins ? (mins / 60).toFixed(1) + 'h' : ''}</div>
        <div class="bar-wrap">
          <div class="bar ${isToday ? 'today' : ''} ${mins ? 'has-data' : 'empty'}" style="height:100%;">
            <div class="bar-fill" style="height:${pct}%;"></div>
          </div>
        </div>
        <div class="bar-day ${isToday ? 'today-lbl' : ''}">${DAYS_SHORT[i]}</div>
      </div>
    `;
  }).join('');

  const wList = document.getElementById('week-session-list');
  if (!weekSessions.length) {
    wList.innerHTML = '<div class="empty-state">No sessions this week yet.</div>';
  } else {
    wList.innerHTML = weekSessions.map(s => `
      <div class="session-item">
        <div class="s-dot" style="background:${CAT_COLORS[s.cat]}"></div>
        <div class="s-body">
          <div class="s-subject">${CAT_EMOJI[s.cat]} ${s.subject}</div>
          <div class="s-meta">${DAYS_SHORT[new Date(s.date + 'T00:00').getDay()]} · ${s.start}–${s.end}</div>
        </div>
        <div class="s-dur">${fmtDur(s.dur)}</div>
      </div>
    `).join('');
  }

  // Category breakdown
  const catMap = {};
  weekSessions.forEach(s => { catMap[s.cat] = (catMap[s.cat] || 0) + s.dur; });
  const maxCat = Math.max(...Object.values(catMap), 1);
  const catEl = document.getElementById('week-cat-breakdown');
  if (!Object.keys(catMap).length) {
    catEl.innerHTML = '<div class="empty-state">No data yet.</div>';
  } else {
    catEl.innerHTML = Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, mins]) => `
      <div class="cat-row">
        <div class="cat-row-top">
          <span class="cat-name">${CAT_EMOJI[cat]} ${cat}</span>
          <span class="cat-val">${fmtDur(mins)}</span>
        </div>
        <div class="cat-bar-wrap">
          <div class="cat-bar-fill" style="width:${Math.round((mins/maxCat)*100)}%;background:${CAT_COLORS[cat]};"></div>
        </div>
      </div>
    `).join('');
  }
}

// ─── Monthly Tab ─────────────────────────────────────
let viewMonth = { y: new Date().getFullYear(), m: new Date().getMonth() };

function changeMonth(dir) {
  viewMonth.m += dir;
  if (viewMonth.m > 11) { viewMonth.m = 0; viewMonth.y++; }
  if (viewMonth.m < 0) { viewMonth.m = 11; viewMonth.y--; }
  renderMonthly();
}

function renderMonthly() {
  const sessions = getSessions();
  const { y, m } = viewMonth;
  document.getElementById('month-heading').textContent = `${MONTHS[m]} ${y}`;

  const prefix = `${y}-${String(m + 1).padStart(2, '0')}-`;
  const monthSessions = sessions.filter(s => s.date.startsWith(prefix));
  const byDay = {};
  monthSessions.forEach(s => {
    const d = parseInt(s.date.slice(-2));
    byDay[d] = (byDay[d] || 0) + s.dur;
  });

  const monthTotal = monthSessions.reduce((a, s) => a + s.dur, 0);
  const activeDays = Object.keys(byDay).length;
  const subjects = new Set(monthSessions.map(s => s.subject)).size;

  document.getElementById('month-stats').innerHTML = `
    <div class="stat-card"><div class="stat-val accent">${fmtDur(monthTotal)}</div><div class="stat-lbl">This Month</div></div>
    <div class="stat-card"><div class="stat-val">${monthSessions.length}</div><div class="stat-lbl">Sessions</div></div>
    <div class="stat-card"><div class="stat-val">${activeDays}</div><div class="stat-lbl">Active Days</div></div>
    <div class="stat-card"><div class="stat-val">${subjects}</div><div class="stat-lbl">Subjects</div></div>
  `;

  const firstDay = new Date(y, m, 1).getDay();
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const todayFull = todayStr();
  const isCurrentMonth = new Date().getFullYear() === y && new Date().getMonth() === m;

  let cells = '';
  for (let i = 0; i < firstDay; i++) cells += '<div></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const mins = byDay[d] || 0;
    const hrs = mins / 60;
    let bg;
    if (hrs === 0) bg = 'var(--surface2)';
    else if (hrs <= 1) bg = '#4d6e2a';
    else if (hrs <= 3) bg = '#7ab33d';
    else if (hrs <= 5) bg = '#aee55c';
    else bg = '#C8F56A';
    const dateStr = prefix + String(d).padStart(2, '0');
    const isToday = dateStr === todayFull;
    cells += `
      <div class="cal-day${mins ? ' has-data' : ''}${isToday ? ' today' : ''}"
           style="background:${bg};" title="${d} ${MONTHS[m]}: ${fmtDur(mins)}">
        ${d}
        <span class="tip">${fmtDur(mins)}</span>
      </div>`;
  }
  document.getElementById('month-cal').innerHTML = cells;

  // Top subjects
  const subjMap = {};
  monthSessions.forEach(s => { subjMap[s.subject] = (subjMap[s.subject] || 0) + s.dur; });
  const sorted = Object.entries(subjMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxS = sorted[0]?.[1] || 1;
  const subjEl = document.getElementById('month-subjects');
  if (!sorted.length) {
    subjEl.innerHTML = '<div class="empty-state">No data for this month.</div>';
  } else {
    subjEl.innerHTML = sorted.map(([sub, mins]) => `
      <div class="subj-row">
        <div class="subj-top">
          <span class="subj-name">${sub}</span>
          <span class="subj-val">${fmtDur(mins)}</span>
        </div>
        <div class="subj-bar-wrap">
          <div class="subj-bar-fill" style="width:${Math.round((mins/maxS)*100)}%;"></div>
        </div>
      </div>
    `).join('');
  }

  // Streak
  renderStreak();
}

function renderStreak() {
  const sessions = getSessions();
  const dateSet = new Set(sessions.map(s => s.date));

  let streak = 0, best = 0, temp = 0;
  const today = new Date();
  let d = new Date(today);
  // count current streak backwards from today
  while (true) {
    const ds = d.toISOString().slice(0, 10);
    if (dateSet.has(ds)) { streak++; d.setDate(d.getDate() - 1); }
    else break;
  }

  // best streak: sort all unique dates
  const sorted = [...dateSet].sort();
  let prev = null;
  for (const ds of sorted) {
    if (!prev) { temp = 1; }
    else {
      const diff = (new Date(ds) - new Date(prev)) / 86400000;
      if (diff === 1) temp++;
      else temp = 1;
    }
    if (temp > best) best = temp;
    prev = ds;
  }

  document.getElementById('streak-box').innerHTML = `
    <div class="streak-num">${streak}</div>
    <div class="streak-label">day streak 🔥</div>
    <div class="streak-best">Best streak: ${best} day${best !== 1 ? 's' : ''}</div>
    <div class="streak-best" style="margin-top:6px;">Total days studied: ${dateSet.size}</div>
  `;
}

// ─── Init ────────────────────────────────────────────
document.getElementById('log-date').value = todayStr();
renderLogStats();
updateSidebarToday();
