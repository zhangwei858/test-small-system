console.log('Exam System loading...');

function searchHistory() {
  const userName = window.state?.userName || '';
  const isAdmin = userName === '张伟';
  const inputName = document.getElementById('history-name-input')?.value?.trim();
  const searchName = isAdmin ? inputName : userName;
  (async () => {
    try {
      let data;
      if (searchName) { data = await api.getExamHistory(searchName); } else { data = await api.getAllExamHistory(); }
      const c = document.getElementById('history-list'), s = document.getElementById('history-summary'), e = document.getElementById('history-empty');
      if (!data || !data.length) { if(s)s.style.display='none'; if(c)c.innerHTML=''; if(e)e.style.display='block'; return; }
      if(s)s.style.display='block'; if(e)e.style.display='none';
      const sorted=[...data].sort((a,b)=>new Date(b.start_time||b.created_at)-new Date(a.start_time||a.created_at));
      if(c) c.innerHTML=sorted.map(r=>{
        const sc=r.total_score||0,acc=r.accuracy||0;
        const d=new Date(r.start_time||r.created_at);
        const ds=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        let cls=acc>=90?'excellent':acc>=70?'good':acc>=60?'normal':'poor';
        return `<div class="history-item" onclick="showExamDetails(${r.id})"><div class="history-score-badge ${cls}">${sc}</div><div class="history-info"><div class="history-name">${r.user_name||'未知'}</div><div class="history-meta"><span>年级: ${r.grade_name||'-'}</span><span>正确率: ${acc}%</span></div></div><div class="history-date">${ds}</div><div class="history-arrow">›</div></div>`;
      }).join('');
    } catch(err){console.error(err);}
  })();
}

async function showExamDetails(examId) {
  try {
    const response = await api.getExamDetails(examId);
    const exam = response.exam || response;
    const answers = response.answers || [];
    const grouped = response.grouped_questions || {};
    const wrong = answers.filter(a => !a.is_correct);

    let qHtml = '';
    for (const [type, qs] of Object.entries(grouped)) {
      qHtml += `<div class="question-section"><h4>${type} (${qs.length}题)</h4>` + qs.map((q,i)=>{
        return `<div class="question-item ${q.is_correct?'correct':'wrong'}"><div class="question-header"><span class="question-num">第${i+1}题</span><span class="question-status ${q.is_correct?'status-correct':'status-wrong'}">${q.is_correct?'✓ 正确':'✗ 错误'}</span></div><div class="question-text">${q.content}</div><div class="answer-result"><span class="result-item"><strong>你的答案:</strong> <span class="${q.is_correct?'text-correct':'text-wrong'}">${q.user_answer||'未作答'}</span></span>${!q.is_correct?`<span class="result-item"><strong>正确答案:</strong> <span class="text-correct">${q.answer}</span></span>`:''}</div></div>`;
      }).join('') + '</div>';
    }

    let modalContent = `
      <div class="modal-header"><h3>${exam.user_name||''} 的考试详情</h3><button class="modal-close" onclick="closeModal()">×</button></div>
      <div class="modal-body">
        <div class="exam-summary">
          <div class="summary-row"><span class="label">得分:</span><span>${exam.total_score||0}分</span></div>
          <div class="summary-row"><span class="label">正确率:</span><span>${Math.round(((exam.correct_count||0)/(exam.total_questions||1))*100)}%</span></div>
          <div class="summary-row"><span class="label">总题数:</span><span>${exam.total_questions||0}</span></div>
        </div>
        <div class="all-questions"><h4>📝 答题详情</h4>${qHtml}</div>
        <div class="wrong-questions"><h4>❌ 做错的题目 (${wrong.length}题)</h4>${wrong.length?wrong.map((a,i)=>`<div class="wrong-item"><div class="question-number">第${i+1}题</div><div class="question-content">${a.content}</div><div class="answer-info"><span class="user-answer">你的答案: ${a.user_answer||'未作答'}</span><span class="correct-answer">正确答案: ${a.answer}</span></div></div>`).join(''):'<p class="no-wrong">没有做错的题目！太棒了</p>'}</div>
      </div>`;

    const mc = document.getElementById('modal-content'), m = document.getElementById('modal');
    if(mc) mc.innerHTML=modalContent; if(m) m.style.display='block';
  } catch(e){console.error(e);showToast('获取考试详情失败','error');}
}

