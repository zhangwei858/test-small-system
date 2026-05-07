
async function loadWrongAnswers() {
  try {
    const data = await api.getWrongAnswers(state.userName);
    renderWrongAnswers(data.data || data, data.total || (data.data || data).length);
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
    if (countBadge) countBadge.textContent = '0';
    return;
  }

  if (emptyContainer) emptyContainer.style.display = 'none';
  if (countBadge) countBadge.textContent = total;

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
            <span class="user-answer"><span class="label">你的答案：</span><span class="value wrong">${item.user_answer || '未作答'}</span></span>
            <span class="correct-answer"><span class="label">正确答案：</span><span class="value correct">${item.correct_answer}</span></span>
          </div>
        </div>
        <div class="wrong-answer-actions">
          <button class="btn-sm btn-delete" onclick="window.deleteWrongAnswer && window.deleteWrongAnswer(${item.id})">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

function showWrongAnswersEmpty() {
  const container = document.getElementById('wrong-answers-list');
  const emptyContainer = document.getElementById('wrong-answers-empty');
  const countBadge = document.getElementById('wrong-answers-count');
  if (container) container.innerHTML = '';
  if (emptyContainer) emptyContainer.style.display = 'block';
  if (countBadge) countBadge.textContent = '0';
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
    const questionIds = (data.data || data).map(item => item.question_id);

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
