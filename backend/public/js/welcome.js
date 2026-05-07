async function submitName() {
  const name = document.getElementById('welcome-name').value.trim();
  if (!name) { showToast('请先输入你的名字','error'); document.getElementById('welcome-name').focus(); return; }
  try {
    const user = await api.login(name);
    window.state.userName = user.username; window.state.userRole = user.role;
    window.state.allowedGrades = user.allowed_grades || ['low','middle','high'];
  } catch (e) {
    console.error('登录失败:', e);
    window.state.userName = name; window.state.userRole = 'examiner';
    window.state.allowedGrades = ['low','middle','high'];
  }
  if (window.state.userName === '张伟') { showUserInfo(); navigateTo('manage'); return; }
  showUserInfo();
  document.getElementById('student-name').textContent = window.state.userName;
  const pp = photoMap[window.state.userName];
  if (pp) {
    const img = document.getElementById('student-photo');
    img.src = pp;
    img.onload = () => { document.getElementById('photo-placeholder').style.display='none'; };
    img.onerror = () => { document.getElementById('photo-placeholder').style.display='flex'; };
  } else {
    document.getElementById('photo-placeholder').style.display='flex';
    document.getElementById('student-photo').src = '';
  }
  try {
    const history = await api.getExamHistory(name);
    if (history && history.length > 0) {
      window.state.lastExamRecord = history.reduce((prev, curr) => new Date(curr.created_at) > new Date(prev.created_at) ? curr : prev);
    } else { window.state.lastExamRecord = null; }
  } catch (e) { console.error(e); window.state.lastExamRecord = null; }
  document.getElementById('welcome-step-1').style.display='none';
  document.getElementById('welcome-step-2').style.display='block';
  startCeremonyAnimation();
}

function startCeremonyAnimation() {
  const steps = [
    { text: '正在确认身份...', progress: 33 },
    { text: '正在准备考试环境...', progress: 66 },
    { text: '欢迎仪式准备完成！', progress: 100 }
  ];
  let cs = 0;
  const pf = document.getElementById('progress-fill'), pt = document.getElementById('progress-text');
  function animateStep() {
    if (cs < steps.length) {
      pt.textContent = steps[cs].text;
      let sp = cs > 0 ? steps[cs-1].progress : 0, ep = steps[cs].progress, cp = sp, dur = 800, st = Date.now();
      function up() {
        const el = Date.now()-st, pr = Math.min(el/dur,1);
        cp = sp + (ep-sp)*pr; pf.style.width=cp+'%';
        if (pr<1) requestAnimationFrame(up);
        else { cs++; setTimeout(animateStep,500); }
      }
      up();
    } else {
      setTimeout(() => {
        document.getElementById('welcome-step-2').style.display='none';
        document.getElementById('welcome-step-3').style.display='block';
        document.getElementById('welcome-greeting').textContent=`欢迎你，${window.state.userName}！`;
        startReadyTimer();
      }, 800);
    }
  }
  animateStep();
}

function startReadyTimer() {
  const hsd = document.getElementById('history-score'), nsd = document.getElementById('new-start');
  const hsv = document.getElementById('history-score-value'), hi = document.getElementById('history-info'), et = document.getElementById('encouragement-text');
  if (window.state.lastExamRecord) {
    hsd.style.display='block'; nsd.style.display='none';
    const sc = window.state.lastExamRecord.total_score||0, gn = window.state.lastExamRecord.grade_name||'';
    const cc = window.state.lastExamRecord.correct_count||0, tq = window.state.lastExamRecord.total_questions||1;
    const acc = Math.round((cc/tq)*100);
    let ds='未知';
    if (window.state.lastExamRecord.created_at||window.state.lastExamRecord.start_time) {
      const d=new Date(window.state.lastExamRecord.created_at||window.state.lastExamRecord.start_time);
      if(!isNaN(d.getTime())) ds=`${d.getMonth()+1}月${d.getDate()}日`;
    }
    hsv.textContent=`${sc}分`; hi.innerHTML=`正确率: ${acc}%<br/>年级: ${gn}<br/>时间: ${ds}`;
    const msgs=[`上次考了 ${sc} 分，这次一定能突破！💪`,`目标：超过 ${sc} 分！相信你可以！🔥`,`${sc} 分是你的起点，这次更高！🚀`,`超越自我，打破 ${sc} 分记录！🎯`];
    et.textContent = msgs[Math.floor(Math.random()*msgs.length)];
  } else { hsd.style.display='none'; nsd.style.display='block'; }
  let ct=3, te=document.getElementById('ready-timer');
  const iv=setInterval(()=>{ct--;te.textContent=ct;if(ct<=0){clearInterval(iv);te.style.display='none';}},1000);
}