function closeModal(){const m=document.getElementById('modal');if(m)m.style.display='none';}
function reviewExam(){window.state.currentIndex=0;navigateTo('exam');const b=document.getElementById('btn-submit');if(b)b.style.display='none';if(typeof renderQuestion==='function')renderQuestion();}
async function toggleRedeem(recordId,isRedeemed){try{await api.updateRedeemStatus(recordId,isRedeemed);showToast(isRedeemed?'已标记为兑现':'已取消兑现','success');loadRedeemRecords();}catch(e){showToast('更新失败','error');}}

function showAddUserModal(){
  document.body.insertAdjacentHTML('beforeend',`<div class="confirm-overlay" id="user-modal" style="display:flex"><div class="confirm-dialog" style="max-width:480px"><div class="confirm-header"><h3>➕ 注册新用户</h3><button class="confirm-close" onclick="(document.getElementById('user-modal')||{}).remove()">✕</button></div><div class="confirm-body"><div class="form-group"><label>用户名</label><input type="text" id="new-username" class="form-input" placeholder="请输入用户名"></div><div class="form-group"><label>允许访问的年级</label><div class="grade-checkboxes"><label><input type="checkbox" name="allowed-grade" value="low"> 低年级</label><label><input type="checkbox" name="allowed-grade" value="middle"> 中年级</label><label><input type="checkbox" name="allowed-grade" value="high"> 高年级</label></div></div></div><div class="confirm-actions"><button class="btn btn-secondary" onclick="(document.getElementById('user-modal')||{}).remove()">取消</button><button class="btn btn-primary" onclick="addUser()">确认注册</button></div></div></div>`);
}
function showEditUserModal(id,username,role,allowedGrades){
  const grades=JSON.parse(allowedGrades);
  document.body.insertAdjacentHTML('beforeend',`<div class="confirm-overlay" id="user-modal" style="display:flex"><div class="confirm-dialog" style="max-width:480px"><div class="confirm-header"><h3>✏️ 编辑用户</h3><button class="confirm-close" onclick="(document.getElementById('user-modal')||{}).remove()">✕</button></div><div class="confirm-body"><div class="form-group"><label>用户名</label><input type="text" id="edit-username" class="form-input" value="${username}" disabled><input type="hidden" id="edit-user-id" value="${id}"></div><div class="form-group"><label>允许访问的年级</label><div class="grade-checkboxes"><label><input type="checkbox" name="allowed-grade" value="low" ${grades.includes('low')?'checked':''}> 低年级</label><label><input type="checkbox" name="allowed-grade" value="middle" ${grades.includes('middle')?'checked':''}> 中年级</label><label><input type="checkbox" name="allowed-grade" value="high" ${grades.includes('high')?'checked':''}> 高年级</label></div></div></div><div class="confirm-actions"><button class="btn btn-secondary" onclick="(document.getElementById('user-modal')||{}).remove()">取消</button><button class="btn btn-primary" onclick="updateUser()">保存修改</button></div></div></div>`);
}
function hideUserModal(){(document.getElementById('user-modal')||{}).remove();}

async function addUser(){
  const username=(document.getElementById('new-username')||{}).value?.trim();
  const cbs=document.querySelectorAll('input[name="allowed-grade"]:checked');
  const allowedGrades=Array.from(cbs).map(cb=>cb.value);
  if(!username){showToast('请输入用户名','error');return;}
  if(!allowedGrades.length){showToast('请至少选择一个年级','error');return;}
  try{await api.registerExaminer(username,allowedGrades);showToast('注册成功','success');hideUserModal();loadUsers();}catch(e){showToast(e.message,'error');}}
async function updateUser(){
  const id=(document.getElementById('edit-user-id')||{}).value;
  const cbs=document.querySelectorAll('input[name="allowed-grade"]:checked');
  const allowedGrades=Array.from(cbs).map(cb=>cb.value);
  if(!allowedGrades.length){showToast('请至少选择一个年级','error');return;}
  try{await api.updateUser(id,'examiner',allowedGrades);showToast('更新成功','success');hideUserModal();loadUsers();}catch(e){showToast(e.message,'error');}}
async function deleteUser(id,username){
  if(!confirm(`确定要删除用户 "${username}" 吗？`))return;
  try{await api.deleteUser(id);showToast('删除成功','success');loadUsers();}catch(e){showToast(e.message,'error');}
}

window.searchHistory = searchHistory;
window.showExamDetails = showExamDetails;
window.closeModal = closeModal;
window.reviewExam = reviewExam;
window.toggleRedeem = toggleRedeem;
window.showAddUserModal = showAddUserModal;
window.showEditUserModal = showEditUserModal;
window.hideUserModal = hideUserModal;
window.addUser = addUser;
window.updateUser = updateUser;
window.deleteUser = deleteUser;

console.log('Exam System loaded');
