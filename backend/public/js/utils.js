function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
}

function parseOptions(options) {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  try { const parsed = JSON.parse(options); return Array.isArray(parsed) ? parsed : []; }
  catch { return []; }
}

async function loadGradesForNav() {
  try {
    window.state.grades = await api.getGrades();
    renderGradeCardsNav();
  } catch (e) { console.error('加载年级失败:', e); }
}

function renderGradeCardsNav() {
  const container = document.getElementById('grade-cards');
  if (!container) return;
  const emojis = { low: '🌱', middle: '🌿', high: '🌳' };
  const filtered = window.state.grades.filter(g => {
    if (window.state.userRole === 'admin') return true;
    return window.state.allowedGrades.includes(g.level);
  });
  if (filtered.length === 0) {
    container.innerHTML = '<div class="no-grade-message"><div class="no-grade-icon">🔒</div><div class="no-grade-text">你没有权限访问任何年级的试题</div></div>';
    return;
  }
  container.innerHTML = filtered.map(g => `
    <div class="grade-card" onclick="selectGrade(${g.id})">
      <div class="emoji">${emojis[g.level] || '📖'}</div>
      <div class="grade-name">${g.name}</div>
      <div class="grade-info">点击选择试卷</div>
    </div>
  `).join('');
}

async function loadAllHistory() {
  try {
    const data = await api.getAllExamHistory();
    renderHistoryList(data || []);
  } catch (e) { console.error('加载考试历史失败:', e); showEmptyState(); }
}

function renderHistoryList(records) {
  const listContainer = document.getElementById('history-list');
  const summaryContainer = document.getElementById('history-summary');
  const emptyContainer = document.getElementById('history-empty');
  if (!records || records.length === 0) { showEmptyState(); return; }
  if (summaryContainer) summaryContainer.style.display = 'block';
  if (emptyContainer) emptyContainer.style.display = 'none';
  updateSummary(records);
  const sorted = [...records].sort((a, b) => new Date(b.start_time || b.created_at) - new Date(a.start_time || a.created_at));
  if (listContainer) listContainer.innerHTML = sorted.map(r => {
    const score = r.total_score || 0, acc = r.accuracy || 0;
    const date = new Date(r.start_time || r.created_at);
    const ds = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;
    let cls = acc >= 90 ? 'excellent' : acc >= 70 ? 'good' : acc >= 60 ? 'normal' : 'poor';
    return `<div class="history-item" onclick="showExamDetails(${r.id})"><div class="history-score-badge ${cls}">${score}</div><div class="history-info"><div class="history-name">${r.user_name||'未知用户'}</div><div class="history-meta"><span>年级: ${r.grade_name||'-'}</span><span>正确率: ${acc}%</span></div></div><div class="history-date">${ds}</div><div class="history-arrow">›</div></div>`;
  }).join('');
}

function updateSummary(records) {
  const scores = records.map(r => r.total_score || 0);
  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('summary-total', records.length);
  el('summary-best', scores.length ? Math.max(...scores) : 0);
  el('summary-average', scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : 0);
  const accs = records.map(r => r.accuracy || 0);
  el('summary-accuracy', accs.length ? Math.round(accs.reduce((a,b)=>a+b,0)/accs.length)+'%' : '0%');
}

function showEmptyState() {
  const c = document.getElementById('history-list'), s = document.getElementById('history-summary'), e = document.getElementById('history-empty');
  if (c) c.innerHTML = ''; if (s) s.style.display = 'none'; if (e) e.style.display = 'block';
}

async function loadRedeemRecords() {
  try {
    const records = await api.getAllLotteryRecords();
    updateRedeemSummary(records);
    renderRedeemRecords(records);
  } catch (e) { console.error(e); const c = document.getElementById('redeem-records-list'); if (c) c.innerHTML = '<p style="text-align:center;color:white;padding:40px">加载失败</p>'; }
}

function updateRedeemSummary(records) {
  const el = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  el('redeem-total', records.length);
  el('redeem-unclaimed', records.filter(r => !r.is_redeemed).length);
  el('redeem-claimed', records.filter(r => r.is_redeemed).length);
}

function renderRedeemRecords(records) {
  const c = document.getElementById('redeem-records-list');
  if (!c) return;
  if (!records || !records.length) { c.innerHTML = '<p style="text-align:center;color:white;padding:40px">暂无记录</p>'; return; }
  c.innerHTML = records.map(r => {
    const d = new Date(r.created_at), ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    const cls = r.is_redeemed ? '' : 'unclaimed';
    return `<div class="redeem-record-item"><div class="redeem-prize-emoji">${r.prize_emoji||'🎁'}</div><div class="redeem-record-info"><div class="redeem-prize-name">${r.prize_name}</div><div class="redeem-record-meta"><span>获奖者: ${r.user_name}</span><span>得分: ${r.total_score||0}分</span><span>时间: ${ds}</span></div></div><label class="redeem-label ${cls}" onclick="toggleRedeem(${r.id},${!r.is_redeemed})"><input type="checkbox" class="redeem-checkbox" ${r.is_redeemed?'checked':''}>${r.is_redeemed?'已兑现':'未兑现'}</label></div>`;
  }).join('');
}

