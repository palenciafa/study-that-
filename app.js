// ════════════════════════════════════════════════════
//  logthat! — app.js
//  All existing logic preserved. New additions:
//  - Lucide icon refresh
//  - Live session logging
//  - Tasks: start/end datetime, edit, subject mgr,
//    Lucide category icons, mini calendar with tooltip
// ════════════════════════════════════════════════════

/* ── Lucide refresh ──────────────────────────────────── */
function refreshIcons() { if (window.lucide) lucide.createIcons(); }

/* ── Constants ──────────────────────────────────────── */
const CAT_COLORS = {
  study:'#378ADD', review:'#1D9E75', practice:'#D4537E',
  reading:'#EF9F27', lecture:'#7F77DD', project:'#D85A30'
};
// Lucide icon names per category
const CAT_LUCIDE = {
  study:'book-open', review:'refresh-cw', practice:'pencil',
  reading:'book-marked', lecture:'graduation-cap', project:'monitor'
};
const CAT_EMOJI = { study:'📚', review:'🔁', practice:'✏️', reading:'📖', lecture:'🎓', project:'💻' };
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ── State ──────────────────────────────────────────── */
let currentUser = null;
let userProfile = {};
let allSessions = [];
let subjects    = [];         // session subjects
let taskSubjects = [];        // task subjects (separate list)
let allTasks    = [];
let pomodoroCount = 0;
let viewMonth   = { y: new Date().getFullYear(), m: new Date().getMonth() };
let taskFilter  = 'all';
let taskCalMonth = { y: new Date().getFullYear(), m: new Date().getMonth() };

// Live session state
let liveActive    = false;
let liveStartTime = null;
let liveInterval  = null;

/* ── Utility ─────────────────────────────────────────── */
function fmtD(mins) {
  if (!mins || mins <= 0) return '0m';
  const h = Math.floor(mins/60), m = mins%60;
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`;
}
function t2m(t) { const [h,m] = t.split(':').map(Number); return h*60+m; }
function todayStr() { return new Date().toISOString().slice(0,10); }
function fmtTime(t) {
  if (!t) return '';
  const [h,m] = t.split(':').map(Number);
  const ampm = h>=12?'PM':'AM';
  return `${h%12||12}:${String(m).padStart(2,'0')} ${ampm}`;
}
function fmtDateTime(dt) {
  if (!dt) return '';
  const d = new Date(dt);
  return d.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' ' + fmtTime(`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`);
}
function weekDates() {
  const n = new Date(), dow = n.getDay();
  return Array.from({length:7}, (_,i)=>{ const d=new Date(n); d.setDate(n.getDate()-dow+i); return d.toISOString().slice(0,10); });
}
function toast(msg, isErr=false) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.color = isErr ? 'var(--danger)' : 'var(--text)';
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), 2500);
}

/* ── Auth ────────────────────────────────────────────── */
function showPanel(name) {
  document.querySelectorAll('.auth-panel').forEach(p=>p.classList.remove('active'));
  document.getElementById(`auth-${name}`).classList.add('active');
  document.getElementById('auth-msg').textContent='';
  document.getElementById('auth-msg').className='auth-msg';
}
function authMsg(msg, type='err') {
  const el = document.getElementById('auth-msg');
  el.textContent=msg; el.className=`auth-msg ${type}`;
}
async function doLogin() {
  const email=document.getElementById('login-email').value.trim();
  const pass=document.getElementById('login-password').value;
  if(!email||!pass){authMsg('Please fill all fields.');return;}
  authMsg('Signing in…','ok');
  const {data,error}=await sb.auth.signInWithPassword({email,password:pass});
  if(error){authMsg(error.message);return;}
  initApp(data.user);
}
async function doSignup() {
  const name=document.getElementById('signup-name').value.trim();
  const email=document.getElementById('signup-email').value.trim();
  const pass=document.getElementById('signup-password').value;
  if(!name||!email||!pass){authMsg('Please fill all fields.');return;}
  if(pass.length<6){authMsg('Password must be at least 6 characters.');return;}
  authMsg('Creating account…','ok');
  const {error}=await sb.auth.signUp({email,password:pass,options:{data:{display_name:name}}});
  if(error){authMsg(error.message);return;}
  await sb.auth.signOut();
  currentUser=null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').style.display='flex';
  showPanel('signup');
  authMsg('Account created! Please confirm your email first, then log in.','ok');
}
async function doForgot() {
  const email=document.getElementById('forgot-email').value.trim();
  if(!email){authMsg('Enter your email.');return;}
  const {error}=await sb.auth.resetPasswordForEmail(email);
  if(error){authMsg(error.message);return;}
  authMsg('Reset link sent! Check your inbox.','ok');
}
async function doLogout() {
  await sb.auth.signOut();
  currentUser=null; userProfile={}; allSessions=[]; subjects=[]; allTasks=[]; taskSubjects=[];
  stopLiveSessionSilent();
  document.getElementById('app').classList.add('hidden');
  document.getElementById('auth-screen').style.display='flex';
  showPanel('login');
}

/* ── Init ────────────────────────────────────────────── */
async function initApp(user) {
  currentUser=user;
  document.getElementById('auth-screen').style.display='none';
  document.getElementById('app').classList.remove('hidden');
  await loadProfile();
  await loadSubjects();
  await loadTaskSubjects();
  await loadSessions();
  await loadTasks();
  updateSubjectDropdowns();
  renderDashboard();
  updateSidebar();
  applyTheme(userProfile.theme||'dark');
  document.getElementById('l-date').value=todayStr();
  document.getElementById('dash-greeting').textContent=greeting();
  refreshIcons();
}
function greeting() {
  const h=new Date().getHours(), name=userProfile.display_name||'there';
  if(h<12) return `Good morning, ${name} ☀️`;
  if(h<17) return `Good afternoon, ${name} 🌤`;
  return `Good evening, ${name} 🌙`;
}

/* ── Profile / DB ────────────────────────────────────── */
async function loadProfile() {
  const {data}=await sb.from('profiles').select('*').eq('id',currentUser.id).single();
  userProfile=data||{id:currentUser.id,display_name:currentUser.user_metadata?.display_name||'',daily_goal:240,theme:'dark'};
  document.getElementById('p-name').value=userProfile.display_name||'';
  document.getElementById('p-email').value=currentUser.email;
  document.getElementById('p-goal').value=userProfile.daily_goal||240;
  document.getElementById('p-theme').value=userProfile.theme||'dark';
  const initials=(userProfile.display_name||currentUser.email||'?').charAt(0).toUpperCase();
  document.getElementById('profile-avatar').textContent=initials;
  document.getElementById('sb-goal').textContent=`of ${userProfile.daily_goal?fmtD(userProfile.daily_goal):'4h'} goal`;
}
async function saveProfile() {
  const name=document.getElementById('p-name').value.trim();
  const goal=parseInt(document.getElementById('p-goal').value);
  const theme=document.getElementById('p-theme').value;
  const {error}=await sb.from('profiles').upsert({id:currentUser.id,display_name:name,daily_goal:goal,theme});
  if(error){toast('Save failed: '+error.message,true);return;}
  userProfile={...userProfile,display_name:name,daily_goal:goal,theme};
  applyTheme(theme); updateSidebar(); toast('Profile saved ✓');
}

/* ── Session subjects ────────────────────────────────── */
async function loadSubjects() {
  const {data}=await sb.from('subjects').select('*').eq('user_id',currentUser.id).order('name');
  subjects=data?data.map(r=>r.name):[];
}
async function addSubject() {
  const input=document.getElementById('new-subject-input');
  const name=input.value.trim();
  if(!name) return;
  if(subjects.includes(name)){toast('Subject already exists.');return;}
  const {error}=await sb.from('subjects').insert({user_id:currentUser.id,name});
  if(error){toast('Error: '+error.message,true);return;}
  subjects.push(name); subjects.sort();
  input.value='';
  updateSubjectDropdowns(); renderSubjectChips(); toast(`"${name}" added`);
}
async function deleteSubject(name) {
  await sb.from('subjects').delete().eq('user_id',currentUser.id).eq('name',name);
  subjects=subjects.filter(s=>s!==name);
  updateSubjectDropdowns(); renderSubjectChips();
}
function updateSubjectDropdowns() {
  ['l-subj','t-subj','e-subj','f-subj','live-subj'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const prev=el.value;
    el.innerHTML=id==='f-subj'?'<option value="">All subjects</option>':'<option value="">Select subject…</option>';
    subjects.forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;el.appendChild(o);});
    if(subjects.includes(prev)) el.value=prev;
  });
}
function showSubjectManager(){renderSubjectChips();openModal('modal-subjects');}
function renderSubjectChips(){
  document.getElementById('subject-chips').innerHTML=subjects.map(s=>
    `<div class="chip">${s}<button class="chip-del" onclick="deleteSubject('${s.replace(/'/g,"\\'")}')">✕</button></div>`
  ).join('')||'<span style="color:var(--text3);font-size:0.82rem">No subjects yet.</span>';
}

