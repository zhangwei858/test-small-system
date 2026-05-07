
function isReadingExam() {
  return state.questions.some(q => q.reading_content);
}

function startReadingExam() {
  const readingQuestions = state.questions.filter(q => q.reading_content);
  if (readingQuestions.length === 0) return false;

  const firstQ = readingQuestions[0];
  const passageContent = firstQ.reading_content;
  const passageTitle = firstQ.reading_title || '';

  document.getElementById('reading-exam-grade').textContent =
    document.getElementById('exam-grade').textContent;
  document.getElementById('reading-exam-progress').textContent =
    `阅读理解 共 ${readingQuestions.length} 题`;

  const passageHtml = passageTitle
    ? `<h3 class="passage-title">${passageTitle}</h3>${formatPassageContent(passageContent)}`
    : formatPassageContent(passageContent);

  document.getElementById('reading-passage-content').innerHTML = passageHtml;
  document.getElementById('reading-questions-count').textContent =
    `共 ${readingQuestions.length} 题`;

  renderReadingQuestions(readingQuestions);

  navigateTo('reading-exam');

  const secondsPerQuestion = 40;
  const totalSeconds = readingQuestions.length * secondsPerQuestion;
  state.timeLeft = totalSeconds;
  updateReadingTimerDisplay();
  state.timerInterval = setInterval(() => {
    state.timeLeft--;
    updateReadingTimerDisplay();
    if (state.timeLeft <= 0) {
      stopTimer();
      showToast('考试时间已到！', 'error');
      setTimeout(() => finishExam(), 2000);
    }
  }, 1000);

  return true;
}

function formatPassageContent(content) {
  const paragraphs = content.split(/\n+/).filter(p => p.trim());
  return paragraphs.map(p => `<p class="passage-paragraph">${p.trim()}</p>`).join('');
}

function renderReadingQuestions(readingQuestions) {
  const listEl = document.getElementById('reading-questions-list');

  listEl.innerHTML = readingQuestions.map((q, idx) => {
    const globalIdx = state.questions.indexOf(q);
    const options = parseOptions(q.options);
    const userAnswer = state.answers[q.id];
    const isAnswered = !!userAnswer;

    return `
      <div class="reading-question-card ${isAnswered ? 'answered' : ''}" id="reading-q-${q.id}">
        <div class="reading-question-header">
          <span class="reading-question-number">第 ${idx + 1} 题</span>
          <span class="reading-question-points">${q.points} 分</span>
        </div>
        <div class="reading-question-content">${q.content}</div>
        <div class="reading-question-options">
          ${options.map((opt, optIdx) => {
            const letter = String.fromCharCode(65 + optIdx);
            const isSelected = userAnswer === letter;
            return `
              <div class="reading-option-item ${isSelected ? 'selected' : ''}"
                   onclick="selectReadingOption(${q.id}, '${letter}')">
                <div class="reading-option-radio ${isSelected ? 'selected' : ''}"></div>
                <span>${opt}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');
}

function selectReadingOption(questionId, letter) {
  state.answers[questionId] = letter;

  const readingQuestions = state.questions.filter(q => q.reading_content);
  renderReadingQuestions(readingQuestions);

  updateReadingProgress(readingQuestions);
}

function updateReadingProgress(readingQuestions) {
  const answeredCount = readingQuestions.filter(q => state.answers[q.id]).length;
  document.getElementById('reading-exam-progress').textContent =
    `阅读理解 ${answeredCount}/${readingQuestions.length} 已答`;
}

function updateReadingTimerDisplay() {
  const minutes = Math.floor(state.timeLeft / 60);
  const seconds = state.timeLeft % 60;
  const timer = document.getElementById('reading-timer');
  timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  if (state.timeLeft <= 300) {
    timer.classList.add('warning');
  } else {
    timer.classList.remove('warning');
  }
}

function toggleReadingPanel() {
  const panel = document.getElementById('reading-passage-panel');
  const btn = document.getElementById('reading-toggle-btn');
  const isCollapsed = panel.classList.toggle('collapsed');

  if (isCollapsed) {
    btn.textContent = '展开';
  } else {
    btn.textContent = '收起';
  }
}

window.isReadingExam = isReadingExam;
window.startReadingExam = startReadingExam;
window.selectReadingOption = selectReadingOption;
window.toggleReadingPanel = toggleReadingPanel;
