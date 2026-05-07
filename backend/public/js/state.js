const state = {
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

function setState(newState) {
  Object.assign(state, newState);
}

function resetExamState() {
  state.exam = null;
  state.questions = [];
  state.currentIndex = 0;
  state.answers = {};
  state.timerInterval = null;
  state.timeLeft = 1800;
  state.submitted = {};
}

window.state = state;
window.photoMap = photoMap;
window.setState = setState;
window.resetExamState = resetExamState;
