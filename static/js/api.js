const API_BASE = '/api';

async function request(method, path, data = null, isFile = false) {
  const opts = { method, headers: {} };
  if (data && !isFile) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(data);
  }
  if (data && isFile) opts.body = data;
  const res = await fetch(`${API_BASE}${path}`, opts);
  const json = await res.json();
  if (json.code !== 200 && json.code !== 201) throw new Error(json.message || json.error || '请求失败');
  return json.data;
}

const api = {
  getGrades: () => request('GET', '/grades'),
  getTypes: () => request('GET', '/types'),
  getQuestions: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return request('GET', `/questions${query ? '?' + query : ''}`);
  },
  getQuestion: (id) => request('GET', `/questions/${id}`),
  createQuestion: (data) => request('POST', '/questions', data),
  deleteQuestion: (id) => request('DELETE', `/questions/${id}`),
  importFile: (formData) => request('POST', '/questions/import', formData, true),
  scanBank: () => request('POST', '/questions/scan-bank'),
  clearBank: () => request('POST', '/questions/clear'),
  resetBank: () => request('POST', '/questions/reset'),
  getPapers: (userName) => {
    const params = userName ? `?user_name=${encodeURIComponent(userName)}` : '';
    return request('GET', `/papers${params}`);
  },
  getPaper: (id) => request('GET', `/papers/${id}`),
  deletePaper: (id) => request('DELETE', `/papers/${id}`),
  startExam: (gradeId, userName, paperId = null, typeIds = null) => {
    const data = { grade_id: gradeId, user_name: userName };
    if (paperId) data.paper_id = paperId;
    if (typeIds && typeIds.length > 0) data.type_ids = typeIds;
    return request('POST', '/exams/start', data);
  },
  getExamStatus: (examId) => request('GET', `/exams/${examId}`),
  submitAnswer: (examId, questionId, userAnswer) => request('POST', `/exams/${examId}/submit`, { question_id: questionId, user_answer: userAnswer }),
  getAnswer: (examId, questionId) => request('GET', `/exams/${examId}/answer/${questionId}`),
  completeExam: (examId) => request('GET', `/exams/${examId}/result`),
  submitAllAnswers: (examId, answers) => request('POST', `/exams/${examId}/submit-all`, { answers }),
  getExamHistory: (userName) => request('GET', `/exams/history?user_name=${encodeURIComponent(userName)}`),
  getAllExamHistory: (userName) => {
    const params = userName ? `?user_name=${encodeURIComponent(userName)}` : '';
    return request('GET', `/exams/history/all${params}`);
  },
  getExamDetails: (examId) => request('GET', `/exams/${examId}/details`),
  checkPaperPerfect: (userName, paperId) => request('GET', `/exams/check-paper-perfect?user_name=${encodeURIComponent(userName)}&paper_id=${paperId}`),
  login: (username) => request('POST', '/users/login', { username }),
  registerExaminer: (username, allowedGrades) => request('POST', '/users', { username, allowedGrades }),
  getAllUsers: () => request('GET', '/users'),
  getUser: (username) => request('GET', `/users/${username}`),
  updateUser: (id, role, allowedGrades) => request('PUT', `/users/${id}`, { role, allowedGrades }),
  deleteUser: (id) => request('DELETE', `/users/${id}`),
  drawLottery: (examId, userName) => request('POST', '/lottery/draw', { exam_id: examId, user_name: userName }),
  getUserLotteryRecords: (userName) => request('GET', `/lottery/records?user_name=${encodeURIComponent(userName)}`),
  getAllLotteryRecords: () => request('GET', '/lottery/records/all'),
  updateRedeemStatus: (id, isRedeemed) => request('PUT', '/lottery/redeem', { id, is_redeemed: isRedeemed }),
  getPrizes: async () => (await request('GET', '/lottery/prizes')).prizes || [],
  demoDraw: (userName) => request('POST', '/lottery/demo', { user_name: userName }),
  adminDraw: (adminName, targetUser) => request('POST', '/lottery/admin-draw', { admin_name: adminName, target_user: targetUser }),
  getAllPrizes: () => request('GET', '/prizes'),
  createPrize: (name, emoji, color, probability) => request('POST', '/prizes', { name, emoji, color, base_probability: probability }),
  updatePrize: (id, name, emoji, color, probability) => request('PUT', `/prizes/${id}`, { name, emoji, color, base_probability: probability }),
  deletePrize: (id) => request('DELETE', `/prizes/${id}`),
  getDynamicProbabilities: (questionCount) => request('GET', `/prizes/dynamic?question_count=${questionCount}`),
  getWrongAnswers: (userName, page = 1, limit = 10) => request('GET', `/wrong-answers/user/${encodeURIComponent(userName)}?page=${page}&limit=${limit}`),
  getWrongAnswerCount: (userName) => request('GET', `/wrong-answers/user/${encodeURIComponent(userName)}/count`),
  deleteWrongAnswer: (id) => request('DELETE', `/wrong-answers/${id}`),
  clearWrongAnswers: (userName) => request('DELETE', `/wrong-answers/user/${encodeURIComponent(userName)}`),
  practiceWrongAnswers: (userName, questionIds) => request('POST', '/wrong-answers/practice', { userName, questionIds })
};

window.api = api;
window.request = request;