/* ── Task subjects (separate table) ─────────────────── */
async function loadTaskSubjects() {
  const {data}=await sb.from('task_subjects').select('*').eq('user_id',currentUser.id).order('name');
  taskSubjects=data?data.map(r=>r.name):[];
  updateTaskSubjectDropdowns();
}
async function addTaskSubject() {
  const input=document.getElementById('new-task-subject-input');
  const name=input.value.trim();
  if(!name) return;
  if(taskSubjects.includes(name)){toast('Subject already exists.');return;}
  const {error}=await sb.from('task_subjects').insert({user_id:currentUser.id,name});
  if(error){toast('Error: '+error.message,true);return;}
  taskSubjects.push(name); taskSubjects.sort();
  input.value='';
  updateTaskSubjectDropdowns(); renderTaskSubjectChips(); toast(`"${name}" added`);
}
async function deleteTaskSubject(name) {
  await sb.from('task_subjects').delete().eq('user_id',currentUser.id).eq('name',name);
  taskSubjects=taskSubjects.filter(s=>s!==name);
  updateTaskSubjectDropdowns(); renderTaskSubjectChips();
}
function updateTaskSubjectDropdowns(){
  ['task-subj-input','et-subj'].forEach(id=>{
    const el=document.getElementById(id); if(!el) return;
    const prev=el.value;
    el.innerHTML='<option value="">No subject</option>';
    taskSubjects.forEach(s=>{const o=document.createElement('option');o.value=s;o.textContent=s;el.appendChild(o);});
    if(taskSubjects.includes(prev)) el.value=prev;
  });
}
function showTaskSubjectManager(){renderTaskSubjectChips();openModal('modal-task-subjects');}
function renderTaskSubjectChips(){
  document.getElementById('task-subject-chips').innerHTML=taskSubjects.map(s=>
    `<div class="chip">${s}<button class="chip-del" onclick="deleteTaskSubject('${s.replace(/'/g,"\\'")}')">✕</button></div>`
  ).join('')||'<span style="color:var(--text3);font-size:0.82rem">No subjects yet.</span>';
}

/* ── Sessions DB ─────────────────────────────────────── */
async function loadSessions(){
  const {data}=await sb.from('sessions').select('*').eq('user_id',currentUser.id).order('date',{ascending:false}).order('start_time',{ascending:false});
  allSessions=data||[];
}

/* ── Log mode switch ─────────────────────────────────── */
function switchLogMode(mode){
  document.getElementById('lmb-manual').classList.toggle('active',mode==='manual');
  document.getElementById('lmb-live').classList.toggle('active',mode==='live');
  document.getElementById('panel-manual').style.display=mode==='manual'?'block':'none';
  document.getElementById('panel-live').style.display=mode==='live'?'block':'none';
  if(mode==='live') updateSubjectDropdowns();
  refreshIcons();
}