async function loadUsers() {
  try {
    const data = await api.getAllUsers();
    renderUsersList(data);
  } catch (e) { console.error(e); showUsersEmpty(); }
}

function renderUsersList(users) {
  const container = document.getElementById('users-list');
  const emptyContainer = document.getElementById('users-empty');
  if (!container) return;
  if (!users || !users.length) { showUsersEmpty(); return; }
  if (emptyContainer) emptyContainer.style.display = 'none';
  const gm = { low:'低年级', middle:'中年级', high:'高年级' };
  container.innerHTML = users.map(u => `
    <div class="user-card">
      <div class="user-info-left"><div class="user-icon">${u.username.charAt(0)}</div><div class="user-details"><div class="user-name-text">${u.username}</div><span class="user-role-badge ${u.role}">${u.role==='admin'?'管理员':'考生'}</span><div class="user-allowed-grades">允许访问: ${(u.allowed_grades||[]).map(g=>gm[g]||g).join(', ')}</div></div></div>
      <div class="user-actions"><button class="user-action-btn edit" onclick="showEditUserModal(${u.id},'${u.username}','${u.role}','[${(u.allowed_grades||[]).join(',')}]')">编辑</button><button class="user-action-btn delete" onclick="deleteUser(${u.id},'${u.username}')">删除</button></div>
    </div>
  `).join('');
}

function showUsersEmpty() {
  const c = document.getElementById('users-list'), e = document.getElementById('users-empty');
  if (c) c.innerHTML = ''; if (e) e.style.display = 'block';
}

async function loadWrongAnswersForNav() {
  try {
    const data = await api.getWrongAnswers(window.state.userName);
    renderWrongAnswersNav(data.data || data, data.total || (data.data||data).length);
  } catch (e) { console.error(e); showWrongAnswersEmptyNav(); }
}

function renderWrongAnswersNav(wrongAnswers, total) {
  const c = document.getElementById('wrong-answers-list'), e = document.getElementById('wrong-answers-empty'), badge = document.getElementById('wrong-answers-count');
  if (!c) return;
  if (!wrongAnswers || !wrongAnswers.length) { showWrongAnswersEmptyNav(); if (badge) badge.textContent='0'; return; }
  if (e) e.style.display='none'; if (badge) badge.textContent=total;
  c.innerHTML = wrongAnswers.map(item => {
    const d = new Date(item.created_at), ds = `${d.getMonth()+1}月${d.getDate()}日`;
    return `<div class="wrong-answer-item"><div class="wrong-answer-content"><div class="wrong-answer-meta"><span class="tag tag-type">${item.type_name}</span><span class="tag tag-points">${item.points}分</span><span class="tag tag-date">${ds}</span></div><div class="wrong-answer-text">${item.content}</div><div class="answer-compare"><span class="user-answer"><span class="label">你的答案：</span><span class="value wrong">${item.user_answer||'未作答'}</span></span><span class="correct-answer"><span class="label">正确答案：</span><span class="value correct">${item.correct_answer}</span></span></div></div><div class="wrong-answer-actions"><button class="btn-sm btn-delete" onclick="deleteWrongAnswer(${item.id})">删除</button></div></div>`;
  }).join('');
}

function showWrongAnswersEmptyNav() {
  const c = document.getElementById('wrong-answers-list'), e = document.getElementById('wrong-answers-empty'), b = document.getElementById('wrong-answers-count');
  if (c) c.innerHTML=''; if (e) e.style.display='block'; if (b) b.textContent='0';
}

async function loadManageDataForNav() {
  try {
    [window.state.grades, window.state.types] = await Promise.all([api.getGrades(), api.getTypes()]);
    const gs = document.getElementById('filter-grade'), ts = document.getElementById('filter-type');
    if (gs) gs.innerHTML = '<option value="">全部年级</option>' + window.state.grades.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
    if (ts) ts.innerHTML = '<option value="">全部题型</option>' + window.state.types.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
    loadQuestionsForNav();
  } catch (e) { showToast(e.message, 'error'); }
}

async function loadQuestionsForNav() {
  const gradeId = document.getElementById('filter-grade')?.value;
  const typeId = document.getElementById('filter-type')?.value;
  try {
    const params = {};
    if (gradeId) params.grade_id = gradeId;
    if (typeId) params.type_id = typeId;
    const data = await api.getQuestions(params);
    renderQuestionsForNav(data);
  } catch (e) { console.error('加载题目失败:', e); }
}

