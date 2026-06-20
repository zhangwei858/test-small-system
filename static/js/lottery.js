
async function drawLottery(examId, userName) {
  try {
    const data = await api.drawLottery(examId, userName);
    return data;
  } catch (e) {
    showToast(e.message, 'error');
    throw e;
  }
}

async function showLottery() {
  const overlay = document.getElementById('celebration-overlay');
  overlay.style.display = 'none';
  
  const lotteryOverlay = document.getElementById('lottery-overlay');
  lotteryOverlay.style.display = 'flex';
  
  await loadLotteryWheel();
}

function closeLottery() {
  const lotteryOverlay = document.getElementById('lottery-overlay');
  lotteryOverlay.style.display = 'none';
}

async function loadLotteryWheel() {
  try {
    const prizes = await api.getPrizes();
    renderLotteryWheel(prizes);
  } catch (e) {
    console.error('加载抽奖奖品失败:', e);
  }
}

function renderLotteryWheel(prizes) {
  const wheel = document.getElementById('lottery-wheel');
  const sliceAngle = 360 / prizes.length;
  
  let html = '';
  prizes.forEach((prize, index) => {
    const angle = sliceAngle * index;
    html += `
      <div class="lottery-segment" style="transform: rotate(${angle}deg)">
        <div class="segment-text" style="transform: rotate(${360 - angle - sliceAngle/2}deg)">
          ${prize.emoji} ${prize.name}
        </div>
      </div>
    `;
  });
  
  wheel.innerHTML = html + '<div class="lottery-wheel-center"></div>';
}

async function spinWheel() {
  const wheel = document.getElementById('lottery-wheel');
  const spinBtn = document.getElementById('btn-spin');

  if (wheel.classList.contains('spinning')) return;

  spinBtn.disabled = true;

  try {
    const result = await drawLottery(state.exam.id, state.userName);

    const winningPrize = result.prize || result;
    const prizes = await api.getPrizes();
    const prizeIndex = prizes.findIndex(p => p.name === winningPrize.name);
    const targetAngle = prizeIndex >= 0 ? (360 / prizes.length) * prizeIndex + 180 : Math.random() * 360;
    const spinDegrees = 360 * 5 + (360 - targetAngle);

    wheel.classList.add('spinning');
    wheel.style.transform = `rotate(${spinDegrees}deg)`;

    setTimeout(() => {
      wheel.classList.remove('spinning');
      showLotteryResult(winningPrize);
      spinBtn.disabled = false;
    }, 4000);
  } catch (e) {
    showToast(e.message, 'error');
    spinBtn.disabled = false;
  }
}

function showLotteryResult(prize) {
  if (!prize) { showToast('抽奖结果异常', 'error'); return; }

  const resultDiv = document.getElementById('lottery-result');
  resultDiv.innerHTML = `
    <div class="result-emoji">${prize.emoji || '🎁'}</div>
    <div class="result-text">恭喜获得：${prize.name || '神秘奖品'}</div>
  `;
  resultDiv.style.display = 'block';
}

async function showLotteryFromResult() {
  showLottery();
}

async function loadLotteryRecords() {
  try {
    const data = await api.getUserLotteryRecords(state.userName);
    renderLotteryRecords(data);
  } catch (e) {
    console.error('加载中奖记录失败:', e);
    showLotteryEmpty();
  }
}

function renderLotteryRecords(records) {
  const container = document.getElementById('lottery-records-list');
  const emptyContainer = document.getElementById('lottery-empty');

  if (!records || records.length === 0) {
    showLotteryEmpty();
    return;
  }

  emptyContainer.style.display = 'none';

  container.innerHTML = records.map(record => {
    const date = new Date(record.created_at);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
    
    return `
      <div class="lottery-record-item">
        <div class="lottery-prize-emoji">${record.prize_emoji}</div>
        <div class="lottery-record-info">
          <div class="lottery-prize-name">${record.prize_name}</div>
          <div class="lottery-record-meta">
            <span>考试: ${record.exam_id}</span>
            <span>${dateStr}</span>
          </div>
        </div>
        <div class="lottery-record-status ${record.is_redeemed ? 'claimed' : 'unclaimed'}">
          ${record.is_redeemed ? '已兑现' : '未兑现'}
        </div>
      </div>
    `;
  }).join('');
}

function showLotteryEmpty() {
  document.getElementById('lottery-records-list').innerHTML = '';
  document.getElementById('lottery-empty').style.display = 'block';
}

// ===== 管理员指定抽奖 =====
let adminDrawTarget = null;

function showAdminDrawDialog() {
  document.body.insertAdjacentHTML('beforeend', `
    <div class="confirm-overlay" id="admin-draw-dialog" style="display:flex">
      <div class="confirm-dialog" style="max-width:420px">
        <div class="confirm-header">
          <h3>🎯 指定用户抽奖</h3>
          <button class="confirm-close" onclick="hideAdminDrawDialog()">✕</button>
        </div>
        <div class="confirm-body">
          <div class="form-group">
            <label>选择抽奖用户</label>
            <select id="admin-draw-user-select" class="form-input">
              <option value="">请选择用户</option>
            </select>
          </div>
          <p style="color:#6b7280;font-size:13px;margin-top:8px">提示：管理员指定抽奖无需考试满分，直接抽奖并保存到该用户的中奖记录。</p>
        </div>
        <div class="confirm-actions">
          <button class="btn btn-secondary" onclick="hideAdminDrawDialog()">取消</button>
          <button class="btn btn-primary" onclick="confirmAdminDraw()">开始抽奖</button>
        </div>
      </div>
    </div>
  `);
  loadUsersForAdminDraw();
}

