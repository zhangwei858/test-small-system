
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