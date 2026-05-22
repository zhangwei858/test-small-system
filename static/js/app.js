let state = {
  grades: [],
  types: [],
  exam: null,
  questions: [],
  currentIndex: 0,
  answers: {},
  timerInterval: null,
  timeLeft: 1800,
  submitted: {},
  userName: '',
  lastExamRecord: null,
  userRole: 'examiner',
  allowedGrades: ['low', 'middle', 'high']
};

const photoMap = {
  '张洛晗': 'images/张洛晗.jpg',
  '张洛琳': 'images/张洛琳.jpg'
};

async function submitName() {
  const name = document.getElementById('welcome-name').value.trim();
  if (!name) {
    showToast('请先输入你的名字', 'error');
    document.getElementById('welcome-name').focus();
    return;
  }

  try {
    const user = await api.login(name);
    state.userName = user.username;
    state.userRole = user.role;
    state.allowedGrades = user.allowed_grades || ['low', 'middle', 'high'];
  } catch (e) {
    console.error('登录失败:', e);
    state.userName = name;
    state.userRole = 'examiner';
    state.allowedGrades = ['low', 'middle', 'high'];
  }

  if (state.userName === '张伟') {
    showUserInfo();
    navigateTo('manage');
    return;
  }
  
  showUserInfo();
  document.getElementById('student-name').textContent = state.userName;
  
  const photoPath = photoMap[state.userName] || null;
  if (photoPath) {
    const img = document.getElementById('student-photo');
    img.src = photoPath;
    img.onload = function() {
      document.getElementById('photo-placeholder').style.display = 'none';
    };
    img.onerror = function() {
      document.getElementById('photo-placeholder').style.display = 'flex';
    };
  } else {
    document.getElementById('photo-placeholder').style.display = 'flex';
    document.getElementById('student-photo').src = '';
  }

  try {
    const history = await api.getExamHistory(name);
    if (history && history.length > 0) {
      const latest = history.reduce((prev, curr) => 
        new Date(curr.created_at) > new Date(prev.created_at) ? curr : prev
      );
      state.lastExamRecord = latest;
    } else {
      state.lastExamRecord = null;
    }
  } catch (e) {
    console.error('查询历史成绩失败:', e);
    state.lastExamRecord = null;
  }

  document.getElementById('welcome-step-1').style.display = 'none';
  
  const autoGradeMap = {
    '张洛琳': 2,
    '张洛晗': 1
  };
  
  if (autoGradeMap[state.userName]) {
    startExamPreparation();
  } else {
    document.getElementById('welcome-step-2').style.display = 'block';
    startCeremonyAnimation();
  }
}

function startCeremonyAnimation() {
  const steps = [
    { text: '正在确认身份...', progress: 33 },
    { text: '正在准备考试环境...', progress: 66 },
    { text: '欢迎仪式准备完成！', progress: 100 }
  ];

  let currentStep = 0;
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const welcomeTitle = document.getElementById('welcome-title');

  function animateStep() {
    if (currentStep < steps.length) {
      progressText.textContent = steps[currentStep].text;
      
      let startProgress = currentStep > 0 ? steps[currentStep - 1].progress : 0;
      let endProgress = steps[currentStep].progress;
      let currentProgress = startProgress;
      const duration = 800;
      const startTime = Date.now();

      function updateProgress() {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        currentProgress = startProgress + (endProgress - startProgress) * progress;
        progressFill.style.width = currentProgress + '%';

        if (progress < 1) {
          requestAnimationFrame(updateProgress);
        } else {
          currentStep++;
          setTimeout(animateStep, 500);
        }
      }
      updateProgress();
    } else {
      setTimeout(() => {
        document.getElementById('welcome-step-2').style.display = 'none';
        document.getElementById('welcome-step-3').style.display = 'block';
        document.getElementById('welcome-greeting').textContent = `欢迎你，${state.userName}！`;
        startReadyTimer();
      }, 800);
    }
  }

  animateStep();
}

function startReadyTimer() {
  const historyScoreDiv = document.getElementById('history-score');
  const newStartDiv = document.getElementById('new-start');
  const historyScoreValue = document.getElementById('history-score-value');
  const historyInfo = document.getElementById('history-info');
  const encouragementText = document.getElementById('encouragement-text');

  if (state.lastExamRecord) {
    historyScoreDiv.style.display = 'block';
    newStartDiv.style.display = 'none';
    
    const score = state.lastExamRecord.total_score || 0;
    const gradeName = state.lastExamRecord.grade_name || '';
    const correctCount = state.lastExamRecord.correct_count || 0;
    const totalQuestions = state.lastExamRecord.total_questions || 1;
    const accuracy = Math.round((correctCount / totalQuestions) * 100);
    
    let dateStr = '未知';
    if (state.lastExamRecord.created_at || state.lastExamRecord.start_time) {
      const date = new Date(state.lastExamRecord.created_at || state.lastExamRecord.start_time);
      if (!isNaN(date.getTime())) {
        dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
      }
    }
    
    historyScoreValue.textContent = `${score}分`;
    historyInfo.innerHTML = `正确率: ${accuracy}%<br/>年级: ${gradeName}<br/>时间: ${dateStr}`;
    
    const encouragementMessages = [
      `上次考了 ${score} 分，这次一定能突破！💪`,
      `目标：超过 ${score} 分！相信你可以！🔥`,
      `${score} 分是你的起点，这次更高！🚀`,
      `超越自我，打破 ${score} 分记录！🎯`
    ];
    const randomMsg = encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
    encouragementText.textContent = randomMsg;
  } else {
    historyScoreDiv.style.display = 'none';
    newStartDiv.style.display = 'block';
  }

  let count = 3;
  const timerElement = document.getElementById('ready-timer');
  
  const timerInterval = setInterval(() => {
    count--;
    timerElement.textContent = count;
    
    if (count <= 0) {
      clearInterval(timerInterval);
      timerElement.style.display = 'none';
    }
  }, 1000);
}

async function startExamPreparation() {
  document.getElementById('welcome-step-3').style.display = 'none';
  showUserInfo();
  
  const autoGradeMap = {
    '张洛琳': 2,
    '张洛晗': 1
  };
  
  const autoGradeId = autoGradeMap[state.userName];
  
  if (autoGradeId) {
    try {
      const [papers, types] = await Promise.all([api.getPapers(), api.getTypes()]);
      const gradePapers = papers.filter(p => p.grade_id === autoGradeId);
      
      if (gradePapers.length === 0) {
        showToast('该年级暂无试卷', 'error');
        navigateTo('home');
        return;
      }

      state.selectedGradeId = autoGradeId;
      state.grades = await api.getGrades();
      state.types = types;
      state.selectedTypeIds = [];
      renderTypeCheckboxes(types);
      renderPaperCards(gradePapers);
      navigateTo('papers');
    } catch (e) {
      console.error('自动选择年级失败:', e);
      navigateTo('home');
    }
  } else {
    navigateTo('home');
  }
}

function showUserInfo() {
  const userInfo = document.getElementById('user-info');
  const userName = document.getElementById('user-name');
  const userRole = document.getElementById('user-role');
  const adminNavBtn = document.getElementById('admin-nav-btn');
  
  if (state.userName) {
    userName.textContent = state.userName;
    userRole.textContent = state.userRole === 'admin' ? '管理员' : '考生';
    userRole.style.background = state.userRole === 'admin' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(16, 185, 129, 0.8)';
    userInfo.style.display = 'flex';
    
    adminNavBtn.style.display = state.userRole === 'admin' ? 'block' : 'none';
  }
}

function logout() {
  state.userName = '';
  state.lastExamRecord = null;
  state.userRole = '';
  
  document.getElementById('user-info').style.display = 'none';
  document.getElementById('user-name').textContent = '';
  document.getElementById('user-role').textContent = '';
  document.getElementById('admin-nav-btn').style.display = 'none';
  document.getElementById('welcome-name').value = '';
  
  document.getElementById('welcome-step-3').style.display = 'none';
  document.getElementById('welcome-step-2').style.display = 'none';
  document.getElementById('welcome-step-1').style.display = 'block';
  
  navigateTo('welcome');
}

function navigateTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  
  if (page === 'welcome') {
    document.getElementById('page-welcome').classList.add('active');
  } else {
    document.getElementById(`page-${page}`).classList.add('active');
  }

  if (page === 'home') {
    loadGrades();
    stopTimer();
  } else if (page === 'manage') {
    loadManageData();
  } else if (page === 'history') {
    loadAllHistory();
  } else if (page === 'lottery-history') {
    loadLotteryRecords();
  } else if (page === 'redeem-manage') {
    loadRedeemRecords();
  } else if (page === 'wrong-answers') {
    loadWrongAnswers();
  } else if (page === 'users') {
    if (state.userRole === 'admin') {
      loadUsers();
    } else {
      showToast('只有管理员可以访问用户管理', 'error');
      navigateTo('home');
    }
  }
}

async function loadUsers() {
  try {
    const data = await api.getAllUsers();
    renderUsersList(data);
  } catch (e) {
    console.error('加载用户列表失败:', e);
    showUsersEmpty();
  }
}

