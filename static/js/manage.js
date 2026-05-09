
async function loadManageData() {
  await loadGradesForManage();
  await loadTypesForManage();
  loadQuestions();
}

async function loadGradesForManage() {
  try {
    const data = await api.getGrades();
    state.grades = data;
    
    const select = document.getElementById('filter-grade');
    select.innerHTML = '<option value="">全部年级</option>' + 
      data.map(g => `<option value="${g.id}">${g.name}</option>`).join('');
  } catch (e) {
    console.error('加载年级失败:', e);
  }
}

async function loadTypesForManage() {
  try {
    const data = await api.getTypes();
    state.types = data;
    
    const select = document.getElementById('filter-type');
    select.innerHTML = '<option value="">全部题型</option>' + 
      data.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
  } catch (e) {
    console.error('加载题型失败:', e);
  }
}

async function loadQuestions() {
  const gradeId = document.getElementById('filter-grade').value;
  const typeId = document.getElementById('filter-type').value;
  
  try {
    const params = {};
    if (gradeId) params.grade_id = gradeId;
    if (typeId) params.type_id = typeId;
    
    const data = await api.getQuestions(params);
    renderQuestions(data);
  } catch (e) {
    console.error('加载题目失败:', e);
  }
}

function renderQuestions(questions) {
  const container = document.getElementById('questions-list');
  
  if (!questions || questions.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="display:block">
        <div class="empty-icon">📝</div>
        <div class="empty-title">暂无题目</div>
        <div class="empty-desc">请通过导入功能添加题目</div>
      </div>
    `;
    return;
  }

  container.innerHTML = questions.map(q => {
    const grade = state.grades.find(g => g.id === q.grade_id);
    const type = state.types.find(t => t.id === q.type_id);
    
    return `
      <div class="question-item">
        <div class="question-item-content">
          <div class="question-item-meta">
            <span class="tag tag-grade">${grade ? grade.name : '-'}</span>
            <span class="tag tag-type">${type ? type.name : '-'}</span>
            <span class="tag tag-points">${q.points}分</span>
          </div>
          <div class="question-item-text">${q.content}</div>
        </div>
        <div class="question-item-actions">
          <button class="btn-sm btn-delete" onclick="deleteQuestion(${q.id})">删除</button>
        </div>
      </div>
    `;
  }).join('');
}

async function deleteQuestion(id) {
  if (!confirm('确定要删除这道题目吗？')) return;
  
  try {
    await api.deleteQuestion(id);
    showToast('删除成功', 'success');
    loadQuestions();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function switchTab(tab) {
  document.querySelectorAll('#page-redeem-manage .tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('#page-redeem-manage .tab-content').forEach(c => c.style.display = 'none');

  if (tab === 'redemption') {
    document.querySelector('#page-redeem-manage .tab-btn:nth-child(1)').classList.add('active');
    document.getElementById('tab-redemption').style.display = '';
    loadRedeemRecords();
  } else if (tab === 'prizes') {
    document.querySelector('#page-redeem-manage .tab-btn:nth-child(2)').classList.add('active');
    document.getElementById('tab-prizes').style.display = '';
    loadPrizes();
  }
}

async function loadPrizes() {
  try {
    const data = await api.getAllPrizes();
    const prizes = data.prizes || [];
    document.getElementById('prize-count').textContent = prizes.length;
    document.getElementById('prize-total-probability').textContent = data.totalProbability + '%';
    renderPrizes(prizes);
  } catch (e) {
    console.error('加载奖项失败:', e);
  }
}

function renderPrizes(prizes) {
  const container = document.getElementById('prize-records-list');
  if (!prizes || !prizes.length) {
    container.innerHTML = '<p style="text-align:center;color:white;padding:40px">暂无奖项</p>';
    return;
  }
  container.innerHTML = prizes.map(p => `
    <div class="prize-record-item">
      <div class="prize-color-indicator" style="background:${p.color}"></div>
      <div class="prize-emoji">${p.emoji}</div>
      <div class="prize-info">
        <div class="prize-name">${p.name} ${p.is_default ? '<span class="default-badge">默认</span>' : ''}</div>
        <div class="prize-probability">基础概率: ${p.base_probability}%</div>
      </div>
      <div class="prize-record-actions">
        <button class="btn-sm btn-edit-prize" onclick="showEditPrizeModal(${p.id})">编辑</button>
        ${!p.is_default ? `<button class="btn-sm btn-delete-prize" onclick="deletePrize(${p.id})">删除</button>` : ''}
      </div>
    </div>
  `).join('');
}

function showAddPrizeModal() {
  document.getElementById('prize-id').value = '';
  document.getElementById('prize-name').value = '';
  document.getElementById('prize-emoji').value = '';
  document.getElementById('prize-color').value = '#ef4444';
  document.getElementById('prize-probability').value = '';
  document.getElementById('prize-modal-title').textContent = '添加奖项';
  document.getElementById('prize-modal').style.display = 'flex';
}

async function showEditPrizeModal(id) {
  try {
    const data = await api.getAllPrizes();
    const prize = (data.prizes || []).find(p => p.id === id);
    if (!prize) { showToast('奖项不存在', 'error'); return; }
    document.getElementById('prize-id').value = prize.id;
    document.getElementById('prize-name').value = prize.name;
    document.getElementById('prize-emoji').value = prize.emoji;
    document.getElementById('prize-color').value = prize.color;
    document.getElementById('prize-probability').value = prize.base_probability;
    document.getElementById('prize-modal-title').textContent = '编辑奖项';
    document.getElementById('prize-modal').style.display = 'flex';
  } catch (e) {
    showToast('加载奖项失败', 'error');
  }
}

function closePrizeModal() {
  document.getElementById('prize-modal').style.display = 'none';
}

async function savePrize() {
  const id = document.getElementById('prize-id').value;
  const name = document.getElementById('prize-name').value.trim();
  const emoji = document.getElementById('prize-emoji').value.trim();
  const color = document.getElementById('prize-color').value;
  const probability = parseFloat(document.getElementById('prize-probability').value);

  if (!name) { showToast('请输入奖项名称', 'error'); return; }
  if (!emoji) { showToast('请输入emoji图标', 'error'); return; }
  if (isNaN(probability) || probability < 0 || probability > 100) {
    showToast('概率值必须在0-100之间', 'error'); return;
  }

  try {
    if (id) {
      await api.updatePrize(parseInt(id), name, emoji, color, probability);
      showToast('奖项更新成功', 'success');
    } else {
      await api.createPrize(name, emoji, color, probability);
      showToast('奖项创建成功', 'success');
    }
    closePrizeModal();
    loadPrizes();
  } catch (e) {
    showToast(e.message || '操作失败', 'error');
  }
}

async function deletePrize(id) {
  if (!confirm('确定要删除该奖项吗？')) return;
  try {
    await api.deletePrize(id);
    showToast('删除成功', 'success');
    loadPrizes();
  } catch (e) {
    showToast(e.message || '删除失败', 'error');
  }
}

function showImportDialog() {
  document.getElementById('import-dialog').style.display = 'flex';
}

function hideImportDialog() {
  document.getElementById('import-dialog').style.display = 'none';
  document.getElementById('file-input').value = '';
  document.getElementById('import-grade-select').value = '';
}

async function uploadFile() {
  const fileInput = document.getElementById('file-input');
  const gradeSelect = document.getElementById('import-grade-select');
  
  if (!fileInput.files || fileInput.files.length === 0) {
    showToast('请选择文件', 'error');
    return;
  }
  
  if (!gradeSelect.value) {
    showToast('请选择年级', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('file', fileInput.files[0]);
  formData.append('grade_id', gradeSelect.value);

  try {
    const result = await api.importFile(formData);
    showImportResult(result);
    hideImportDialog();
    loadQuestions();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function scanQuestionBank() {
  try {
    const result = await api.scanBank();
    showImportResult(result);
    loadQuestions();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

function showImportResult(result) {
  const successCount = result.success_count || 0;
  const failCount = result.fail_count || 0;
  const totalCount = successCount + failCount;
  const successList = result.success_list || [];
  const failList = result.fail_list || [];

  let successHtml = '';
  if (successList.length > 0) {
    successHtml = `
      <div class="result-section success-section">
        <h4>✅ 成功导入 (${successCount} 题)</h4>
        <div class="result-list">
          ${successList.slice(0, 10).map((q, idx) => `
            <div class="result-item success-item">
              <span class="item-number">${idx + 1}.</span>
              <span class="item-content">${q.content}</span>
              <span class="item-meta">${q.type_name} | ${q.points}分</span>
            </div>
          `).join('')}
          ${successList.length > 10 ? `<div class="result-more">... 还有 ${successList.length - 10} 题</div>` : ''}
        </div>
      </div>
    `;
  }

  let failHtml = '';
  if (failList.length > 0) {
    failHtml = `
      <div class="result-section fail-section">
        <h4>❌ 导入失败 (${failCount} 题)</h4>
        <div class="result-list">
          ${failList.slice(0, 10).map((item, idx) => `
            <div class="result-item fail-item">
              <span class="item-number">${idx + 1}.</span>
              <span class="item-content">${item.content || '未知内容'}</span>
              <span class="item-error">${item.error || '解析失败'}</span>
            </div>
          `).join('')}
          ${failList.length > 10 ? `<div class="result-more">... 还有 ${failList.length - 10} 题失败</div>` : ''}
        </div>
      </div>
    `;
  }

  const dialogHtml = `
    <div class="import-result-overlay" id="import-result-overlay" style="display:flex">
      <div class="import-result-dialog">
        <div class="result-header">
          <h3>📊 导入结果</h3>
          <button class="result-close" onclick="hideImportResult()">✕</button>
        </div>
        <div class="result-summary">
          <div class="summary-row">
            <span class="summary-label">总题目数</span>
            <span class="summary-value total">${totalCount}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">成功导入</span>
            <span class="summary-value success">${successCount}</span>
          </div>
          <div class="summary-row">
            <span class="summary-label">导入失败</span>
            <span class="summary-value fail">${failCount}</span>
          </div>
        </div>
        ${successHtml}
        ${failHtml}
        <div class="result-actions">
          <button class="btn btn-primary" onclick="hideImportResult()">确定</button>
        </div>
      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', dialogHtml);
}

function hideImportResult() {
  const overlay = document.getElementById('import-result-overlay');
  if (overlay) overlay.remove();
}

async function resetAndRescan() {
  if (!confirm('确定要清空并重扫题库吗？此操作不可撤销！')) return;
  
  try {
    const result = await api.resetBank();
    showImportResult(result);
    loadQuestions();
  } catch (e) {
    showToast(e.message, 'error');
  }
}

async function clearQuestionBank() {
  if (!confirm('确定要清空题库吗？此操作不可撤销！')) return;
  
  try {
    await api.clearBank();
    showToast('清空完成', 'success');
    loadQuestions();
  } catch (e) {
    showToast(e.message, 'error');
  }
}