async function startExamPreparation() {
  document.getElementById('welcome-step-3').style.display='none'; showUserInfo();
  const agm={'张洛琳':2,'张洛晗':1};
  const agid=agm[window.state.userName];
  if (agid) {
    try {
      const [papers,types]=await Promise.all([api.getPapers(),api.getTypes()]);
      const gp=papers.filter(p=>p.grade_id===agid);
      if(!gp.length){showToast('该年级暂无试卷','error');navigateTo('home');loadGrades();return;}
      window.state.selectedGradeId=agid;window.state.grades=await api.getGrades();window.state.types=types;window.state.selectedTypeIds=[];
      renderTypeCheckboxes(types);renderPaperCards(gp);navigateTo('papers');
    }catch(e){console.error(e);navigateTo('home');loadGrades();}
  }else{navigateTo('home');loadGrades();}
}

async function loadGrades() {
  try { window.state.grades=await api.getGrades(); renderGradeCards(); } catch(e){console.error(e);}
}

function renderGradeCards() {
  const c=document.getElementById('grade-cards'),emojis={low:'🌱',middle:'🌿',high:'🌳'};
  const fg=window.state.grades.filter(g=>{if(window.state.userRole==='admin')return true;return window.state.allowedGrades.includes(g.level);});
  if(!fg.length){c.innerHTML=`<div class="no-grade-message"><div class="no-grade-icon">🔒</div><div class="no-grade-text">你没有权限访问任何年级的试题</div><div class="no-grade-desc">请联系管理员开通权限</div></div>`;return;}
  c.innerHTML=fg.map(g=>`<div class="grade-card" onclick="selectGrade(${g.id})"><div class="emoji">${emojis[g.level]||'📖'}</div><div class="grade-name">${g.name}</div><div class="grade-info">点击选择试卷</div></div>`).join('');
}

async function selectGrade(gradeId) {
  try {
    const [papers,types]=await Promise.all([api.getPapers(),api.getTypes()]);
    const gp=papers.filter(p=>p.grade_id===gradeId);
    if(!gp.length){showToast('该年级暂无试卷','error');return;}
    window.state.selectedGradeId=gradeId;window.state.types=types;window.state.selectedTypeIds=[];
    renderTypeCheckboxes(types);renderPaperCards(gp);navigateTo('papers');
  } catch(e){showToast('加载试卷失败','error');console.error(e);}
}

function renderTypeCheckboxes(types) {
  document.getElementById('type-checkboxes').innerHTML=`
    <label class="type-checkbox type-checkbox-all"><input type="checkbox" id="select-all-types" onchange="toggleSelectAllTypes()"><span>全选</span></label>
    ${types.map(t=>`<label class="type-checkbox"><input type="checkbox" value="${t.id}" onclick="toggleType(${t.id})"><span>${t.name}</span></label>`).join('')}
  `;
}

function toggleSelectAllTypes() {
  const cb=document.getElementById('select-all-types'),cbs=document.querySelectorAll('.type-checkbox input[type="checkbox"]');
  if(cb.checked){cbs.forEach(x=>{if(x.id!=='select-all-types')x.checked=true;});window.state.selectedTypeIds=window.state.types.map(t=>t.id);}
  else{cbs.forEach(x=>{if(x.id!=='select-all-types')x.checked=false;});window.state.selectedTypeIds=[];}
}

function toggleType(typeId) {
  const i=window.state.selectedTypeIds.indexOf(typeId);
  if(i>-1)window.state.selectedTypeIds.splice(i,1);else window.state.selectedTypeIds.push(typeId);
}

function renderPaperCards(papers) {
  document.getElementById('paper-cards').innerHTML=papers.map(p=>`
    <div class="paper-card" onclick="startExamFromPaper(${window.state.selectedGradeId},${p.id})">
      <div class="paper-icon">📄</div><div class="paper-name">${p.name}</div>
      <div class="paper-info">题目数: ${p.question_count} | ${p.grade_name}</div>
      <div class="paper-date">创建时间: ${formatDate(p.created_at)}</div>
    </div>
  `).join('');
}

window.submitName = submitName;
window.startCeremonyAnimation = startCeremonyAnimation;
window.startReadyTimer = startReadyTimer;
window.startExamPreparation = startExamPreparation;
window.loadGrades = loadGrades;
window.selectGrade = selectGrade;
window.toggleSelectAllTypes = toggleSelectAllTypes;
window.toggleType = toggleType;
