
function startTimer() {
  const secondsPerQuestion = 120;
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

  if (q.type_name === '选择题' || q.type_name === '识字题' || q.type_name === '阅读题' || (q.options && q.options.length > 0)) {
    const options = parseOptions(q.options);
    answerHtml = `<div class="option-list">${options.map((opt, idx) => {
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
      placeholder="请输入答案" value="${userAnswer || ''}"
      oninput="state.answers[${q.id}] = this.value">`;
  }

  document.getElementById('question-area').innerHTML = `
    ${typeBadge}
    <div class="question-points">${pointsText}</div>
    ${passageHtml}
    <div class="question-content">${q.content}</div>
    <div class="answer-area">${answerHtml}</div>
  `;

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

function finishExam() {
  showConfirmDialog();
}

function showResult(data) {
  navigateTo('result');

  const score = data.total_score;
  const totalQuestions = data.exam ? data.exam.total_questions : (data.questions ? data.questions.length : 10);
  const maxScore = data.total_points || (totalQuestions * 10);
  const accuracy = data.accuracy || 0;
  const wrongAnswers = data.wrong_answers || [];

  console.log('=== 考试结果 ===');
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
  const canLottery = data.can_lottery !== false && isPerfectScore;
  const lotteryBlockedReason = data.lottery_blocked_reason || '';

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
      ${isPerfectScore && !canLottery ? `<div class="lottery-blocked-notice">⚠️ ${lotteryBlockedReason}</div>` : ''}
      <div class="result-actions">
        <button class="btn btn-primary" onclick="navigateTo('home')">返回首页</button>
        <button class="btn btn-secondary" onclick="reviewExam()">查看答题详情</button>
        ${canLottery ? `<button class="btn btn-lottery-inline" id="btn-lottery-result" onclick="showLotteryFromResult()">🎁 抽奖</button>` : ''}
      </div>
    </div>
  `;

  if (canLottery) {
    console.log('✅ 触发满分庆祝动画，得分:', score);
    showCelebration(score);
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

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}分${s}秒`;
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

async function startExam(gradeId, paperId = null) {
  const userName = state.userName || document.getElementById('user-name').value.trim();
  if (!userName) {
    showToast('请先输入你的名字', 'error');
    document.getElementById('user-name')?.focus();
    return;
  }

  const typeIds = state.selectedTypeIds && state.selectedTypeIds.length > 0 ? state.selectedTypeIds : null;

  if (paperId) {
    try {
      const checkResult = await api.checkPaperPerfect(userName, paperId);
      if (checkResult.already_perfect) {
        showToast('该试卷之前已考过100分，再次考试不能抽奖了', 'warning-center', 5000);
        await new Promise(r => setTimeout(r, 5000));
      }
    } catch (e) {
      console.error('检查试卷满分记录失败:', e);
    }
  }

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

    if (state.questions.some(q => q.reading_content)) {
      const started = window.startReadingExam && window.startReadingExam();
      if (started) return;
    }

    navigateTo('exam');
    startTimer();
    renderQuestion();
    addKeyboardListeners();
  } catch (e) {
    showToast(e.message, 'error');
  }
}
async function startExamFromPaper(gradeId, paperId) {
  await startExam(gradeId, paperId);
}

window.startTimer = startTimer;
window.stopTimer = stopTimer;
window.selectOption = selectOption;
window.submitAnswer = submitAnswer;
window.nextQuestion = nextQuestion;
window.goToQuestion = goToQuestion;
window.finishExam = finishExam;
window.submitExam = submitExam;
window.editAnswers = editAnswers;
window.hideConfirmDialog = hideConfirmDialog;
// ==================== 庆祝动画系统 ====================
const videoMap = {
  '张洛晗': '/videos/张洛晗.mp4',
  '张洛琳': '/videos/张洛琳.mp4'
};

async function playCelebrationVideo() {
  const video = document.getElementById('celebration-video');
  const container = document.getElementById('celebration-video-container');
  if (!video || !container) return;
  
  const videoUrl = videoMap[window.state.userName] || null;
  
  if (!videoUrl) {
    console.log('未找到该用户的专属视频，使用Canvas动画:', window.state.userName);
    container.style.display = 'none';
    createCelebrationCanvas();
    setTimeout(() => destroyCelebrationCanvas(), 30000);
    return;
  }
  
  video.muted = true; video.playsinline = true; video.loop = true; video.preload = 'auto';
  
  try {
    video.src = videoUrl;
    const onCanPlay = () => {
      container.style.display = 'block';
      video.play().then(() => console.log('视频播放成功:', videoUrl)).catch(() => { container.style.display = 'none'; createCelebrationCanvas(); });
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadeddata', onCanPlay);
    };
    const onError = () => {
      console.log('视频加载失败'); container.style.display = 'none'; createCelebrationCanvas();
      video.removeEventListener('error', onError); video.removeEventListener('canplay', onCanPlay);
    };
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadeddata', onCanPlay);
    video.addEventListener('error', onError);
    video.load();
    setTimeout(() => { video.pause(); video.removeAttribute('src'); video.load(); container.style.display = 'none'; destroyCelebrationCanvas(); }, 30000);
  } catch (e) { console.log('视频播放失败:', e); container.style.display = 'none'; createCelebrationCanvas(); }
}

let celebrationCanvas = null;

function createCelebrationCanvas() {
  const container = document.createElement('div');
  container.className = 'celebration-canvas-container';
  container.id = 'celebration-canvas-container';
  container.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9998;';
  document.body.appendChild(container);
  
  const canvas = document.createElement('canvas');
  canvas.width = window.innerWidth; canvas.height = window.innerHeight;
  canvas.style.cssText = 'width:100%;height:100%;';
  container.appendChild(canvas);
  
  celebrationCanvas = { container, canvas };
  const ctx = canvas.getContext('2d');
  const particles = [];
  for (let i = 0; i < 80; i++) {
    particles.push({ x: Math.random()*canvas.width, y: Math.random()*canvas.height, size: Math.random()*6+2, speedX: (Math.random()-0.5)*1.5, speedY: Math.random()*1.5+0.5, color: ['#ffd700','#ff6b6b','#4ecdc4','#45b7d1','#96ceb4'][Math.floor(Math.random()*5)], opacity: Math.random()*0.6+0.3 });
  }
  function animate() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p => { p.x+=p.speedX; p.y+=p.speedY; if(p.x<0||p.x>canvas.width)p.speedX*=-1; if(p.y<0||p.y>canvas.height)p.speedY*=-1; ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fillStyle=p.color;ctx.globalAlpha=p.opacity;ctx.fill(); });
    ctx.globalAlpha=1;
    celebrationCanvas.animId = requestAnimationFrame(animate);
  }
  animate();
}