function hideAdminDrawDialog() {
  const d = document.getElementById('admin-draw-dialog');
  if (d) d.remove();
}

async function loadUsersForAdminDraw() {
  try {
    const users = await api.getAllUsers();
    const select = document.getElementById('admin-draw-user-select');
    if (!select) return;
    const candidates = (users || []).filter(u => u.role !== 'admin');
    select.innerHTML = '<option value="">请选择用户</option>' +
      candidates.map(u => `<option value="${u.username}">${u.username}</option>`).join('');
  } catch (e) {
    showToast('加载用户列表失败', 'error');
    console.error(e);
  }
}

async function confirmAdminDraw() {
  const target = document.getElementById('admin-draw-user-select').value;
  if (!target) { showToast('请选择抽奖用户', 'error'); return; }
  adminDrawTarget = target;
  hideAdminDrawDialog();
  await openAdminLotteryWheel();
}

async function openAdminLotteryWheel() {
  const overlay = document.getElementById('admin-lottery-overlay');
  const info = document.getElementById('admin-draw-target-info');
  if (info) info.textContent = `抽奖用户：${adminDrawTarget}`;
  overlay.style.display = 'flex';
  const resultDiv = document.getElementById('admin-lottery-result');
  if (resultDiv) resultDiv.style.display = 'none';
  const wheel = document.getElementById('admin-lottery-wheel');
  if (wheel) wheel.style.transform = 'rotate(0deg)';
  await loadAdminLotteryWheel();
}

function closeAdminLottery() {
  document.getElementById('admin-lottery-overlay').style.display = 'none';
  adminDrawTarget = null;
  if (window.state.userRole === 'admin') loadRedeemRecords();
}

async function loadAdminLotteryWheel() {
  try {
    const prizes = await api.getPrizes();
    renderAdminLotteryWheel(prizes);
  } catch (e) {
    console.error('加载抽奖奖品失败:', e);
    showToast('加载奖品失败', 'error');
  }
}

function renderAdminLotteryWheel(prizes) {
  const wheel = document.getElementById('admin-lottery-wheel');
  if (!wheel) return;
  const sliceAngle = 360 / prizes.length;
  let html = '';
  prizes.forEach((prize, index) => {
    const angle = sliceAngle * index;
    html += `
      <div class="lottery-segment" style="transform: rotate(${angle}deg)">
        <div class="segment-text" style="transform: rotate(${360 - angle - sliceAngle/2}deg)">
          ${prize.emoji} ${prize.name}
        </div>
      </div>
    `;
  });
  wheel.innerHTML = html + '<div class="lottery-wheel-center"></div>';
}

async function spinAdminWheel() {
  const wheel = document.getElementById('admin-lottery-wheel');
  const spinBtn = document.getElementById('btn-admin-spin');
  if (!adminDrawTarget) { showToast('请先选择抽奖用户', 'error'); return; }
  if (wheel.classList.contains('spinning')) return;
  spinBtn.disabled = true;

  try {
    const result = await api.adminDraw(window.state.userName, adminDrawTarget);
    const winningPrize = result.prize || result;
    const prizes = await api.getPrizes();
    const prizeIndex = prizes.findIndex(p => p.name === winningPrize.name);
    const targetAngle = prizeIndex >= 0 ? (360 / prizes.length) * prizeIndex + 180 : Math.random() * 360;
    const spinDegrees = 360 * 5 + (360 - targetAngle);

    wheel.classList.add('spinning');
    wheel.style.transform = `rotate(${spinDegrees}deg)`;

    setTimeout(() => {
      wheel.classList.remove('spinning');
      showAdminLotteryResult(winningPrize);
      spinBtn.disabled = false;
    }, 4000);
  } catch (e) {
    showToast(e.message, 'error');
    spinBtn.disabled = false;
  }
}

function showAdminLotteryResult(prize) {
  if (!prize) { showToast('抽奖结果异常', 'error'); return; }
  const resultDiv = document.getElementById('admin-lottery-result');
  resultDiv.innerHTML = `
    <div class="result-emoji">${prize.emoji || '🎁'}</div>
    <div class="result-text">恭喜 ${adminDrawTarget} 获得：${prize.name || '神秘奖品'}</div>
  `;
  resultDiv.style.display = 'block';
  showToast(`已为 ${adminDrawTarget} 抽中：${prize.name}`, 'success');
}

window.showAdminDrawDialog = showAdminDrawDialog;
window.hideAdminDrawDialog = hideAdminDrawDialog;
window.confirmAdminDraw = confirmAdminDraw;
window.closeAdminLottery = closeAdminLottery;
window.spinAdminWheel = spinAdminWheel;