function renderUsersList(users) {
  const container = document.getElementById('users-list');
  const emptyContainer = document.getElementById('users-empty');

  if (!users || users.length === 0) {
    showUsersEmpty();
    return;
  }

  emptyContainer.style.display = 'none';

  const gradeLevelMap = {
    'low': '低年级',
    'middle': '中年级',
    'high': '高年级'
  };

  container.innerHTML = users.map(user => {
    const initial = user.username.charAt(0);
    const allowedGradesText = user.allowed_grades 
      ? user.allowed_grades.map(g => gradeLevelMap[g] || g).join(', ')
      : '全部年级';

    return `
      <div class="user-card">
        <div class="user-info-left">
          <div class="user-icon">${initial}</div>
          <div class="user-details">
            <div class="user-name-text">${user.username}</div>
            <span class="user-role-badge ${user.role}">${user.role === 'admin' ? '管理员' : '考生'}</span>
            <div class="user-allowed-grades">允许访问: ${allowedGradesText}</div>
          </div>
        </div>
        <div class="user-actions">
          <button class="user-action-btn edit" onclick="showEditUserModal(${user.id}, '${user.username}', '${user.role}', '[${user.allowed_grades.join(',')}]')">编辑</button>
          <button class="user-action-btn delete" onclick="deleteUser(${user.id}, '${user.username}')">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function showUsersEmpty() {
  document.getElementById('users-list').innerHTML = '';
  document.getElementById('users-empty').style.display = 'block';
}

function showAddUserModal() {
  const modal = `
    <div class="confirm-overlay" id="user-modal" style="display:flex">
      <div class="confirm-dialog" style="max-width: 480px;">
        <div class="confirm-header">
          <h3>➕ 注册新用户</h3>
          <button class="confirm-close" onclick="hideUserModal()">✕</button>
        </div>
        <div class="confirm-body">
          <div class="form-group">
            <label>用户名</label>
            <input type="text" id="new-username" class="form-input" placeholder="请输入用户名">
          </div>
          <div class="form-group">
            <label>允许访问的年级</label>
            <div class="grade-checkboxes">
              <label><input type="checkbox" name="allowed-grade" value="low"> 低年级</label>
              <label><input type="checkbox" name="allowed-grade" value="middle"> 中年级</label>
              <label><input type="checkbox" name="allowed-grade" value="high"> 高年级</label>
            </div>
          </div>
        </div>
        <div class="confirm-actions">
          <button class="btn btn-secondary" onclick="hideUserModal()">取消</button>
          <button class="btn btn-primary" onclick="addUser()">确认注册</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modal);
}

function showEditUserModal(id, username, role, allowedGrades) {
  const grades = JSON.parse(allowedGrades);
  const modal = `
    <div class="confirm-overlay" id="user-modal" style="display:flex">
      <div class="confirm-dialog" style="max-width: 480px;">
        <div class="confirm-header">
          <h3>✏️ 编辑用户</h3>
          <button class="confirm-close" onclick="hideUserModal()">✕</button>
        </div>
        <div class="confirm-body">
          <div class="form-group">
            <label>用户名</label>
            <input type="text" id="edit-username" class="form-input" value="${username}" disabled>
            <input type="hidden" id="edit-user-id" value="${id}">
          </div>
          <div class="form-group">
            <label>允许访问的年级</label>
            <div class="grade-checkboxes">
              <label><input type="checkbox" name="allowed-grade" value="low" ${grades.includes('low') ? 'checked' : ''}> 低年级</label>
              <label><input type="checkbox" name="allowed-grade" value="middle" ${grades.includes('middle') ? 'checked' : ''}> 中年级</label>
              <label><input type="checkbox" name="allowed-grade" value="high" ${grades.includes('high') ? 'checked' : ''}> 高年级</label>
            </div>
          </div>
        </div>
        <div class="confirm-actions">
          <button class="btn btn-secondary" onclick="hideUserModal()">取消</button>
          <button class="btn btn-primary" onclick="updateUser()">保存修改</button>
        </div>
      </div>
    </div>
  `;
  document.body.insertAdjacentHTML('beforeend', modal);
}

function hideUserModal() {
  const modal = document.getElementById('user-modal');
  if (modal) modal.remove();
}

async function addUser() {
  const username = document.getElementById('new-username').value.trim();
  const checkboxes = document.querySelectorAll('input[name="allowed-grade"]:checked');
  const allowedGrades = Array.from(checkboxes).map(cb => cb.value);

  if (!username) {
    showToast('请输入用户名', 'error');
    return;
  }

  if (allowedGrades.length === 0) {
    showToast('请至少选择一个年级', 'error');
    return;
  }

  try {
    await api.registerExaminer(username, allowedGrades);
    showToast('注册成功', 'success');
    hideUserModal();
    loadUsers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function updateUser() {
  const id = document.getElementById('edit-user-id').value;
  const checkboxes = document.querySelectorAll('input[name="allowed-grade"]:checked');
  const allowedGrades = Array.from(checkboxes).map(cb => cb.value);

  if (allowedGrades.length === 0) {
    showToast('请至少选择一个年级', 'error');
    return;
  }

  try {
    await api.updateUser(id, 'examiner', allowedGrades);
    showToast('更新成功', 'success');
    hideUserModal();
    loadUsers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function deleteUser(id, username) {
  if (!confirm(`确定要删除用户 "${username}" 吗？`)) {
    return;
  }

  try {
    await api.deleteUser(id);
    showToast('删除成功', 'success');
    loadUsers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function loadAllHistory() {
  try {
    const response = await api.getAllExamHistory();
    const data = response.data || response;
    renderHistoryList(data);
  } catch (e) {
    console.error('加载考试历史失败:', e);
    showEmptyState();
  }
}

async function searchHistory() {
  const name = document.getElementById('history-name-input').value.trim();
  try {
    let response;
    if (name) {
      response = await api.getExamHistory(name);
    } else {
      response = await api.getAllExamHistory();
    }
    const data = response.data || response;
    renderHistoryList(data);
  } catch (e) {
    console.error('查询考试历史失败:', e);
    showEmptyState();
  }
}

async function showExamDetails(examId) {
  try {
    const response = await api.getExamDetails(examId);
    const { exam, answers, grouped_questions } = response.data || response;
    
    const wrongAnswers = answers.filter(a => !a.is_correct);
    
    let questionsHtml = '';
    for (const [type, questions] of Object.entries(grouped_questions)) {
      questionsHtml += `
        <div class="question-section">
          <h4>${type} (${questions.length} 题)</h4>
          ${questions.map((q, index) => `
            <div class="question-item ${q.is_correct ? 'correct' : 'wrong'}">
              <div class="question-header">
                <span class="question-num">第 ${index + 1} 题</span>
                <span class="question-status ${q.is_correct ? 'status-correct' : 'status-wrong'}">
                  ${q.is_correct ? '✓ 正确' : '✗ 错误'}
                </span>
              </div>
              <div class="question-text">${q.content}</div>
              <div class="question-options" style="display: ${q.options ? 'block' : 'none'}">
                ${q.options ? q.options.map((opt, idx) => `
                  <div class="option-item ${q.user_answer === opt.letter ? 'selected' : ''}">
                    ${opt.letter}. ${opt.content}
                  </div>
                `).join('') : ''}
              </div>
              <div class="answer-result">
                <span class="result-item">
                  <strong>你的答案:</strong> <span class="${q.is_correct ? 'text-correct' : 'text-wrong'}">${q.user_answer || '未作答'}</span>
                </span>
                <span class="result-item" style="display: ${q.is_correct ? 'none' : 'inline'}">
                  <strong>正确答案:</strong> <span class="text-correct">${q.answer}</span>
                </span>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }
    
    let modalContent = `
      <div class="modal-header">
        <h3>${exam.user_name} 的考试详情</h3>
        <button class="modal-close" onclick="closeModal()">×</button>
      </div>
      <div class="modal-body">
        <div class="exam-summary">
          <div class="summary-row">
            <span class="label">试卷:</span>
            <span>${exam.grade_name || '-'} 考试题</span>
          </div>
          <div class="summary-row">
            <span class="label">得分:</span>
            <span>${exam.total_score || 0} 分</span>
          </div>
          <div class="summary-row">
            <span class="label">正确率:</span>
            <span>${Math.round(((exam.correct_count || 0) / (exam.total_questions || 1)) * 100)}%</span>
          </div>
          <div class="summary-row">
            <span class="label">总题数:</span>
            <span>${exam.total_questions || 0}</span>
          </div>
          <div class="summary-row">
            <span class="label">正确数:</span>
            <span>${exam.correct_count || 0}</span>
          </div>
          <div class="summary-row">
            <span class="label">用时:</span>
            <span>${exam.duration || '-'}</span>
          </div>
        </div>
        <div class="all-questions">
          <h4>📝 答题详情</h4>
          ${questionsHtml}
        </div>
        <div class="wrong-questions">
          <h4>❌ 做错的题目 (${wrongAnswers.length} 题)</h4>
          ${wrongAnswers.length > 0 ? wrongAnswers.map((answer, index) => `
            <div class="wrong-item">
              <div class="question-number">第 ${index + 1} 题</div>
              <div class="question-content">${answer.content}</div>
              <div class="answer-info">
                <span class="user-answer">你的答案: ${answer.user_answer || '未作答'}</span>
                <span class="correct-answer">正确答案: ${answer.answer}</span>
              </div>
            </div>
          `).join('') : '<p class="no-wrong">没有做错的题目，太棒了！</p>'}
        </div>
      </div>
    `;
    
    document.getElementById('modal-content').innerHTML = modalContent;
    document.getElementById('modal').style.display = 'block';
  } catch (e) {
    console.error('获取考试详情失败:', e);
    showToast('获取考试详情失败', 'error');
  }
}

function closeModal() {
  document.getElementById('modal').style.display = 'none';
}

function renderHistoryList(records) {
  const listContainer = document.getElementById('history-list');
  const summaryContainer = document.getElementById('history-summary');
  const emptyContainer = document.getElementById('history-empty');

  if (!records || records.length === 0) {
    showEmptyState();
    return;
  }

  summaryContainer.style.display = 'block';
  emptyContainer.style.display = 'none';

  updateSummary(records);

  const sortedRecords = [...records].sort((a, b) => 
    new Date(b.start_time) - new Date(a.start_time)
  );

  listContainer.innerHTML = sortedRecords.map(record => {
    const score = record.total_score || 0;
    const accuracy = record.accuracy || 0;
    const date = record.start_time ? new Date(record.start_time) : new Date();
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    
    let scoreClass = 'poor';
    if (accuracy >= 90) scoreClass = 'excellent';
    else if (accuracy >= 70) scoreClass = 'good';
    else if (accuracy >= 60) scoreClass = 'normal';

    return `
      <div class="history-item" onclick="showExamDetails(${record.id})">
        <div class="history-score-badge ${scoreClass}">${score}</div>
        <div class="history-info">
          <div class="history-name">${record.user_name || '未知用户'}</div>
          <div class="history-meta">
            <span>年级: ${record.grade_name || '-'}</span>
            <span>正确率: ${accuracy}%</span>
          </div>
        </div>
        <div class="history-date">${dateStr}</div>
        <div class="history-arrow">›</div>
      </div>
    `;
  }).join('');
}

function updateSummary(records) {
  const total = records.length;
  const scores = records.map(r => r.total_score || 0);
  const best = scores.length > 0 ? Math.max(...scores) : 0;
  const average = scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0;
  const accuracies = records.map(r => r.accuracy || 0);
  const avgAccuracy = accuracies.length > 0 ? Math.round(accuracies.reduce((a, b) => a + b, 0) / accuracies.length) : 0;

  document.getElementById('summary-total').textContent = total;
  document.getElementById('summary-best').textContent = best;
  document.getElementById('summary-average').textContent = average;
  document.getElementById('summary-accuracy').textContent = avgAccuracy + '%';
}

function showEmptyState() {
  document.getElementById('history-summary').style.display = 'none';
  document.getElementById('history-list').innerHTML = '';
  document.getElementById('history-empty').style.display = 'block';
}

function showToast(msg, type = 'info') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

async function loadGrades() {
  try {
    const data = await api.getGrades();
    state.grades = data;
    
    const autoGradeMap = {
      '张洛琳': 2,
      '张洛晗': 1
    };
    
    const autoGradeId = autoGradeMap[state.userName];
    
    if (autoGradeId && state.userName) {
      await selectGrade(autoGradeId);
    } else {
      renderGradeCards();
    }
  } catch (e) {
    console.error('加载年级失败:', e);
  }
}

function renderGradeCards() {
  const container = document.getElementById('grade-cards');
  const emojis = { low: '🌱', middle: '🌿', high: '🌳' };

  const filteredGrades = state.grades.filter(g => {
    if (state.userRole === 'admin') return true;
    return state.allowedGrades.includes(g.level);
  });

  if (filteredGrades.length === 0) {
    container.innerHTML = `
      <div class="no-grade-message">
        <div class="no-grade-icon">🔒</div>
        <div class="no-grade-text">你没有权限访问任何年级的试题</div>
        <div class="no-grade-desc">请联系管理员开通权限</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filteredGrades.map(g => `
    <div class="grade-card" onclick="selectGrade(${g.id})">
      <div class="emoji">${emojis[g.level] || '📖'}</div>
      <div class="grade-name">${g.name}</div>
      <div class="grade-info">点击选择试卷</div>
    </div>
  `).join('');
}

async function selectGrade(gradeId) {
  try {
    const [papers, types] = await Promise.all([api.getPapers(), api.getTypes()]);
    const gradePapers = papers.filter(p => p.grade_id === gradeId);
    
    if (gradePapers.length === 0) {
      showToast('该年级暂无试卷', 'error');
      return;
    }

    state.selectedGradeId = gradeId;
    state.types = types;
    state.selectedTypeIds = [];
    renderTypeCheckboxes(types);
    renderPaperCards(gradePapers);
    navigateTo('papers');
  } catch (e) {
    showToast('加载试卷失败', 'error');
    console.error('加载试卷失败:', e);
  }
}

function renderTypeCheckboxes(types) {
  const container = document.getElementById('type-checkboxes');
  container.innerHTML = `
    <label class="type-checkbox type-checkbox-all">
      <input type="checkbox" id="select-all-types" onchange="toggleSelectAllTypes()">
      <span>全选</span>
    </label>
    ${types.map(t => `
    <label class="type-checkbox">
      <input type="checkbox" value="${t.id}" onclick="toggleType(${t.id})">
      <span>${t.name}</span>
    </label>
    `).join('')}
  `;
}

function toggleType(typeId) {
  const index = state.selectedTypeIds.indexOf(typeId);
  if (index > -1) {
    state.selectedTypeIds.splice(index, 1);
  } else {
    state.selectedTypeIds.push(typeId);
  }
  updateSelectAllCheckbox();
}

function toggleSelectAllTypes() {
  const checkbox = document.getElementById('select-all-types');
  const typeCheckboxes = document.querySelectorAll('.type-checkbox input[type="checkbox"]');
  
  if (checkbox.checked) {
    typeCheckboxes.forEach(cb => {
      if (cb.id !== 'select-all-types') {
        cb.checked = true;
      }
    });
    state.selectedTypeIds = state.types.map(t => t.id);
  } else {
    typeCheckboxes.forEach(cb => {
      if (cb.id !== 'select-all-types') {
        cb.checked = false;
      }
    });
    state.selectedTypeIds = [];
  }
}

function updateSelectAllCheckbox() {
  const selectAllCheckbox = document.getElementById('select-all-types');
  if (!selectAllCheckbox || !state.types) return;
  
  const allSelected = state.types.every(t => state.selectedTypeIds.includes(t.id));
  const noneSelected = state.selectedTypeIds.length === 0;
  
  if (allSelected && !noneSelected) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
  } else if (noneSelected) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
  } else {
    selectAllCheckbox.indeterminate = true;
  }
}

function clearTypeSelection() {
  const typeCheckboxes = document.querySelectorAll('.type-checkbox input[type="checkbox"]');
  typeCheckboxes.forEach(cb => {
    cb.checked = false;
    cb.indeterminate = false;
  });
  state.selectedTypeIds = [];
}

function goBackToGrades() {
  state.selectedTypeIds = [];
  navigateTo('home');
}

function renderPaperCards(papers) {
  const container = document.getElementById('paper-cards');
  container.innerHTML = papers.map(p => `
    <div class="paper-card" onclick="startExam(${state.selectedGradeId}, ${p.id})">
      <div class="paper-icon">📄</div>
      <div class="paper-name">${p.name}</div>
      <div class="paper-info">题目数: ${p.question_count} | ${p.grade_name}</div>
      <div class="paper-date">创建时间: ${formatDate(p.created_at)}</div>
    </div>
  `).join('');
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function startExam(gradeId, paperId = null) {
  const userName = state.userName || document.getElementById('user-name').value.trim();
  if (!userName) {
    showToast('请先输入你的名字', 'error');
    document.getElementById('user-name')?.focus();
    return;
  }

  const typeIds = state.selectedTypeIds && state.selectedTypeIds.length > 0 ? state.selectedTypeIds : null;

  try {
    showToast('正在加载题目...', 'info');
    const data = await api.startExam(gradeId, userName, paperId, typeIds);
    state.exam = {
      id: data.exam_id,
      grade_id: data.grade_id,
      user_name: data.user_name,
      total_questions: data.total_questions
    };
    state.questions = data.questions;
    state.currentIndex = 0;
    state.answers = {};
    state.submitted = {};

    const grade = state.grades.find(g => g.id === gradeId);
    document.getElementById('exam-grade').textContent = grade ? grade.name : '';

    navigateTo('exam');
    startTimer();
    renderQuestion();
    renderQuestionNav();
    addKeyboardListeners();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function startTimer() {
  const secondsPerQuestion = 40;
  const totalSeconds = state.questions.length * secondsPerQuestion;
  state.timeLeft = totalSeconds;
  updateTimerDisplay();
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateTimerDisplay();
    if (state.timeLeft <= 0) {
      stopTimer();
      showToast('考试时间已到！', 'error');
      setTimeout(() => {
        finishExam();
      }, 2000);
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

function updateTimerDisplay() {
  const minutes = Math.floor(state.timeLeft / 60);
  const seconds = state.timeLeft % 60;
  const timer = document.getElementById('timer');
  timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (state.timeLeft <= 300) {
    timer.classList.add('warning');
  } else {
    timer.classList.remove('warning');
  }
}

function renderQuestion() {
  const q = state.questions[state.currentIndex];
  if (!q) return;

  const isAnswered = state.submitted[q.id];
  const userAnswer = state.answers[q.id];

  document.getElementById('exam-progress').textContent =
    `第 ${state.currentIndex + 1} / ${state.questions.length} 题`;

  const typeBadge = getTypeBadge(q.type_name);
  const pointsText = `${q.points} 分`;

  let passageHtml = '';
  if (q.reading_content) {
    const titleHtml = q.reading_title ? `<div class="passage-title">📖 ${q.reading_title}</div>` : '<div class="passage-title">📖 阅读短文</div>';
    passageHtml = `
      <div class="reading-passage">
        ${titleHtml}
        <div class="passage-content">${q.reading_content.replace(/\n/g, '<br/>')}</div>
      </div>
    `;
  }

  let answerHtml = '';

  const parsedOptions = parseOptions(q.options);
  if (q.type_name === '选择题' || q.type_name === '识字题' || q.type_name === '阅读题' || (parsedOptions && parsedOptions.length > 0)) {
    answerHtml = `<div class="option-list">${parsedOptions.map((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      let cls = 'option-item';
      if (isAnswered && letter === userAnswer) {
        cls += ' selected answered';
      } else if (userAnswer === letter) {
        cls += ' selected';
      }
      return `<div class="${cls}" onclick="selectOption('${letter}')">
        <div class="option-radio"></div>
        <span>${opt}</span>
      </div>`;
    }).join('')}</div>`;
  } else if (q.type_name === '判断题') {
    const judgeOptions = ['A. 正确', 'B. 错误'];
    answerHtml = `<div class="option-list">${judgeOptions.map((opt, idx) => {
      const letter = String.fromCharCode(65 + idx);
      let cls = 'option-item';
      if (isAnswered && letter === userAnswer) {
        cls += ' selected answered';
      } else if (userAnswer === letter) {
        cls += ' selected';
      }
      return `<div class="${cls}" onclick="selectOption('${letter}')">
        <div class="option-radio"></div>
        <span>${opt}</span>
      </div>`;
    }).join('')}</div>`;
  } else {
    answerHtml = `<input type="text" class="fill-input" id="fill-answer"
      placeholder="请输入答案" value="${userAnswer || ''}">`;
  }

  document.getElementById('question-area').innerHTML = `
    ${typeBadge}
    <div class="question-points">${pointsText}</div>
    ${passageHtml}
    <div class="question-content">${q.content}</div>
    <div class="answer-area">${answerHtml}</div>
  `;

  // 为填空/计算题绑定输入事件
  const fillInput = document.getElementById('fill-answer');
  if (fillInput) {
    fillInput.addEventListener('input', function() {
      state.answers[q.id] = this.value;
    });
  }

  document.getElementById('btn-submit').style.display = isAnswered ? 'none' : '';
  document.getElementById('btn-next').style.display = 'none';
  document.getElementById('btn-finish').style.display = 'none';

  renderQuestionNav();
}

function getTypeBadge(typeName) {
  let cls = 'choice';
  if (typeName === '选择题') cls = 'choice';
  else if (typeName === '填空题') cls = 'fill';
  else if (typeName === '判断题') cls = 'judge';
  else if (typeName === '计算题') cls = 'calc';
  else if (typeName === '识字题') cls = 'literacy';
  else if (typeName === '阅读题') cls = 'reading';
  return `<span class="question-type-badge ${cls}">${typeName}</span>`;
}

function parseOptions(options) {
  if (!options) return [];
  if (Array.isArray(options)) return options;
  try {
    const parsed = JSON.parse(options);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function selectOption(letter) {
  const q = state.questions[state.currentIndex];
  state.answers[q.id] = letter;
  if (state.submitted[q.id]) {
    state.submitted[q.id].answer = letter;
  }
  renderQuestion();
}

function submitAnswer() {
  const q = state.questions[state.currentIndex];
  const userAnswer = state.answers[q.id];

  if (!userAnswer) {
    showToast('请先选择或输入答案', 'error');
    return;
  }

  state.submitted[q.id] = { answer: userAnswer };
  
  if (state.currentIndex < state.questions.length - 1) {
    setTimeout(() => {
      state.currentIndex++;
      renderQuestion();
    }, 300);
  } else {
    showConfirmDialog();
  }
}

function handleKeyPress(event) {
  if (event.code === 'Enter') {
    event.preventDefault();
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
      const q = state.questions[state.currentIndex];
      if (q && !state.submitted[q.id]) {
        state.answers[q.id] = event.target.value;
      }
    }
    submitAnswer();
    return;
  }

  if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
    return;
  }

  if (event.code === 'ArrowRight') {
    event.preventDefault();
    if (state.currentIndex < state.questions.length - 1) {
      state.currentIndex++;
      renderQuestion();
    }
  } else if (event.code === 'ArrowLeft') {
    event.preventDefault();
    if (state.currentIndex > 0) {
      state.currentIndex--;
      renderQuestion();
    }
  } else if (/^Key[ABCD]$/.test(event.code)) {
    const letter = event.code.replace('Key', '');
    const q = state.questions[state.currentIndex];
    if (q && (q.type_name === '选择题' || q.type_name === '判断题' || q.type_name === '识字题' || q.type_name === '阅读题')) {
      selectOption(letter);
    }
  }
}

function addKeyboardListeners() {
  document.addEventListener('keydown', handleKeyPress);
}

function removeKeyboardListeners() {
  document.removeEventListener('keydown', handleKeyPress);
}

function nextQuestion() {
  if (state.currentIndex < state.questions.length - 1) {
    state.currentIndex++;
    renderQuestion();
  }
}

function goToQuestion(index) {
  state.currentIndex = index;
  renderQuestion();
}

function renderQuestionNav() {
  const nav = document.getElementById('question-nav');
  nav.innerHTML = state.questions.map((q, idx) => {
    let cls = 'q-nav-btn';
    if (idx === state.currentIndex) cls += ' current';
    if (state.submitted[q.id]) {
      cls += ' answered';
    }
    return `<button class="${cls}" onclick="goToQuestion(${idx})">${idx + 1}</button>`;
  }).join('');
}

function showConfirmDialog() {
  const answeredCount = Object.keys(state.submitted).length;
  const totalCount = state.questions.length;
  const unansweredCount = totalCount - answeredCount;

  let answersHtml = state.questions.map((q, idx) => {
    const userAnswer = state.answers[q.id] || '未作答';
    return `
      <div class="confirm-item">
        <div class="confirm-item-header">
          <span class="confirm-item-number">第 ${idx + 1} 题</span>
          <span class="confirm-item-type">${q.type_name}</span>
        </div>
        <div class="confirm-item-content">${q.content}</div>
        <div class="confirm-item-answer">
          <span class="confirm-label">你的答案：</span>
          <span class="confirm-value ${state.answers[q.id] ? '' : 'unanswered'}">${userAnswer}</span>
        </div>
      </div>
    `;
  }).join('');

  const confirmDialog = `
    <div class="confirm-overlay" id="confirm-overlay" style="display:flex">
      <div class="confirm-dialog">
        <div class="confirm-header">
          <h3>📝 确认提交答案</h3>
          <button class="confirm-close" onclick="hideConfirmDialog()">✕</button>
        </div>
        <div class="confirm-summary">
          <div class="summary-row">
            <span>已答题目：</span>
            <span class="answered-count">${answeredCount} / ${totalCount}</span>
          </div>
          ${unansweredCount > 0 ? `
          <div class="summary-row warning">
            <span>未答题目：</span>
            <span>${unansweredCount} 题</span>
          </div>
          ` : ''}
        </div>
        <div class="confirm-answers">
          ${answersHtml}
        </div>
        <div class="confirm-actions">
          <button class="btn btn-secondary" onclick="hideConfirmDialog()">继续答题</button>
          <button class="btn btn-edit" onclick="editAnswers()">检查修正</button>
          <button class="btn btn-primary" onclick="submitExam()">确认交卷</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', confirmDialog);
}

function hideConfirmDialog() {
  const overlay = document.getElementById('confirm-overlay');
  if (overlay) overlay.remove();
}

function editAnswers() {
  hideConfirmDialog();
  state.currentIndex = 0;
  navigateTo('exam');
  document.getElementById('btn-submit').style.display = '';
  renderQuestion();
}

async function submitExam() {
  hideConfirmDialog();
  stopTimer();
  removeKeyboardListeners();

  try {
    const answers = Object.keys(state.answers).map(qId => ({
      question_id: parseInt(qId),
      user_answer: state.answers[qId]
    }));

    const data = await api.submitAllAnswers(state.exam.id, answers);
    showResult(data);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function finishExam() {
  showConfirmDialog();
}

function showResult(data) {
  navigateTo('result');

  const score = data.total_score;
  const totalQuestions = data.exam ? data.exam.total_questions : (data.questions ? data.questions.length : 10);
  const maxScore = data.total_points || (totalQuestions * 10);
  const accuracy = data.accuracy || 0;
  const wrongAnswers = data.wrong_answers || [];

  console.log('=== 考试结果 (app.js) ===');
  console.log('得分:', score, '满分:', maxScore, '正确率:', accuracy + '%');
  console.log('是否满分:', score >= maxScore || score === 100);

  let scoreClass = 'poor';
  if (accuracy >= 90) scoreClass = 'excellent';
  else if (accuracy >= 70) scoreClass = 'good';
  else if (accuracy >= 60) scoreClass = 'normal';

  const wrongAnswersHtml = wrongAnswers.length > 0 ? `
    <div class="result-wrong-section">
      <h3>❌ 做错的题目 (${wrongAnswers.length} 题)</h3>
      <div class="wrong-list">
        ${wrongAnswers.map((answer, index) => `
          <div class="wrong-item">
            <div class="question-number">第 ${index + 1} 题</div>
            <div class="question-content">${answer.content}</div>
            <div class="answer-info">
              <span class="user-answer">你的答案: ${answer.user_answer || '未作答'}</span>
              <span class="correct-answer">正确答案: ${answer.answer}</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  ` : `
    <div class="result-wrong-section no-wrong">
      <div class="no-wrong-icon">🎉</div>
      <div class="no-wrong-text">太棒了！没有做错的题目！</div>
    </div>
  `;

  const isPerfectScore = score >= maxScore || score === 100;

  document.getElementById('result-container').innerHTML = `
    <div class="result-card">
      <h2>📊 考试成绩</h2>
      <div class="result-score ${scoreClass}" id="result-score-display">${score} 分</div>
      <div class="result-details">
        <div class="result-detail-item">
          <div class="label">正确率</div>
          <div class="value">${accuracy}%</div>
        </div>
        <div class="result-detail-item">
          <div class="label">正确题数</div>
          <div class="value">${data.correct_count} / ${totalQuestions}</div>
        </div>
        <div class="result-detail-item">
          <div class="label">年级</div>
          <div class="value">${data.grade_name || ''}</div>
        </div>
        <div class="result-detail-item">
          <div class="label">用时</div>
          <div class="value">${formatTime(1800 - state.timeLeft)}</div>
        </div>
      </div>
      ${wrongAnswersHtml}
      <div class="result-actions">
        <button class="btn btn-primary" onclick="navigateTo('home')">返回首页</button>
        <button class="btn btn-secondary" onclick="reviewExam()">查看答题详情</button>
        ${isPerfectScore ? `<button class="btn btn-lottery-inline" id="btn-lottery-result" onclick="showLotteryFromResult()">🎁 抽奖</button>` : ''}
      </div>
    </div>
  `;

  if (isPerfectScore) {
    console.log('✅ 触发满分庆祝动画 (app.js)，得分:', score);
    showCelebration(score);
  }
}

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
}

async function playCelebrationMusic() {
  const audioUrls = [
    'https://music.163.com/song/media/outer/url?id=1395424625.mp3',
    'https://music.163.com/song/media/outer/url?id=1805927154.mp3',
    'https://music.163.com/song/media/outer/url?id=1408727654.mp3'
  ];
  
  const randomUrl = audioUrls[Math.floor(Math.random() * audioUrls.length)];
  
  try {
    const audio = new Audio(randomUrl);
    audio.volume = 0.5;
    audio.play().catch(() => {
      fallbackAudioPlay();
    });
    
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, 30000);
  } catch (e) {
    console.log('联网音乐播放失败，使用本地音效:', e);
    fallbackAudioPlay();
  }
}

const videoMap = {
  '张洛晗': '/videos/张洛晗.mp4',
  '张洛琳': '/videos/张洛琳.mp4'
};

async function playCelebrationVideo() {
  const video = document.getElementById('celebration-video');
  const container = document.getElementById('celebration-video-container');
  
  const videoUrl = videoMap[state.userName] || null;
  
  if (!videoUrl) {
    console.log('未找到该用户的专属视频，使用Canvas动画:', state.userName);
    container.style.display = 'none';
    createCanvasBackground();
    setTimeout(() => destroyCanvasBackground(), 30000);
    return;
  }
  
  video.muted = true;
  video.playsinline = true;
  video.loop = true;
  video.preload = 'auto';
  
  try {
    video.src = videoUrl;
    
    const onCanPlay = () => {
      container.style.display = 'block';
      video.play().then(() => {
        console.log('视频播放成功:', videoUrl, '用户:', state.userName);
      }).catch((err) => {
        console.log('视频自动播放被阻止:', err);
        container.style.display = 'none';
        createCanvasBackground();
      });
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadeddata', onCanPlay);
    };
    
    const onError = (err) => {
      console.log('视频加载失败:', err);
      container.style.display = 'none';
      createCanvasBackground();
      video.removeEventListener('error', onError);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadeddata', onCanPlay);
    };
    
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadeddata', onCanPlay);
    video.addEventListener('error', onError);
    
    video.load();
    
    setTimeout(() => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      container.style.display = 'none';
      destroyCanvasBackground();
    }, 30000);
  } catch (e) {
    console.log('视频播放失败:', e);
    container.style.display = 'none';
    createCanvasBackground();
  }
}

let canvasBackground = null;
let canvasAnimationId = null;

function createCanvasBackground() {
  const container = document.createElement('div');
  container.className = 'celebration-canvas-container';
  container.id = 'celebration-canvas-container';
  document.body.appendChild(container);
  
  const canvas = document.createElement('canvas');
  canvas.className = 'celebration-canvas';
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  container.appendChild(canvas);
  
  canvasBackground = { container, canvas };
  
  const ctx = canvas.getContext('2d');
  
  const particles = [];
  const fireworks = [];
  const sparkles = [];
  
  for (let i = 0; i < 80; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 6 + 2,
      speedX: (Math.random() - 0.5) * 1.5,
      speedY: Math.random() * 1.5 + 0.5,
      color: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#e84393', '#a29bfe', '#fd79a8'][Math.floor(Math.random() * 9)],
      opacity: Math.random() * 0.6 + 0.3,
      shape: Math.random() > 0.6 ? 'circle' : (Math.random() > 0.5 ? 'star' : 'heart'),
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.1
    });
  }
  
  for (let i = 0; i < 5; i++) {
    fireworks.push({
      x: Math.random() * canvas.width,
      y: canvas.height + 50,
      targetY: Math.random() * canvas.height * 0.6,
      speed: Math.random() * 4 + 6,
      color: ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1'][Math.floor(Math.random() * 4)],
      exploded: false,
      fragments: []
    });
  }
  
  for (let i = 0; i < 30; i++) {
    sparkles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 3 + 1,
      opacity: Math.random() * 0.8 + 0.2,
      twinkleSpeed: Math.random() * 0.1 + 0.05,
      twinklePhase: Math.random() * Math.PI * 2
    });
  }
  
  function animate() {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.08)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      p.rotation += p.rotationSpeed;
      
      if (p.y > canvas.height) {
        p.y = -10;
        p.x = Math.random() * canvas.width;
      }
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      
      ctx.save();
      ctx.globalAlpha = p.opacity;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      
      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        drawStar(ctx, 0, 0, 5, p.size, p.size / 2);
        ctx.fill();
      } else {
        drawHeart(ctx, 0, 0, p.size);
        ctx.fill();
      }
      
      ctx.restore();
    });
    
    fireworks.forEach(fw => {
      if (!fw.exploded) {
        fw.y -= fw.speed;
        
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = fw.color;
        ctx.beginPath();
        ctx.arc(fw.x, fw.y, 3, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.beginPath();
        ctx.arc(fw.x, fw.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        
        if (fw.y <= fw.targetY) {
          fw.exploded = true;
          for (let i = 0; i < 30; i++) {
            fw.fragments.push({
              x: fw.x,
              y: fw.y,
              speedX: (Math.random() - 0.5) * 8,
              speedY: (Math.random() - 0.5) * 8,
              size: Math.random() * 4 + 2,
              color: ['#ffd700', '#ff6b6b', '#ffffff', '#ffeaa7', '#4ecdc4'][Math.floor(Math.random() * 5)],
              opacity: 1,
              gravity: 0.15
            });
          }
        }
      } else {
        fw.fragments.forEach(f => {
          f.x += f.speedX;
          f.y += f.speedY;
          f.speedY += f.gravity;
          f.opacity -= 0.015;
          
          if (f.opacity > 0) {
            ctx.save();
            ctx.globalAlpha = f.opacity;
            ctx.fillStyle = f.color;
            ctx.beginPath();
            ctx.arc(f.x, f.y, f.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }
        });
        
        if (fw.fragments.every(f => f.opacity <= 0)) {
          fw.x = Math.random() * canvas.width;
          fw.y = canvas.height + 50;
          fw.targetY = Math.random() * canvas.height * 0.6;
          fw.exploded = false;
          fw.fragments = [];
        }
      }
    });
    
    sparkles.forEach(s => {
      s.twinklePhase += s.twinkleSpeed;
      const opacity = 0.3 + Math.sin(s.twinklePhase) * 0.5;
      
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
      ctx.fill();
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.size * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
    
    canvasAnimationId = requestAnimationFrame(animate);
  }
  
  animate();
}

function drawHeart(ctx, cx, cy, size) {
  ctx.beginPath();
  ctx.moveTo(cx, cy + size / 2);
  ctx.bezierCurveTo(cx - size, cy - size / 2, cx - size * 1.5, cy, cx, cy + size);
  ctx.bezierCurveTo(cx + size * 1.5, cy, cx + size, cy - size / 2, cx, cy + size / 2);
  ctx.closePath();
}

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius) {
  let rot = Math.PI / 2 * 3;
  let x = cx;
  let y = cy;
  const step = Math.PI / spikes;
  
  ctx.beginPath();
  ctx.moveTo(cx, cy - outerRadius);
  
  for (let i = 0; i < spikes; i++) {
    x = cx + Math.cos(rot) * outerRadius;
    y = cy + Math.sin(rot) * outerRadius;
    ctx.lineTo(x, y);
    rot += step;
    
    x = cx + Math.cos(rot) * innerRadius;
    y = cy + Math.sin(rot) * innerRadius;
    ctx.lineTo(x, y);
    rot += step;
  }
  
  ctx.lineTo(cx, cy - outerRadius);
  ctx.closePath();
}

function destroyCanvasBackground() {
  if (canvasBackground) {
    if (canvasAnimationId) {
      cancelAnimationFrame(canvasAnimationId);
      canvasAnimationId = null;
    }
    canvasBackground.container.remove();
    canvasBackground = null;
  }
}

function fallbackAudioPlay() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 1046.50];
    const durations = [0.15, 0.15, 0.2, 0.15, 0.15, 0.2, 0.3];
    
    notes.forEach((freq, i) => {
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
      
      const startTime = audioContext.currentTime + i * 0.15;
      gainNode.gain.setValueAtTime(0, startTime);
      gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.05);
      gainNode.gain.linearRampToValueAtTime(0, startTime + durations[i]);
      
      oscillator.start(startTime);
      oscillator.stop(startTime + durations[i]);
    });
    
    setTimeout(() => audioContext.close(), 2000);
  } catch (e) {
    console.log('音频播放不可用:', e);
  }
}

function createConfetti() {
  const colors = ['#ffd700', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dfe6e9', '#e84393', '#a29bfe', '#fd79a8'];
  const confettiCount = 80;
  
  for (let i = 0; i < confettiCount; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'celebration-confetti';
    confetti.style.left = Math.random() * 100 + 'vw';
    confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
    confetti.style.width = (6 + Math.random() * 14) + 'px';
    confetti.style.height = (6 + Math.random() * 14) + 'px';
    confetti.style.animationDelay = Math.random() * 3 + 's';
    confetti.style.animationDuration = (4 + Math.random() * 3) + 's';
    confetti.style.transform = `rotate(${Math.random() * 360}deg)`;
    confetti.style.borderRadius = Math.random() > 0.5 ? '50%' : '4px';
    document.body.appendChild(confetti);
    setTimeout(() => confetti.remove(), 8000);
  }
}

function createStarBurst() {
  const starEmojis = ['⭐', '🌟', '✨', '💫', '⚡', '🔥'];
  
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const star = document.createElement('div');
      star.className = 'celebration-star';
      star.textContent = starEmojis[Math.floor(Math.random() * starEmojis.length)];
      star.style.left = Math.random() * 100 + 'vw';
      star.style.top = Math.random() * 100 + 'vh';
      star.style.fontSize = (25 + Math.random() * 50) + 'px';
      star.style.animationDelay = Math.random() * 0.8 + 's';
      star.style.animationDuration = (1.2 + Math.random() * 0.8) + 's';
      document.body.appendChild(star);
      setTimeout(() => star.remove(), 2500);
    }, i * 100);
  }
}

function showCelebration(score) {
  const overlay = document.getElementById('celebration-overlay');
  document.getElementById('celebration-score').textContent = `${score} 分`;
  overlay.style.display = 'flex';

  playCelebrationMusic();
  playCelebrationVideo();
  createStarBurst();
  createConfetti();
  createFloatingHearts();
  createRays();

  const emojis = ['🎉', '🎊', '⭐', '🌟', '💫', '🏆', '🥇', '👏', '💯', '🎈', '🎁', '✨', '🎀', '🏅', '🎖️', '🎯', '🎪', '🎭', '💪', '🌟'];
  for (let i = 0; i < 50; i++) {
    setTimeout(() => {
      const emoji = document.createElement('div');
      emoji.className = 'celebration-emoji';
      emoji.textContent = emojis[Math.floor(Math.random() * emojis.length)];
      emoji.style.left = Math.random() * 100 + 'vw';
      emoji.style.animationDelay = Math.random() * 3 + 's';
      emoji.style.animationDuration = (3 + Math.random() * 2) + 's';
      emoji.style.fontSize = (28 + Math.random() * 35) + 'px';
      document.body.appendChild(emoji);
      setTimeout(() => emoji.remove(), 6000);
    }, i * 60);
  }

  setTimeout(() => {
    document.getElementById('btn-lottery').style.display = 'inline-block';
  }, 5000);

  setTimeout(() => {
    if (document.getElementById('celebration-overlay').style.display === 'flex') {
      overlay.style.display = 'none';
      document.getElementById('btn-lottery').style.display = 'none';
    }
  }, 30000);

  overlay.onclick = () => {
    overlay.style.display = 'none';
    document.getElementById('btn-lottery').style.display = 'none';
  };
}

let prizes = [];

async function loadPrizes() {
  try {
    const result = await api.getAllPrizes();
    prizes = result.prizes;
  } catch (error) {
    console.error('加载奖项失败:', error);
    prizes = [
      { name: '2元钱', emoji: '💰', color: '#ef4444', base_probability: 14.29 },
      { name: '1元钱', emoji: '💵', color: '#f59e0b', base_probability: 14.29 },
      { name: '游乐场一次', emoji: '🎡', color: '#10b981', base_probability: 14.29 },
      { name: '火锅一次', emoji: '🍲', color: '#6366f1', base_probability: 14.29 },
      { name: '一个西瓜', emoji: '🍉', color: '#22c55e', base_probability: 14.29 },
      { name: '看爸爸手机0分钟', emoji: '📱', color: '#8b5cf6', base_probability: 14.29 },
      { name: '谢谢惠顾', emoji: '🎁', color: '#6b7280', base_probability: 14.25 }
    ];
  }
}

function renderLotteryWheel() {
  const wheel = document.getElementById('lottery-wheel');
  if (!wheel || prizes.length === 0) return;
  
  const degreesPerPrize = 360 / prizes.length;
  
  let segments = '';
  prizes.forEach((prize, index) => {
    const rotation = index * degreesPerPrize;
    segments += `
      <div class="lottery-segment" style="transform: rotate(${rotation}deg); background: linear-gradient(135deg, ${prize.color}, ${adjustColor(prize.color, -30)});">
        <span class="segment-text">${prize.emoji} ${prize.name}</span>
      </div>
    `;
  });
  
  wheel.innerHTML = segments;
}

function adjustColor(color, amount) {
  const hex = color.replace('#', '');
  const r = Math.max(0, Math.min(255, parseInt(hex.substr(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.substr(2, 2), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.substr(4, 2), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

async function showLottery() {
  await loadPrizes();
  renderLotteryWheel();
  
  document.getElementById('celebration-overlay').style.display = 'none';
  document.getElementById('btn-lottery').style.display = 'none';
  document.getElementById('lottery-overlay').style.display = 'flex';
  document.getElementById('lottery-result').style.display = 'none';
  document.getElementById('btn-spin').disabled = false;
  
  const wheel = document.getElementById('lottery-wheel');
  wheel.classList.remove('spinning');
  wheel.style.transform = 'rotate(0deg)';
}

function closeLottery() {
  document.getElementById('lottery-overlay').style.display = 'none';
  document.getElementById('lottery-result').style.display = 'none';
}

async function showLotteryFromResult() {
  await loadPrizes();
  renderLotteryWheel();
  
  document.getElementById('lottery-overlay').style.display = 'flex';
  document.getElementById('lottery-result').style.display = 'none';
  document.getElementById('btn-spin').disabled = false;
  
  const wheel = document.getElementById('lottery-wheel');
  wheel.classList.remove('spinning');
  wheel.style.transform = 'rotate(0deg)';
  
  window.isDemoMode = false;
}

function showLotteryResult(index) {
  const prize = prizes[index];
  const resultDiv = document.getElementById('lottery-result');
  const emojiDiv = resultDiv.querySelector('.result-emoji');
  const textDiv = resultDiv.querySelector('.result-text');
  
  emojiDiv.textContent = prize.emoji;
  textDiv.textContent = `恭喜获得：${prize.name}`;
  textDiv.style.color = prize.color;
  
  resultDiv.style.display = 'block';
  document.getElementById('btn-spin').disabled = false;
  
  createConfetti();
  createStarBurst();
}

async function loadLotteryRecords() {
  if (!state.userName) {
    document.getElementById('lottery-records-list').innerHTML = '';
    document.getElementById('lottery-empty').style.display = 'block';
    return;
  }
  
  try {
    const records = await api.getUserLotteryRecords(state.userName);
    renderLotteryRecords(records);
  } catch (error) {
    console.error('加载中奖记录失败:', error);
    document.getElementById('lottery-records-list').innerHTML = '';
    document.getElementById('lottery-empty').style.display = 'block';
  }
}

function renderLotteryRecords(records) {
  const listContainer = document.getElementById('lottery-records-list');
  const emptyContainer = document.getElementById('lottery-empty');
  
  if (!records || records.length === 0) {
    listContainer.innerHTML = '';
    emptyContainer.style.display = 'block';
    return;
  }
  
  emptyContainer.style.display = 'none';
  
  listContainer.innerHTML = records.map(record => {
    const statusClass = record.is_redeemed ? 'claimed' : 'unclaimed';
    const statusText = record.is_redeemed ? '已兑现' : '未兑现';
    const date = new Date(record.created_at);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    
    return `
      <div class="lottery-record-item">
        <div class="lottery-prize-emoji">${record.prize_emoji || '🎁'}</div>
        <div class="lottery-record-info">
          <div class="lottery-prize-name">${record.prize_name}</div>
          <div class="lottery-record-meta">
            <span>考试得分: ${record.total_score || 0}分</span>
            <span>年级: ${record.grade_name || '-'}</span>
            <span>时间: ${dateStr}</span>
          </div>
        </div>
        <span class="lottery-record-status ${statusClass}">${statusText}</span>
      </div>
    `;
  }).join('');
}

async function loadRedeemRecords() {
  const filter = document.getElementById('redeem-status-filter')?.value;
  
  const demoBtn = document.getElementById('btn-demo-lottery');
  const prizeTab = document.getElementById('prize-tab');
  
  if (state.userName === '张伟') {
    demoBtn.style.display = 'inline-block';
    prizeTab.style.display = 'inline-block';
  } else {
    demoBtn.style.display = 'none';
    prizeTab.style.display = 'none';
  }
  
  try {
    const records = await api.getAllLotteryRecords();
    
    let filteredRecords = records;
    if (filter !== '') {
      filteredRecords = records.filter(r => String(r.is_redeemed) === filter);
    }
    
    updateRedeemSummary(records);
    renderRedeemRecords(filteredRecords);
  } catch (error) {
    console.error('加载兑现记录失败:', error);
    document.getElementById('redeem-records-list').innerHTML = '<p style="text-align:center;color:white;padding:40px">加载失败，请重试</p>';
  }
}

async function showDemoLottery() {
  await loadPrizes();
  renderLotteryWheel();
  
  document.getElementById('lottery-overlay').style.display = 'flex';
  document.getElementById('lottery-result').style.display = 'none';
  document.getElementById('btn-spin').disabled = false;
  
  const wheel = document.getElementById('lottery-wheel');
  wheel.classList.remove('spinning');
  wheel.style.transform = 'rotate(0deg)';
  
  window.isDemoMode = true;
}

async function spinWheel() {
  const btn = document.getElementById('btn-spin');
  const wheel = document.getElementById('lottery-wheel');
  const resultDiv = document.getElementById('lottery-result');
  
  btn.disabled = true;
  resultDiv.style.display = 'none';
  
  try {
    let response;
    if (window.isDemoMode) {
      response = await api.demoDraw(state.userName);
      window.isDemoMode = false;
    } else {
      response = await api.drawLottery(state.exam.id, state.userName);
    }
    
    const prize = response.prize;
    const prizeIndex = prizes.findIndex(p => p.name === prize.name);
    
    const degreesPerPrize = 360 / prizes.length;
    const baseRotation = 1800;
    const targetRotation = baseRotation + prizeIndex * degreesPerPrize + (360 - degreesPerPrize / 2);
    
    wheel.classList.add('spinning');
    wheel.style.transform = `rotate(${targetRotation}deg)`;
    
    setTimeout(() => {
      wheel.classList.remove('spinning');
      showLotteryResult(prizeIndex);
    }, 4000);
  } catch (error) {
    showToast(error.message, 'error');
    btn.disabled = false;
    window.isDemoMode = false;
  }
}

function updateRedeemSummary(records) {
  const total = records.length;
  const claimed = records.filter(r => r.is_redeemed).length;
  const unclaimed = total - claimed;
  
  document.getElementById('redeem-total').textContent = total;
  document.getElementById('redeem-unclaimed').textContent = unclaimed;
  document.getElementById('redeem-claimed').textContent = claimed;
}

function renderRedeemRecords(records) {
  const listContainer = document.getElementById('redeem-records-list');
  
  if (!records || records.length === 0) {
    listContainer.innerHTML = '<p style="text-align:center;color:white;padding:40px">暂无记录</p>';
    return;
  }
  
  listContainer.innerHTML = records.map(record => {
    const statusClass = record.is_redeemed ? '' : 'unclaimed';
    const date = new Date(record.created_at);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    
    return `
      <div class="redeem-record-item">
        <div class="redeem-prize-emoji">${record.prize_emoji || '🎁'}</div>
        <div class="redeem-record-info">
          <div class="redeem-prize-name">${record.prize_name}</div>
          <div class="redeem-record-meta">
            <span>获奖者: ${record.user_name}</span>
            <span>考试得分: ${record.total_score || 0}分</span>
            <span>年级: ${record.grade_name || '-'}</span>
            <span>时间: ${dateStr}</span>
          </div>
        </div>
        <label class="redeem-label ${statusClass}" onclick="toggleRedeem(${record.id}, ${!record.is_redeemed})">
          <input type="checkbox" class="redeem-checkbox" ${record.is_redeemed ? 'checked' : ''} onchange="toggleRedeem(${record.id}, this.checked)">
          ${record.is_redeemed ? '已兑现' : '未兑现'}
        </label>
      </div>
    `;
  }).join('');
}

async function toggleRedeem(recordId, isRedeemed) {
  try {
    await api.updateRedeemStatus(recordId, isRedeemed);
    showToast(isRedeemed ? '已标记为兑现' : '已取消兑现', 'success');
    loadRedeemRecords();
  } catch (error) {
    showToast('更新失败', 'error');
  }
}

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(content => content.style.display = 'none');
  
  if (tabName === 'redemption') {
    document.querySelector('.tab-btn:first-child').classList.add('active');
    document.getElementById('tab-redemption').style.display = 'block';
  } else if (tabName === 'prizes') {
    document.getElementById('prize-tab').classList.add('active');
    document.getElementById('tab-prizes').style.display = 'block';
    loadPrizeRecords();
  }
}

async function loadPrizeRecords() {
  try {
    const result = await api.getAllPrizes();
    const prizes = result.prizes;
    const totalProbability = result.totalProbability;
    
    document.getElementById('prize-count').textContent = prizes.length;
    document.getElementById('prize-total-probability').textContent = `${totalProbability}%`;
    
    renderPrizeRecords(prizes);
  } catch (error) {
    console.error('加载奖项列表失败:', error);
    document.getElementById('prize-records-list').innerHTML = '<p style="text-align:center;color:white;padding:40px">加载失败，请重试</p>';
  }
}

function renderPrizeRecords(prizes) {
  const listContainer = document.getElementById('prize-records-list');
  
  if (!prizes || prizes.length === 0) {
    listContainer.innerHTML = '<p style="text-align:center;color:white;padding:40px">暂无奖项</p>';
    return;
  }
  
  listContainer.innerHTML = prizes.map(prize => {
    return `
      <div class="prize-record-item">
        <div class="prize-color-indicator" style="background: ${prize.color}"></div>
        <span class="prize-emoji">${prize.emoji}</span>
        <div class="prize-info">
          <div class="prize-name">${prize.name} ${prize.is_default ? '<span class="default-badge">默认</span>' : ''}</div>
          <div class="prize-probability">基础概率: ${prize.base_probability}%</div>
        </div>
        <div class="prize-record-actions">
          <button class="btn btn-edit-prize" onclick="showEditPrizeModal(${prize.id})">编辑</button>
          ${!prize.is_default ? `<button class="btn btn-delete-prize" onclick="deletePrize(${prize.id})">删除</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function showAddPrizeModal() {
  document.getElementById('prize-modal-title').textContent = '添加奖项';
  document.getElementById('prize-id').value = '';
  document.getElementById('prize-name').value = '';
  document.getElementById('prize-emoji').value = '';
  document.getElementById('prize-color').value = '#ef4444';
  document.getElementById('prize-probability').value = '';
  document.getElementById('prize-modal').style.display = 'flex';
}

function showEditPrizeModal(id) {
  api.getAllPrizes().then(result => {
    const prize = result.prizes.find(p => p.id === id);
    if (prize) {
      document.getElementById('prize-modal-title').textContent = '编辑奖项';
      document.getElementById('prize-id').value = prize.id;
      document.getElementById('prize-name').value = prize.name;
      document.getElementById('prize-emoji').value = prize.emoji;
      document.getElementById('prize-color').value = prize.color;
      document.getElementById('prize-probability').value = prize.base_probability;
      document.getElementById('prize-modal').style.display = 'flex';
    }
  }).catch(error => {
    showToast('加载奖项失败', 'error');
  });
}

function closePrizeModal() {
  document.getElementById('prize-modal').style.display = 'none';
}

async function savePrize() {
  const id = document.getElementById('prize-id').value;
  const name = document.getElementById('prize-name').value;
  const emoji = document.getElementById('prize-emoji').value;
  const color = document.getElementById('prize-color').value;
  const probability = document.getElementById('prize-probability').value;
  
  if (!name || !emoji || !color || !probability) {
    showToast('请填写完整信息', 'error');
    return;
  }
  
  try {
    if (id) {
      await api.updatePrize(id, name, emoji, color, parseFloat(probability));
      showToast('奖项更新成功', 'success');
    } else {
      await api.createPrize(name, emoji, color, parseFloat(probability));
      showToast('奖项添加成功', 'success');
    }
    closePrizeModal();
    loadPrizeRecords();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

async function deletePrize(id) {
  if (!confirm('确定要删除这个奖项吗？')) {
    return;
  }
  
  try {
    await api.deletePrize(id);
    showToast('奖项删除成功', 'success');
    loadPrizeRecords();
  } catch (error) {
    showToast(error.message, 'error');
  }
}

function createFloatingHearts() {
  for (let i = 0; i < 15; i++) {
    setTimeout(() => {
      const heart = document.createElement('div');
      heart.className = 'celebration-heart';
      heart.textContent = '❤️';
      heart.style.left = Math.random() * 100 + 'vw';
      heart.style.fontSize = (20 + Math.random() * 30) + 'px';
      heart.style.animationDelay = Math.random() * 2 + 's';
      heart.style.animationDuration = (4 + Math.random() * 2) + 's';
      document.body.appendChild(heart);
      setTimeout(() => heart.remove(), 7000);
    }, i * 200);
  }
}

function createRays() {
  const raysContainer = document.createElement('div');
  raysContainer.className = 'celebration-rays';
  document.body.appendChild(raysContainer);
  
  for (let i = 0; i < 12; i++) {
    const ray = document.createElement('div');
    ray.className = 'celebration-ray';
    ray.style.transform = `rotate(${i * 30}deg)`;
    raysContainer.appendChild(ray);
  }
  
  setTimeout(() => raysContainer.remove(), 4000);
}

function reviewExam() {
  state.currentIndex = 0;
  navigateTo('exam');
  document.getElementById('btn-submit').style.display = 'none';
  renderQuestion();
}

function exitExam() {
  if (confirm('确定要退出考试吗？当前答题进度将会丢失。')) {
    stopTimer();
    state.exam = null;
    state.questions = [];
    state.currentIndex = 0;
    state.answers = {};
    state.submitted = {};
    navigateTo('welcome');
    document.getElementById('welcome-step-1').style.display = 'block';
    document.getElementById('welcome-step-2').style.display = 'none';
    document.getElementById('welcome-step-3').style.display = 'none';
    document.getElementById('welcome-name').value = '';
  }
}

function resetExam() {
  if (confirm('确定要重新选题吗？当前答题进度将会丢失。')) {
    stopTimer();
    state.exam = null;
    state.questions = [];
    state.currentIndex = 0;
    state.answers = {};
    state.submitted = {};
    navigateTo('papers');
  }
}

async function loadManageData() {
  try {
    const [gradesData, typesData] = await Promise.all([api.getGrades(), api.getTypes()]);
    state.grades = gradesData;
    state.types = typesData;

    const gradeSelect = document.getElementById('filter-grade');
    gradeSelect.innerHTML = '<option value="">全部年级</option>' +
      gradesData.map(g => `<option value="${g.id}">${g.name}</option>`).join('');

    const typeSelect = document.getElementById('filter-type');
    typeSelect.innerHTML = '<option value="">全部题型</option>' +
      typesData.map(t => `<option value="${t.id}">${t.name}</option>`).join('');

    loadQuestions();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function loadQuestions(page = 1) {
  try {
    const gradeId = document.getElementById('filter-grade').value;
    const typeId = document.getElementById('filter-type').value;

    const params = { page, limit: 10 };
    if (gradeId) params.grade_id = gradeId;
    if (typeId) params.type_id = typeId;

    const data = await api.getQuestions(params);
    renderQuestionsList(data.questions);
    renderPagination(data.pagination);
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function renderQuestionsList(questions) {
  const list = document.getElementById('questions-list');
  if (!questions || questions.length === 0) {
    list.innerHTML = '<p style="text-align:center;color:var(--text-light);padding:40px">暂无题目</p>';
    return;
  }

  list.innerHTML = questions.map(q => `
    <div class="question-item">
      <div class="question-item-content">
        <div class="question-item-meta">
          <span class="tag tag-grade">${q.grade_name || ''}</span>
          <span class="tag tag-type">${q.type_name || ''}</span>
          <span class="tag tag-points">${q.points}分</span>
        </div>
        <div class="question-item-text">${q.content}</div>
      </div>
      <div class="question-item-actions">
        <button class="btn-sm btn-delete" onclick="deleteQuestion(${q.id})">删除</button>
      </div>
    </div>
  `).join('');
}

function renderPagination(pagination) {
  const container = document.getElementById('pagination');
  if (!pagination || pagination.total_pages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  html += `<button class="page-btn" ${pagination.page <= 1 ? 'disabled' : ''}
    onclick="loadQuestions(${pagination.page - 1})">上一页</button>`;

  for (let i = 1; i <= pagination.total_pages; i++) {
    html += `<button class="page-btn ${i === pagination.page ? 'active' : ''}"
      onclick="loadQuestions(${i})">${i}</button>`;
  }

  html += `<button class="page-btn" ${pagination.page >= pagination.total_pages ? 'disabled' : ''}
    onclick="loadQuestions(${pagination.page + 1})">下一页</button>`;

  container.innerHTML = html;
}

async function deleteQuestion(id) {
  if (!confirm('确定删除此题目？')) return;
  try {
    await api.deleteQuestion(id);
    showToast('删除成功', 'success');
    loadQuestions();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function scanQuestionBank() {
  try {
    showToast('正在扫描题库...', 'info');
    const data = await api.scanBank();
    showToast(`导入完成！成功 ${data.success} 题，失败 ${data.failed} 题`, 'success');
    loadQuestions();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function clearQuestionBank() {
  if (!confirm('确定要清空题库吗？所有题目、考试记录和答题记录都将被删除！')) {
    return;
  }
  try {
    showToast('正在清空题库...', 'info');
    await api.clearBank();
    showToast('题库清空成功', 'success');
    loadQuestions();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function resetAndRescan() {
  if (!confirm('确定要清空并重扫题库吗？所有题目、考试记录和答题记录都将被删除，然后重新导入题库文件！')) {
    return;
  }
  try {
    showToast('正在重置并重扫题库...', 'info');
    const data = await api.resetBank();
    showToast(`题库重置成功！共导入 ${data.total_questions} 题`, 'success');
    loadQuestions();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function showImportDialog() {
  document.getElementById('import-dialog').style.display = 'flex';
}

function hideImportDialog() {
  document.getElementById('import-dialog').style.display = 'none';
}

async function uploadFile() {
  const gradeSelect = document.getElementById('import-grade-select');
  const gradeId = gradeSelect.value;
  
  if (!gradeId) {
    showToast('请选择年级', 'error');
    return;
  }

  const fileInput = document.getElementById('file-input');
  if (!fileInput.files.length) {
    showToast('请选择文件', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('grade_id', gradeId);

  try {
    showToast('正在上传...', 'info');
    const data = await api.importFile(formData);
    showToast(`导入完成！成功 ${data.success} 题，失败 ${data.failed} 题`, 'success');
    hideImportDialog();
    gradeSelect.value = '';
    fileInput.value = '';
    loadQuestions();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function loadWrongAnswers() {
  try {
    const data = await api.getWrongAnswers(state.userName);
    renderWrongAnswers(data.data, data.total);
  } catch (e) {
    console.error('加载错题本失败:', e);
    showWrongAnswersEmpty();
  }
}

function renderWrongAnswers(wrongAnswers, total) {
  const container = document.getElementById('wrong-answers-list');
  const emptyContainer = document.getElementById('wrong-answers-empty');
  const countBadge = document.getElementById('wrong-answers-count');

  if (!wrongAnswers || wrongAnswers.length === 0) {
    showWrongAnswersEmpty();
    countBadge.textContent = '0';
    return;
  }

  emptyContainer.style.display = 'none';
  countBadge.textContent = total;

  container.innerHTML = wrongAnswers.map(item => {
    const date = new Date(item.created_at);
    const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
    
    return `
      <div class="wrong-answer-item">
        <div class="wrong-answer-content">
          <div class="wrong-answer-meta">
            <span class="tag tag-type">${item.type_name}</span>
            <span class="tag tag-points">${item.points}分</span>
            <span class="tag tag-date">${dateStr}</span>
          </div>
          <div class="wrong-answer-text">${item.content}</div>
          <div class="answer-compare">
            <span class="user-answer">
              <span class="label">你的答案：</span>
              <span class="value wrong">${item.user_answer || '未作答'}</span>
            </span>
            <span class="correct-answer">
              <span class="label">正确答案：</span>
              <span class="value correct">${item.correct_answer}</span>
            </span>
          </div>
        </div>
        <div class="wrong-answer-actions">
          <button class="btn-sm btn-delete" onclick="deleteWrongAnswer(${item.id})">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function showWrongAnswersEmpty() {
  document.getElementById('wrong-answers-list').innerHTML = '';
  document.getElementById('wrong-answers-empty').style.display = 'block';
  document.getElementById('wrong-answers-count').textContent = '0';
}

async function deleteWrongAnswer(id) {
  if (!confirm('确定要删除这条错题记录吗？')) return;
  
  try {
    await api.deleteWrongAnswer(id);
    showToast('删除成功', 'success');
    loadWrongAnswers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function clearAllWrongAnswers() {
  if (!confirm('确定要清空所有错题记录吗？此操作不可撤销！')) return;
  
  try {
    await api.clearWrongAnswers(state.userName);
    showToast('清空成功', 'success');
    loadWrongAnswers();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function practiceWrongAnswers() {
  try {
    const countData = await api.getWrongAnswerCount(state.userName);
    
    if (countData.count === 0) {
      showToast('错题本为空，无需练习', 'info');
      return;
    }

    const data = await api.getWrongAnswers(state.userName, 1, countData.count);
    const questionIds = data.data.map(item => item.question_id);
    
    if (questionIds.length === 0) {
      showToast('没有可练习的错题', 'info');
      return;
    }

    const practiceData = await api.practiceWrongAnswers(state.userName, questionIds);
    
    state.exam = {
      id: 'practice-' + Date.now(),
      grade_id: practiceData.questions[0]?.grade_id || 1,
      user_name: state.userName,
      total_questions: practiceData.total_questions
    };
    state.questions = practiceData.questions;
    state.currentIndex = 0;
    state.answers = {};
    state.submitted = {};
    state.timeLeft = practiceData.total_questions * 40;

    navigateTo('exam');
    startTimer();
    renderQuestion();
    addKeyboardListeners();
    
    showToast('开始错题练习！', 'info');
  } catch (e) {
    showToast(e.message, 'error');
  }
}

const backgroundImages = [
  'images/backgrounds/6ab9df9e5f00783310fd934849ef4ea536c3fcda43715-o7qDW7_fw480webp.webp',
  'images/backgrounds/842cb714ed3b2336c65a6f00b9fa3624b8840e28e35f2-9tWmG5_fw480webp.webp',
  'images/backgrounds/c43826cbcfa6317204a073d623266ae1d75a563d3f34b-ire3OH_fw480webp.webp',
  'images/backgrounds/ef1ce8f8bc47392aec9678350bd94030d7abbd211ede3-ghynl8_fw480webp.webp'
];

let currentBgIndex = -1;

function setBackgroundByIndex(index) {
  const container = document.getElementById('background-container');
  if (!container) return;

  const existingImg = container.querySelector('.background-image');
  const existingOverlay = container.querySelector('.background-overlay');
  
  if (existingImg) {
    existingImg.style.opacity = '0';
    setTimeout(() => {
      if (existingImg && existingImg.parentNode) {
        existingImg.parentNode.removeChild(existingImg);
      }
      if (existingOverlay && existingOverlay.parentNode) {
        existingOverlay.parentNode.removeChild(existingOverlay);
      }
    }, 500);
  }

  setTimeout(() => {
    const imageUrl = backgroundImages[index];
    const img = document.createElement('img');
    img.className = 'background-image';
    img.src = imageUrl;
    img.style.opacity = '0';
    
    const overlay = document.createElement('div');
    overlay.className = 'background-overlay';

    container.appendChild(img);
    container.appendChild(overlay);
    container.classList.add('has-image');

    setTimeout(() => {
      img.style.opacity = '0.5';
    }, 50);
  }, 550);

  currentBgIndex = index;
}

function setRandomBackground() {
  const randomIndex = Math.floor(Math.random() * backgroundImages.length);
  setBackgroundByIndex(randomIndex);
}

function changeBackground() {
  currentBgIndex = (currentBgIndex + 1) % backgroundImages.length;
  setBackgroundByIndex(currentBgIndex);
  showToast('已切换背景图', 'info');
}

document.addEventListener('DOMContentLoaded', () => {
  setRandomBackground();
  loadGrades();
  loadPrizes();
});

window.changeBackground = changeBackground;
window.setRandomBackground = setRandomBackground;