function destroyCelebrationCanvas() {
  if (!celebrationCanvas) return;
  cancelAnimationFrame(celebrationCanvas.animId);
  if (celebrationCanvas.container && celebrationCanvas.container.parentNode) celebrationCanvas.container.remove();
  celebrationCanvas = null;
}

function showCelebration(score) {
  const overlay = document.getElementById('celebration-overlay');
  if (!overlay) { console.warn('celebration-overlay 不存在'); return; }
  
  const scoreEl = document.getElementById('celebration-score');
  if (scoreEl) scoreEl.textContent = `${score} 分`;
  overlay.style.display = 'flex';

  playCelebrationVideo();
  createCelebrationCanvas();

  // emoji 飘落
  const emojis = ['🎉','🎊','⭐','🌟','💫','🏆','🥇','👏','💯','🎈'];
  for (let i = 0; i < 30; i++) {
    setTimeout(() => {
      const e = document.createElement('div');
      e.textContent = emojis[Math.floor(Math.random()*emojis.length)];
      e.style.cssText = `position:fixed;left:${Math.random()*100}vw;top:-30px;font-size:${24+Math.random()*20}px;pointer-events:none;z-index:9999;animation:fall ${3+Math.random()*2}s linear forwards;opacity:0.8;`;
      document.body.appendChild(e);
      setTimeout(()=>e.remove(),5000);
    }, i*80);
  }

  // 5秒后显示抽奖按钮
  setTimeout(() => { const b=document.getElementById('btn-lottery');if(b)b.style.display='inline-block'; }, 5000);

  // 30秒后自动关闭
  setTimeout(() => { if(overlay.style.display==='flex'){overlay.style.display='none';const b=document.getElementById('btn-lottery');if(b)b.style.display='none';} }, 30000);

  overlay.onclick = () => { overlay.style.display='none'; const b=document.getElementById('btn-lottery');if(b)b.style.display='none'; };
}

window.showConfirmDialog = showConfirmDialog;
window.renderQuestionNav = renderQuestionNav;
window.renderQuestion = renderQuestion;
window.addKeyboardListeners = addKeyboardListeners;
window.removeKeyboardListeners = removeKeyboardListeners;
window.exitExam = exitExam;
window.resetExam = resetExam;
window.showResult = showResult;
window.startExamFromPaper = startExamFromPaper;
window.showCelebration = showCelebration;