function renderQuestionsForNav(questions) {
  const c = document.getElementById('questions-list');
  if (!c) return;
  if (!questions || !questions.length) { c.innerHTML='<div class="empty-state" style="display:block"><div class="empty-icon">📝</div><div class="empty-title">暂无题目</div><div class="empty-desc">请通过导入功能添加题目</div></div>'; return; }
  c.innerHTML = questions.map(q => {
    const g = window.state.grades.find(x => x.id === q.grade_id), t = window.state.types.find(x => x.id === q.type_id);
    return `<div class="question-item"><div class="question-item-content"><div class="question-item-meta"><span class="tag tag-grade">${g?g.name:'-'}</span><span class="tag tag-type">${t?t.name:'-'}</span><span class="tag tag-points">${q.points}分</span></div><div class="question-item-text">${q.content}</div></div><div class="question-item-actions"><button class="btn-sm btn-delete" onclick="deleteQuestion(${q.id})">删除</button></div></div>`;
  }).join('');
}

function navigateTo(page) {
  if (!window.state.userName && page !== 'welcome') {
    if (page === 'home') { showToast('请先登录','error'); document.querySelectorAll('.page').forEach(p=>p.classList.remove('active')); const w=document.getElementById('page-welcome');if(w)w.classList.add('active'); return; }
    showToast('请先登录','error'); return;
  }
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  if (page === 'welcome') { const w=document.getElementById('page-welcome');if(w)w.classList.add('active'); }
  else { const t=document.getElementById(`page-${page}`);if(t)t.classList.add('active'); }

  if (page === 'home') { loadGradesForNav(); if (typeof stopTimer === 'function') stopTimer(); }
  else if (page === 'manage') loadManageDataForNav();
  else if (page === 'history') loadAllHistory();
  else if (page === 'lottery-history') { if (typeof loadLotteryRecords === 'function') loadLotteryRecords(); }
  else if (page === 'redeem-manage') { if (window.state.userRole === 'admin') loadRedeemRecords(); else { showToast('只有管理员可以访问兑现管理','error'); navigateTo('home'); } }
  else if (page === 'users') { if (window.state.userRole === 'admin') loadUsers(); else { showToast('只有管理员可以访问用户管理','error'); navigateTo('home'); } }
  else if (page === 'wrong-answers') loadWrongAnswersForNav();
}

function logout() {
  window.state.userName = ''; window.state.lastExamRecord = null; window.state.userRole = '';
  const ui = document.getElementById('user-info'), un = document.getElementById('user-name'), ur = document.getElementById('user-role');
  const ab = document.getElementById('admin-nav-btn'), mb = document.getElementById('manage-nav-btn'), rb = document.getElementById('redeem-manage-nav-btn'), lb = document.getElementById('login-btn-container');
  if (ui) ui.style.display='none'; if (un) un.textContent=''; if (ur) ur.textContent='';
  if (ab) ab.style.display='none'; if (mb) mb.style.display='none'; if (rb) rb.style.display='none'; if (lb) lb.style.display='flex';
  const wn = document.getElementById('welcome-name'); if (wn) wn.value='';
  const s3=document.getElementById('welcome-step-3'), s2=document.getElementById('welcome-step-2'), s1=document.getElementById('welcome-step-1');
  if(s3)s3.style.display='none'; if(s2)s2.style.display='none'; if(s1)s1.style.display='block';
  navigateTo('welcome');
}

function showUserInfo() {
  const ui = document.getElementById('user-info'), un = document.getElementById('user-name'), ur = document.getElementById('user-role');
  const ab = document.getElementById('admin-nav-btn'), mb = document.getElementById('manage-nav-btn'), rb = document.getElementById('redeem-manage-nav-btn'), lb = document.getElementById('login-btn-container');
  if (window.state.userName && un && ur) {
    un.textContent = window.state.userName; ur.textContent = window.state.userRole === 'admin'?'管理员':'考生';
    ur.style.background = window.state.userRole === 'admin'?'rgba(239,68,68,0.8)':'rgba(16,185,129,0.8)';
    if (ui) ui.style.display='flex'; if (lb) lb.style.display='none';
    if (ab) ab.style.display=window.state.userRole==='admin'?'block':'none';
    if (mb) mb.style.display=(window.state.userName==='张伟'||window.state.userRole==='admin')?'block':'none';
    if (rb) rb.style.display=window.state.userRole==='admin'?'block':'none';
  }
}

window.showToast = showToast;
window.formatDate = formatDate;
window.formatTime = formatTime;
window.parseOptions = parseOptions;
window.loadGradesForNav = loadGradesForNav;
window.loadAllHistory = loadAllHistory;
window.loadRedeemRecords = loadRedeemRecords;
window.loadUsers = loadUsers;
window.loadWrongAnswersForNav = loadWrongAnswersForNav;
window.loadManageDataForNav = loadManageDataForNav;
window.loadQuestionsForNav = loadQuestionsForNav;
window.navigateTo = navigateTo;
window.logout = logout;
window.showUserInfo = showUserInfo;