/* ── Live session ────────────────────────────────────── */
function startLiveSession(){
  const subj=document.getElementById('live-subj').value;
  if(!subj){toast('Select a subject first',true);return;}
  liveActive=true; liveStartTime=new Date();
  document.getElementById('live-setup').style.display='none';
  document.getElementById('live-running').style.display='block';
  document.getElementById('live-subj-display').textContent=subj;
  const fmt=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  document.getElementById('live-started-label').textContent='Started at '+fmtTime(fmt(liveStartTime));
  document.getElementById('live-notes-run').value=document.getElementById('live-notes-pre').value;
  liveInterval=setInterval(tickLive,1000); tickLive();
}
function tickLive(){
  const elapsed=Math.floor((Date.now()-liveStartTime)/1000);
  const h=Math.floor(elapsed/3600),m=Math.floor((elapsed%3600)/60),s=elapsed%60;
  document.getElementById('live-elapsed').textContent=
    `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}
async function stopLiveSession(){
  if(!liveActive||!liveStartTime) return;
  clearInterval(liveInterval);
  const endTime=new Date();
  const subj=document.getElementById('live-subj').value;
  const cat=document.getElementById('live-cat').value;
  const notes=document.getElementById('live-notes-run').value.trim();
  const fmt=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const ok=await logSession({date:liveStartTime.toISOString().slice(0,10),subj,start:fmt(liveStartTime),end:fmt(endTime),cat,notes});
  if(ok) resetLiveSession();
}
function cancelLiveSession(){
  if(liveActive&&!confirm('Cancel? Time will not be saved.')) return;
  resetLiveSession();
}
function stopLiveSessionSilent(){ clearInterval(liveInterval); liveActive=false; liveStartTime=null; }
function resetLiveSession(){
  clearInterval(liveInterval); liveActive=false; liveStartTime=null;
  document.getElementById('live-setup').style.display='block';
  document.getElementById('live-running').style.display='none';
  document.getElementById('live-subj').value='';
  document.getElementById('live-notes-pre').value='';
  document.getElementById('live-notes-run').value='';
  document.getElementById('live-elapsed').textContent='00:00:00';
}

/* ── Log Session ─────────────────────────────────────── */
async function logSession(overrides={}){
  const date=overrides.date||document.getElementById('l-date').value;
  const subj=overrides.subj||document.getElementById('l-subj').value;
  const start=overrides.start||document.getElementById('l-start').value;
  const end=overrides.end||document.getElementById('l-end').value;
  const cat=overrides.cat||document.getElementById('l-cat').value;
  const notes=overrides.notes!==undefined?overrides.notes:document.getElementById('l-notes').value.trim();
  if(!date){toast('Pick a date',true);return false;}
  if(!subj){toast('Select a subject',true);return false;}
  if(!start||!end){toast('Enter start and end times',true);return false;}
  const dur=t2m(end)-t2m(start);
  if(dur<=0){toast('End must be after start',true);return false;}
  const {data,error}=await sb.from('sessions').insert({user_id:currentUser.id,date,subject:subj,start_time:start,end_time:end,duration:dur,category:cat,notes}).select().single();
  if(error){toast('Error: '+error.message,true);return false;}
  allSessions.unshift(data);
  if(!overrides.subj){
    document.getElementById('l-subj').value='';
    document.getElementById('l-start').value='';
    document.getElementById('l-end').value='';
    document.getElementById('l-notes').value='';
    document.getElementById('dur-p').textContent='Enter start and end times to preview duration';
    document.getElementById('dur-p').className='dur-preview';
  }
  updateSidebar(); checkAchievements(); toast('Session saved ✓'); return true;
}

/* ── Delete / Edit Session ───────────────────────────── */
async function deleteSession(id){
  if(!confirm('Delete this session?')) return;
  await sb.from('sessions').delete().eq('id',id);
  allSessions=allSessions.filter(s=>s.id!==id);
  refreshCurrentTab(); updateSidebar(); toast('Session deleted');
}
let editingId=null;
function openEditModal(id){
  const s=allSessions.find(x=>x.id===id); if(!s) return;
  editingId=id;
  document.getElementById('e-date').value=s.date;
  document.getElementById('e-subj').value=s.subject;
  document.getElementById('e-start').value=s.start_time;
  document.getElementById('e-end').value=s.end_time;
  document.getElementById('e-cat').value=s.category;
  document.getElementById('e-notes').value=s.notes||'';
  openModal('modal-edit');
}
async function saveEdit(){
  const date=document.getElementById('e-date').value;
  const subj=document.getElementById('e-subj').value;
  const start=document.getElementById('e-start').value;
  const end=document.getElementById('e-end').value;
  const cat=document.getElementById('e-cat').value;
  const notes=document.getElementById('e-notes').value.trim();
  const dur=t2m(end)-t2m(start);
  if(dur<=0){toast('End must be after start',true);return;}
  const {error}=await sb.from('sessions').update({date,subject:subj,start_time:start,end_time:end,category:cat,notes,duration:dur}).eq('id',editingId);
  if(error){toast('Error: '+error.message,true);return;}
  const idx=allSessions.findIndex(s=>s.id===editingId);
  if(idx>=0) allSessions[idx]={...allSessions[idx],date,subject:subj,start_time:start,end_time:end,category:cat,notes,duration:dur};
  closeModal('modal-edit'); refreshCurrentTab(); updateSidebar(); toast('Session updated ✓');
}

/* ── Session HTML ────────────────────────────────────── */
function sessionHTML(s, showDelete=true){
  const catIcon = CAT_LUCIDE[s.category]||'book-open';
  return `<div class="si">
    <div class="s-dot" style="background:${CAT_COLORS[s.category]}"></div>
    <div class="s-body">
      <div class="s-sub">
        <i data-lucide="${catIcon}" style="width:13px;height:13px;vertical-align:-1px;margin-right:4px;color:${CAT_COLORS[s.category]}"></i>
        ${s.subject}
      </div>
      <div class="s-meta">${s.date} · ${fmtTime(s.start_time)}–${fmtTime(s.end_time)} · ${s.category}</div>
      ${s.notes?`<div class="s-note">${s.notes}</div>`:''}
    </div>
    <div class="s-dur">${fmtD(s.duration)}</div>
    ${showDelete?`<div class="s-actions">
      <button class="s-btn" onclick="openEditModal('${s.id}')" title="Edit"><i data-lucide="pencil" style="width:13px;height:13px"></i></button>
      <button class="s-btn del" onclick="deleteSession('${s.id}')" title="Delete"><i data-lucide="trash-2" style="width:13px;height:13px"></i></button>
    </div>`:''}
  </div>`;
}

function statCards(stats){
  return stats.map(s=>`<div class="stat-card"><div class="stat-v${s.accent?' accent':''}">${s.v}</div><div class="stat-l">${s.l}</div></div>`).join('');
}

/* ── Dashboard ───────────────────────────────────────── */
function renderDashboard(){
  const today=todayStr(),week=weekDates();
  const nowMonth=`${new Date().getFullYear()}-${String(new Date().getMonth()+1).padStart(2,'0')}-`;
  const todayMins=allSessions.filter(s=>s.date===today).reduce((a,s)=>a+s.duration,0);
  const weekMins=allSessions.filter(s=>week.includes(s.date)).reduce((a,s)=>a+s.duration,0);
  const monthMins=allSessions.filter(s=>s.date.startsWith(nowMonth)).reduce((a,s)=>a+s.duration,0);
  const streak=calcStreak(), topSubj=topSubject();
  document.getElementById('dash-stats').innerHTML=statCards([
    {v:fmtD(weekMins),l:'This Week',accent:true},
    {v:fmtD(monthMins),l:'This Month'},
    {v:allSessions.length,l:'Sessions'},
    {v:streak+' days',l:'Best Streak'},
    {v:topSubj||'–',l:'Top Subject'},
  ]);
  const byDay=week.map(d=>allSessions.filter(s=>s.date===d).reduce((a,s)=>a+s.duration,0));
  const maxMins=Math.max(...byDay,30);
  document.getElementById('dash-week-chart').innerHTML=week.map((d,i)=>{
    const pct=Math.round((byDay[i]/maxMins)*100),isT=d===today;
    return `<div class="bc"><div class="bar-val">${byDay[i]?(byDay[i]/60).toFixed(1)+'h':''}</div>
      <div class="bwrap"><div class="bar${isT?' today':''}"><div class="bar-fill" style="height:${pct}%"></div></div></div>
      <div class="bar-day${isT?' today-d':''}">${DAY_NAMES[i].slice(0,2)}</div></div>`;
  }).join('');
  const sm={};
  allSessions.forEach(s=>sm[s.subject]=(sm[s.subject]||0)+s.duration);
  const sorted=Object.entries(sm).sort((a,b)=>b[1]-a[1]).slice(0,5);
  const maxS=sorted[0]?.[1]||1;
  document.getElementById('dash-top-subjects').innerHTML=sorted.length
    ?sorted.map(([n,m])=>`<div class="subj-row"><div class="subj-top"><span class="subj-n">${n}</span><span class="subj-v">${fmtD(m)}</span></div><div class="subj-bw"><div class="subj-bf" style="width:${Math.round(m/maxS*100)}%"></div></div></div>`).join('')
    :'<div class="empty">No sessions yet.</div>';
  const recent=allSessions.slice(0,5);
  document.getElementById('dash-recent').innerHTML=recent.length
    ?recent.map(s=>sessionHTML(s)).join('')
    :'<div class="empty">No sessions yet. Start logging!</div>';
  refreshIcons();
}
function topSubject(){
  const sm={};
  allSessions.forEach(s=>sm[s.subject]=(sm[s.subject]||0)+s.duration);
  return Object.entries(sm).sort((a,b)=>b[1]-a[1])[0]?.[0]||null;
}

/* ── Sidebar ─────────────────────────────────────────── */
function updateSidebar(){
  const today=todayStr();
  const todayMins=allSessions.filter(s=>s.date===today).reduce((a,s)=>a+s.duration,0);
  const goal=userProfile.daily_goal||240;
  document.getElementById('sb-today').textContent=fmtD(todayMins);
  document.getElementById('sb-fill').style.width=Math.min(100,Math.round(todayMins/goal*100))+'%';
  document.getElementById('sb-goal').textContent=`of ${fmtD(goal)} goal`;
}

/* ── Sessions tab ────────────────────────────────────── */
function renderSessions(){
  const fc=document.getElementById('f-cat').value;
  const fs=document.getElementById('f-subj').value;
  const fq=document.getElementById('f-search').value.toLowerCase();
  const filtered=allSessions.filter(s=>(!fc||s.category===fc)&&(!fs||s.subject===fs)&&(!fq||s.subject.toLowerCase().includes(fq)||(s.notes||'').toLowerCase().includes(fq)));
  const tot=allSessions.reduce((a,s)=>a+s.duration,0);
  const today=todayStr();
  const todayMins=allSessions.filter(s=>s.date===today).reduce((a,s)=>a+s.duration,0);
  document.getElementById('sessions-stats').innerHTML=statCards([
    {v:fmtD(tot),l:'Total Time',accent:true},
    {v:allSessions.length,l:'Sessions'},
    {v:new Set(allSessions.map(s=>s.subject)).size,l:'Subjects'},
    {v:fmtD(todayMins),l:'Today'},
  ]);
  const el=document.getElementById('session-list');
  el.innerHTML=filtered.length?filtered.map(s=>sessionHTML(s)).join(''):'<div class="empty">No sessions found.</div>';
  refreshIcons();
}
function exportCSV(){
  const headers=['Date','Subject','Start Time','End Time','Duration (min)','Category','Notes'];
  const rows=allSessions.map(s=>[s.date,s.subject,s.start_time,s.end_time,s.duration,s.category,s.notes||'']);
  const csv=[headers,...rows].map(r=>r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob=new Blob([csv],{type:'text/csv'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download=`studylog-${todayStr()}.csv`;
  a.click(); toast('CSV exported ✓');
}

/* ── Weekly ──────────────────────────────────────────── */
function renderWeekly(){
  const week=weekDates(),today=todayStr();
  const n=new Date(),sun=new Date(n);sun.setDate(n.getDate()-n.getDay());
  const sat=new Date(sun);sat.setDate(sun.getDate()+6);
  document.getElementById('wk-range').textContent=
    sun.toLocaleDateString('en-US',{month:'long',day:'numeric'})+' – '+
    sat.toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'});
  const byDay=week.map(d=>allSessions.filter(s=>s.date===d));
  const dm=byDay.map(ds=>ds.reduce((a,s)=>a+s.duration,0));
  const wkS=allSessions.filter(s=>week.includes(s.date));
  const wkT=dm.reduce((a,m)=>a+m,0),act=dm.filter(m=>m>0).length,mx=Math.max(...dm,30);
  document.getElementById('wk-stats').innerHTML=statCards([
    {v:fmtD(wkT),l:'This Week',accent:true},{v:wkS.length,l:'Sessions'},{v:act,l:'Active Days'},{v:act?fmtD(Math.round(wkT/act)):'–',l:'Avg/Day'},
  ]);
  document.getElementById('wk-chart').innerHTML=week.map((d,i)=>{
    const pct=Math.round((dm[i]/mx)*100),isT=d===today;
    return `<div class="bc"><div class="bar-val">${dm[i]?(dm[i]/60).toFixed(1)+'h':''}</div>
      <div class="bwrap"><div class="bar${isT?' today':''}"><div class="bar-fill" style="height:${pct}%"></div></div></div>
      <div class="bar-day${isT?' today-d':''}">${DAY_NAMES[new Date(d+'T00:00').getDay()].slice(0,2)}</div></div>`;
  }).join('');
  const wl=document.getElementById('wk-list');
  wl.innerHTML=wkS.length?wkS.map(s=>sessionHTML(s)).join(''):'<div class="empty">No sessions this week.</div>';
  const cm={};
  wkS.forEach(s=>cm[s.category]=(cm[s.category]||0)+s.duration);
  const maxC=Math.max(...Object.values(cm),1);
  document.getElementById('wk-cats').innerHTML=Object.keys(cm).length
    ?Object.entries(cm).sort((a,b)=>b[1]-a[1]).map(([c,m])=>`
      <div class="cat-row"><div class="cat-top">
        <span class="cat-n"><i data-lucide="${CAT_LUCIDE[c]||'book-open'}" style="width:13px;height:13px;vertical-align:-1px;margin-right:4px;color:${CAT_COLORS[c]}"></i>${c}</span>
        <span class="cat-v">${fmtD(m)}</span></div>
        <div class="cat-bw"><div class="cat-bf" style="width:${Math.round(m/maxC*100)}%;background:${CAT_COLORS[c]}"></div></div></div>`).join('')
    :'<div class="empty">No data.</div>';
  refreshIcons();
}

/* ── Monthly ─────────────────────────────────────────── */
function changeMonth(dir){
  viewMonth.m+=dir;
  if(viewMonth.m>11){viewMonth.m=0;viewMonth.y++;}
  if(viewMonth.m<0){viewMonth.m=11;viewMonth.y--;}
  renderMonthly();
}
function renderMonthly(){
  const {y,m}=viewMonth;
  document.getElementById('m-heading').textContent=`${MONTH_NAMES[m]} ${y}`;
  const prefix=`${y}-${String(m+1).padStart(2,'0')}-`;
  const ms=allSessions.filter(s=>s.date.startsWith(prefix));
  const bd={};
  ms.forEach(s=>{const d=parseInt(s.date.slice(-2));bd[d]=(bd[d]||0)+s.duration;});
  const mt=ms.reduce((a,s)=>a+s.duration,0),act=Object.keys(bd).length;
  document.getElementById('m-stats').innerHTML=statCards([
    {v:fmtD(mt),l:'Month Total',accent:true},{v:ms.length,l:'Sessions'},{v:act,l:'Active Days'},{v:new Set(ms.map(s=>s.subject)).size,l:'Subjects'},
  ]);
  const fd=new Date(y,m,1).getDay(),dim=new Date(y,m+1,0).getDate(),todayFull=todayStr();
  let cells='';
  for(let i=0;i<fd;i++) cells+='<div></div>';
  for(let d=1;d<=dim;d++){
    const mins=bd[d]||0,hrs=mins/60;
    const bg=hrs===0?'var(--surface2)':hrs<=1?'#2d5a27':hrs<=3?'#4a8c3f':hrs<=5?'#6ab84f':'#8de56a';
    const ds=prefix+String(d).padStart(2,'0'),isT=ds===todayFull;
    cells+=`<div class="cd${mins?' has-data':''}${isT?' today':''}" style="background:${bg}"
      onclick="${mins?`showDayDetail('${ds}')`:'void(0)'}" title="${fmtD(mins)}">${d}</div>`;
  }
  document.getElementById('m-cal').innerHTML=cells;
  const sm={};
  ms.forEach(s=>sm[s.subject]=(sm[s.subject]||0)+s.duration);
  const sorted=Object.entries(sm).sort((a,b)=>b[1]-a[1]).slice(0,6);
  const maxS=sorted[0]?.[1]||1;
  document.getElementById('m-subjs').innerHTML=sorted.length
    ?sorted.map(([n,mv])=>`<div class="subj-row"><div class="subj-top"><span class="subj-n">${n}</span><span class="subj-v">${fmtD(mv)}</span></div><div class="subj-bw"><div class="subj-bf" style="width:${Math.round(mv/maxS*100)}%"></div></div></div>`).join('')
    :'<div class="empty">No data.</div>';
  const ds=new Set(allSessions.map(s=>s.date));
  let streak=0,tmp=0,best=0,prev=null;
  const nd=new Date();let dd=new Date(nd);
  while(true){const str=dd.toISOString().slice(0,10);if(ds.has(str)){streak++;dd.setDate(dd.getDate()-1);}else break;}
  [...ds].sort().forEach(x=>{tmp=prev?(new Date(x)-new Date(prev))/86400000===1?tmp+1:1:1;if(tmp>best)best=tmp;prev=x;});
  document.getElementById('m-streak').innerHTML=`<div class="streak-n">${streak}</div><div class="streak-l">day streak 🔥</div><div class="streak-s">Best: ${best} days<br>Total days studied: ${ds.size}</div>`;
  document.getElementById('day-detail').style.display='none';
  refreshIcons();
}
function showDayDetail(dateStr){
  const dayS=allSessions.filter(s=>s.date===dateStr);
  const d=new Date(dateStr+'T00:00');
  document.getElementById('ddp-title').textContent=`Sessions for ${d.toLocaleDateString('en-US',{month:'long',day:'numeric'})}`;
  document.getElementById('ddp-list').innerHTML=dayS.length?dayS.map(s=>sessionHTML(s)).join(''):'<div class="empty">No sessions this day.</div>';
  document.getElementById('day-detail').style.display='block';
  document.getElementById('day-detail').scrollIntoView({behavior:'smooth',block:'nearest'});
  refreshIcons();
}
function calcStreak(){
  const ds=new Set(allSessions.map(s=>s.date));
  let best=0,tmp=0,prev=null;
  [...ds].sort().forEach(x=>{tmp=prev?(new Date(x)-new Date(prev))/86400000===1?tmp+1:1:1;if(tmp>best)best=tmp;prev=x;});
  return best;
}

/* ══════════════════════════════════════════════════
   TASKS
══════════════════════════════════════════════════ */
async function loadTasks(){
  const {data}=await sb.from('tasks').select('*').eq('user_id',currentUser.id).order('created_at',{ascending:true});
  allTasks=data||[];
}
function setTaskFilter(f){
  taskFilter=f;
  document.querySelectorAll('.tft').forEach(b=>b.classList.toggle('active',b.dataset.filter===f));
  renderTasks(); renderTaskCalendar();
}
async function addTask(){
  const title=document.getElementById('task-title-input').value.trim();
  const subj=document.getElementById('task-subj-input').value;
  const type=document.getElementById('task-type-input').value;
  const priority=document.getElementById('task-priority-input').value;
  const cat=document.getElementById('task-cat-input').value;
  const start=document.getElementById('task-start-input').value||null;
  const end=document.getElementById('task-end-input').value||null;
  const notes=document.getElementById('task-notes-input').value.trim();
  if(!title){toast('Enter a task title',true);return;}
  const {data,error}=await sb.from('tasks').insert({user_id:currentUser.id,title,subject:subj||null,type,priority,category:cat||null,start_datetime:start,end_datetime:end,notes,done:false}).select().single();
  if(error){toast('Error: '+error.message,true);return;}
  allTasks.push(data);
  closeModal('modal-add-task');
  document.getElementById('task-title-input').value='';
  document.getElementById('task-subj-input').value='';
  document.getElementById('task-start-input').value='';
  document.getElementById('task-end-input').value='';
  document.getElementById('task-notes-input').value='';
  document.getElementById('task-priority-input').value='medium';
  document.getElementById('task-cat-input').value='';
  renderTasks(); renderTaskCalendar(); toast('Task added ✓');
}

let editingTaskId=null;
function openEditTaskModal(id){
  const t=allTasks.find(x=>x.id===id); if(!t) return;
  editingTaskId=id;
  document.getElementById('et-title').value=t.title;
  document.getElementById('et-subj').value=t.subject||'';
  document.getElementById('et-type').value=t.type;
  document.getElementById('et-priority').value=t.priority;
  document.getElementById('et-cat').value=t.category||'';
  document.getElementById('et-start').value=t.start_datetime?t.start_datetime.slice(0,16):'';
  document.getElementById('et-end').value=t.end_datetime?t.end_datetime.slice(0,16):'';
  document.getElementById('et-notes').value=t.notes||'';
  openModal('modal-edit-task');
}
async function saveTaskEdit(){
  const title=document.getElementById('et-title').value.trim();
  if(!title){toast('Enter a title',true);return;}
  const updates={
    title,
    subject:document.getElementById('et-subj').value||null,
    type:document.getElementById('et-type').value,
    priority:document.getElementById('et-priority').value,
    category:document.getElementById('et-cat').value||null,
    start_datetime:document.getElementById('et-start').value||null,
    end_datetime:document.getElementById('et-end').value||null,
    notes:document.getElementById('et-notes').value.trim(),
  };
  const {error}=await sb.from('tasks').update(updates).eq('id',editingTaskId);
  if(error){toast('Error: '+error.message,true);return;}
  const idx=allTasks.findIndex(t=>t.id===editingTaskId);
  if(idx>=0) allTasks[idx]={...allTasks[idx],...updates};
  closeModal('modal-edit-task');
  renderTasks(); renderTaskCalendar(); toast('Task updated ✓');
}

async function toggleTask(id){
  const task=allTasks.find(t=>t.id===id); if(!task) return;
  const newDone=!task.done;
  const {error}=await sb.from('tasks').update({done:newDone}).eq('id',id);
  if(error){toast('Error: '+error.message,true);return;}
  task.done=newDone;
  const el=document.querySelector(`[data-task-id="${id}"]`);
  if(el){
    el.classList.add('completing');
    setTimeout(()=>el.classList.remove('completing'),550);
    el.querySelector('.task-check')?.classList.toggle('checked',newDone);
    el.classList.toggle('done',newDone);
  }
  if(newDone){spawnConfetti(el);toast('Task completed! 🎉');}
  renderTaskProgress();
}
async function deleteTask(id){
  await sb.from('tasks').delete().eq('id',id);
  allTasks=allTasks.filter(t=>t.id!==id);
  renderTasks(); renderTaskCalendar(); toast('Task removed');
}

function spawnConfetti(anchor){
  const colors=['#8de56a','#6ab84f','#f0a535','#60a8f0','#d4537e','#f2f2f4'];
  const rect=anchor?anchor.getBoundingClientRect():{left:window.innerWidth/2,top:window.innerHeight/2,width:0,height:0};
  const ox=rect.left+rect.width/2,oy=rect.top+rect.height/2;
  const burst=document.createElement('div');
  burst.className='confetti-burst'; burst.style.left=ox+'px'; burst.style.top=oy+'px';
  document.body.appendChild(burst);
  for(let i=0;i<20;i++){
    const p=document.createElement('div');
    p.className='confetti-piece';
    const angle=(i/20)*360,dist=55+Math.random()*65;
    const tx=Math.cos(angle*Math.PI/180)*dist,ty=Math.sin(angle*Math.PI/180)*dist-30;
    p.style.cssText=`background:${colors[i%colors.length]};--tx:${tx}px;--ty:${ty}px;--rot:${Math.random()*360}deg;animation-delay:${Math.random()*0.08}s;border-radius:${Math.random()>.5?'50%':'2px'}`;
    burst.appendChild(p);
  }
  setTimeout(()=>burst.remove(),1000);
}

function renderTaskProgress(){
  const visible=taskFilter==='all'?allTasks:allTasks.filter(t=>t.type===taskFilter);
  const done=visible.filter(t=>t.done).length,total=visible.length;
  const pct=total?Math.round((done/total)*100):0;
  document.getElementById('task-prog-label').textContent=`${done} of ${total} completed`;
  document.getElementById('task-prog-pct').textContent=`${pct}%`;
  document.getElementById('task-prog-fill').style.width=`${pct}%`;
}

function renderTasks(){
  const container=document.getElementById('tasks-container');
  const today=todayStr();
  const filtered=taskFilter==='all'?allTasks:allTasks.filter(t=>t.type===taskFilter);
  renderTaskProgress();
  if(!filtered.length){
    container.innerHTML=`<div class="tasks-empty"><p>No tasks here yet.</p><p class="tasks-empty-hint">Click <strong>New Task</strong> to add one.</p></div>`;
    refreshIcons(); return;
  }
  const groups=taskFilter==='all'?['daily','weekly','monthly','goals']:[taskFilter];
  const typeLabels={daily:'Daily',weekly:'Weekly',monthly:'Monthly',goals:'Goals'};
  const typeIcons={daily:'sun',weekly:'calendar-days',monthly:'calendar-range',goals:'target'};
  const priorityOrder={high:0,medium:1,low:2};
  let html='';
  for(const type of groups){
    const items=filtered.filter(t=>t.type===type);
    if(!items.length) continue;
    html+=`<div class="task-group"><div class="task-group-header">
      <i data-lucide="${typeIcons[type]}" style="width:13px;height:13px"></i>
      ${typeLabels[type]}
      <span class="task-group-count">${items.filter(t=>t.done).length}/${items.length}</span>
    </div>`;
    const sorted=[...items].sort((a,b)=>{
      if(a.done!==b.done) return a.done?1:-1;
      return (priorityOrder[a.priority]||1)-(priorityOrder[b.priority]||1);
    });
    for(const t of sorted){
      const startStr=t.start_datetime?fmtDateTime(t.start_datetime):'';
      const endStr=t.end_datetime?fmtDateTime(t.end_datetime):'';
      const isOverdue=t.end_datetime&&!t.done&&new Date(t.end_datetime)<new Date();
      const catIcon=t.category?CAT_LUCIDE[t.category]||'book-open':'';
      html+=`<div class="task-item ${t.done?'done':''}" data-task-id="${t.id}">
        <div class="task-check ${t.done?'checked':''}" onclick="toggleTask('${t.id}')"></div>
        <div class="task-body">
          <div class="task-title">${t.title}</div>
          <div class="task-meta">
            <span class="task-badge ${t.type}">${typeLabels[t.type]}</span>
            <span class="task-badge ${t.priority}">${t.priority}</span>
            ${t.category?`<span class="task-badge cat"><i data-lucide="${catIcon}" style="width:11px;height:11px;vertical-align:-1px;margin-right:3px;color:${CAT_COLORS[t.category]||'inherit'}"></i>${t.category}</span>`:''}
            ${t.subject?`<span class="task-subj-badge">${t.subject}</span>`:''}
          </div>
          ${(startStr||endStr)?`<div class="task-time-range ${isOverdue?'overdue':''}">
            <i data-lucide="${isOverdue?'alert-circle':'clock'}" style="width:11px;height:11px"></i>
            ${startStr?'Start: '+startStr:''}${startStr&&endStr?' → ':''}${endStr?'End: '+endStr:''}
          </div>`:''}
          ${t.notes?`<div class="task-notes-txt">${t.notes}</div>`:''}
        </div>
        <div class="task-actions">
          <button class="task-act-btn" onclick="openEditTaskModal('${t.id}')" title="Edit"><i data-lucide="pencil" style="width:13px;height:13px"></i></button>
          <button class="task-act-btn del" onclick="deleteTask('${t.id}')" title="Delete"><i data-lucide="trash-2" style="width:13px;height:13px"></i></button>
        </div>
      </div>`;
    }
    html+='</div>';
  }
  container.innerHTML=html;
  refreshIcons();
}

/* ── Mini task calendar ──────────────────────────────── */
function taskCalPrev(){
  taskCalMonth.m--;
  if(taskCalMonth.m<0){taskCalMonth.m=11;taskCalMonth.y--;}
  renderTaskCalendar();
}
function taskCalNext(){
  taskCalMonth.m++;
  if(taskCalMonth.m>11){taskCalMonth.m=0;taskCalMonth.y++;}
  renderTaskCalendar();
}
function renderTaskCalendar(){
  const {y,m}=taskCalMonth;
  document.getElementById('task-cal-title').textContent=`${MONTH_NAMES[m].slice(0,3)} ${y}`;
  const fd=new Date(y,m,1).getDay(),dim=new Date(y,m+1,0).getDate();
  const todayFull=todayStr();
  const prefix=`${y}-${String(m+1).padStart(2,'0')}-`;

  // Build a map: dateStr → tasks with start or end on that day
  const tasksByDate={};
  allTasks.forEach(t=>{
    const checkDates=[];
    if(t.start_datetime) checkDates.push(t.start_datetime.slice(0,10));
    if(t.end_datetime)   checkDates.push(t.end_datetime.slice(0,10));
    // also add a plain due_date if exists (legacy)
    if(t.due_date) checkDates.push(t.due_date);
    [...new Set(checkDates)].forEach(ds=>{
      if(!tasksByDate[ds]) tasksByDate[ds]=[];
      if(!tasksByDate[ds].find(x=>x.id===t.id)) tasksByDate[ds].push(t);
    });
  });

  const grid=document.getElementById('task-cal-grid');
  let html='';
  for(let i=0;i<fd;i++) html+='<div></div>';
  for(let d=1;d<=dim;d++){
    const ds=prefix+String(d).padStart(2,'0');
    const dayTasks=tasksByDate[ds]||[];
    const isT=ds===todayFull;
    const hasTasks=dayTasks.length>0;
    let tip='';
    if(hasTasks){
      const lines=dayTasks.map(t=>{
        const icon=t.done?'✓':'•';
        const subj=t.subject?` [${t.subject}]`:'';
        return `${icon} ${t.title}${subj}`;
      }).join('\n');
      tip=`<span class="mcd-tip">${lines.replace(/</g,'&lt;')}</span>`;
    }
    html+=`<div class="mcd${hasTasks?' has-task':''}${isT?' today':''}" title="">${d}${tip}</div>`;
  }
  grid.innerHTML=html;
  refreshIcons();
}

/* ── Timer ───────────────────────────────────────────── */
let timerInterval=null,timerRemaining=25*60,timerTotal=25*60,timerRunning=false;
let timerMode='focus',timerStartWall=null,timerEndWall=null;
const CIRCUMFERENCE=2*Math.PI*96;
document.getElementById('ring-progress').style.strokeDasharray=CIRCUMFERENCE;
document.getElementById('ring-progress').style.strokeDashoffset=0;
function setMode(mode,mins){
  if(timerRunning){if(!confirm('Reset the running timer?'))return;}
  timerMode=mode;
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById(`mode-${mode}`).classList.add('active');
  setTimerDuration(mins*60);
}
function setTimerDuration(secs){
  clearInterval(timerInterval); timerRunning=false;
  timerRemaining=timerTotal=secs;
  document.getElementById('timer-action-btn').textContent='Start';
  document.getElementById('timer-save-area').style.display='none';
  document.getElementById('timer-label').textContent=timerMode.toUpperCase();
  updateTimerDisplay();
}
function showCustomTimer(){document.getElementById('timer-custom-wrap').style.display='block';}
function applyCustomTimer(){
  const mins=parseInt(document.getElementById('custom-mins').value);
  if(!mins||mins<1){toast('Enter a valid duration',true);return;}
  timerMode='custom';
  document.querySelectorAll('.mode-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('mode-custom').classList.add('active');
  document.getElementById('timer-custom-wrap').style.display='none';
  setTimerDuration(mins*60);
}
function timerAction(){
  if(timerRunning){
    clearInterval(timerInterval); timerRunning=false;
    document.getElementById('timer-action-btn').textContent='Resume';
  } else {
    if(timerRemaining<=0)return;
    if(!timerStartWall)timerStartWall=new Date();
    timerRunning=true;
    document.getElementById('timer-action-btn').textContent='Pause';
    timerInterval=setInterval(tickTimer,1000);
  }
}
function tickTimer(){
  timerRemaining--;updateTimerDisplay();
  if(timerRemaining<=0){clearInterval(timerInterval);timerRunning=false;timerEndWall=new Date();onTimerDone();}
}
function updateTimerDisplay(){
  const m=Math.floor(timerRemaining/60),s=timerRemaining%60;
  document.getElementById('timer-display').textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  document.getElementById('ring-progress').style.strokeDashoffset=CIRCUMFERENCE*(1-timerRemaining/timerTotal);
}
function resetTimer(){
  clearInterval(timerInterval);timerRunning=false;timerStartWall=null;timerEndWall=null;
  document.getElementById('timer-action-btn').textContent='Start';
  document.getElementById('timer-save-area').style.display='none';
  timerRemaining=timerTotal;updateTimerDisplay();
}
function onTimerDone(){
  try{document.getElementById('timer-done-sfx').play();}catch(e){}
  document.getElementById('timer-label').textContent='DONE!';
  if(timerMode==='focus'||timerMode==='custom'){
    document.getElementById('timer-save-area').style.display='block';
    updateSubjectDropdowns();
    if(timerMode==='focus'){pomodoroCount++;document.getElementById('pomodoro-count').textContent=pomodoroCount;}
  }
  toast('Timer complete! 🎉');
}
async function saveTimerSession(){
  const subj=document.getElementById('t-subj').value;
  const cat=document.getElementById('t-cat').value;
  const notes=document.getElementById('t-notes').value.trim();
  if(!subj){toast('Pick a subject',true);return;}
  const start=timerStartWall||new Date(Date.now()-timerTotal*1000);
  const end=timerEndWall||new Date();
  const fmt=d=>`${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  const ok=await logSession({date:todayStr(),subj,start:fmt(start),end:fmt(end),cat,notes});
  if(ok){dismissTimerSave();resetTimer();}
}
function dismissTimerSave(){
  document.getElementById('timer-save-area').style.display='none';
  document.getElementById('t-notes').value='';
  timerStartWall=null;timerEndWall=null;
}

/* ── Duration preview ────────────────────────────────── */
function updateDurPreview(){
  const s=document.getElementById('l-start').value,e=document.getElementById('l-end').value,el=document.getElementById('dur-p');
  if(s&&e){const d=t2m(e)-t2m(s);el.textContent=d>0?`Duration: ${fmtD(d)}`:'End must be after start';el.className='dur-preview'+(d>0?' has':'');}
  else{el.textContent='Enter start and end times to preview duration';el.className='dur-preview';}
}

/* ── Achievements ────────────────────────────────────── */
const BADGES=[
  {id:'first',icon:'🎯',name:'First Step',desc:'Log your first study session.',check:s=>s.length>=1},
  {id:'streak7',icon:'🔥',name:'7-Day Streak',desc:'Study 7 days in a row.',check:(_,streak)=>streak>=7},
  {id:'hours10',icon:'⏰',name:'10 Hours In',desc:'Accumulate 10 total study hours.',check:s=>s.reduce((a,x)=>a+x.duration,0)>=600},
  {id:'warrior',icon:'⚔️',name:'Weekend Warrior',desc:'Log sessions on both Saturday and Sunday.',check:s=>{const wd=new Set(s.map(x=>new Date(x.date+'T00:00').getDay()));return wd.has(0)&&wd.has(6);}},
  {id:'owl',icon:'🦉',name:'Night Owl',desc:'Log a session starting after 10 PM.',check:s=>s.some(x=>x.start_time&&parseInt(x.start_time.split(':')[0])>=22)},
  {id:'hours50',icon:'🏆',name:'50 Hours Strong',desc:'Accumulate 50 total study hours.',check:s=>s.reduce((a,x)=>a+x.duration,0)>=3000},
  {id:'sub5',icon:'📚',name:'Multi-Tasker',desc:'Study 5 different subjects.',check:s=>new Set(s.map(x=>x.subject)).size>=5},
  {id:'month30',icon:'📅',name:'Consistent',desc:'Study on 30 different days.',check:s=>new Set(s.map(x=>x.date)).size>=30},
];
async function checkAchievements(){
  const {data:existing}=await sb.from('achievements').select('badge_id').eq('user_id',currentUser.id);
  const earned=new Set((existing||[]).map(r=>r.badge_id));
  const streak=calcStreak();
  const toUnlock=BADGES.filter(b=>!earned.has(b.id)&&b.check(allSessions,streak));
  for(const b of toUnlock){
    await sb.from('achievements').insert({user_id:currentUser.id,badge_id:b.id,unlocked_at:new Date().toISOString()});
    toast(`🏅 Badge unlocked: ${b.name}!`);
  }
}
async function renderAchievements(){
  const {data:earned}=await sb.from('achievements').select('*').eq('user_id',currentUser.id);
  const earnedMap={};
  (earned||[]).forEach(r=>earnedMap[r.badge_id]=r.unlocked_at);
  const streak=calcStreak();
  document.getElementById('badges-grid').innerHTML=BADGES.map(b=>{
    const unlocked=earnedMap[b.id]||b.check(allSessions,streak);
    const date=earnedMap[b.id]?new Date(earnedMap[b.id]).toLocaleDateString():'';
    return `<div class="badge-card ${unlocked?'unlocked':'locked'}">
      <span class="badge-icon">${b.icon}</span>
      <div class="badge-name">${b.name}</div>
      <div class="badge-desc">${b.desc}</div>
      ${date?`<div class="badge-unlocked-at">Unlocked ${date}</div>`:''}
    </div>`;
  }).join('');
}

/* ── Theme / Modals / Nav ────────────────────────────── */
function applyTheme(t){document.documentElement.setAttribute('data-theme',t);}
function openModal(id){document.getElementById(id).classList.add('open');refreshIcons();}
function closeModal(id){document.getElementById(id).classList.remove('open');}
function toggleSidebar(){document.getElementById('sidebar').classList.toggle('open');document.getElementById('overlay').classList.toggle('open');}
function closeSidebar(){document.getElementById('sidebar').classList.remove('open');document.getElementById('overlay').classList.remove('open');}

/* ── Tab routing ─────────────────────────────────────── */
let activeTab='dashboard';
function switchTab(tab){
  document.querySelectorAll('.tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.getElementById('tab-'+tab).classList.add('active');
  activeTab=tab; closeSidebar();
  if(tab==='dashboard')    renderDashboard();
  if(tab==='sessions')     renderSessions();
  if(tab==='weekly')       renderWeekly();
  if(tab==='monthly')      renderMonthly();
  if(tab==='achievements') renderAchievements();
  if(tab==='tasks'){       renderTasks(); renderTaskCalendar(); }
}
function refreshCurrentTab(){
  if(activeTab==='dashboard')    renderDashboard();
  if(activeTab==='sessions')     renderSessions();
  if(activeTab==='weekly')       renderWeekly();
  if(activeTab==='monthly')      renderMonthly();
  if(activeTab==='achievements') renderAchievements();
  if(activeTab==='tasks'){       renderTasks(); renderTaskCalendar(); }
}

document.querySelectorAll('.nb').forEach(b=>b.addEventListener('click',()=>switchTab(b.dataset.tab)));
document.getElementById('l-start').addEventListener('change',updateDurPreview);
document.getElementById('l-end').addEventListener('change',updateDurPreview);
document.getElementById('new-subject-input').addEventListener('keydown',e=>{if(e.key==='Enter')addSubject();});
document.getElementById('new-task-subject-input').addEventListener('keydown',e=>{if(e.key==='Enter')addTaskSubject();});
document.getElementById('task-title-input').addEventListener('keydown',e=>{if(e.key==='Enter')addTask();});

/* ── Boot ────────────────────────────────────────────── */
(async()=>{
  const {data:{session}}=await sb.auth.getSession();
  const urlParams=new URLSearchParams(window.location.search);
  const hashParams=new URLSearchParams(window.location.hash.substring(1));
  const isConfirm=urlParams.get('type')==='signup'||hashParams.get('type')==='signup'||window.location.hash.includes('type=signup');
  if(isConfirm){
    await sb.auth.signOut();
    currentUser=null;
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-screen').style.display='flex';
    showPanel('login');
    authMsg('Email confirmed! Please log in to continue.','ok');
    window.history.replaceState({},document.title,window.location.pathname);
    return;
  }
  if(session?.user) initApp(session.user);
})();
