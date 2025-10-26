// Elements
const genForm = document.getElementById('generate-form');
const generateBtn = document.getElementById('generate-btn');
const topicInput = document.getElementById('topic');
const numInput = document.getElementById('num');
const difficultySelect = document.getElementById('difficulty');
const modelSelect = document.getElementById('modelSelect');
const customModelInput = document.getElementById('customModel');
const genStatus = document.getElementById('gen-status');
const quizSection = document.getElementById('quiz');
const quizForm = document.getElementById('quiz-form');
const submitBtn = document.getElementById('submit-answers');
const resultsSection = document.getElementById('results');
const scoreDiv = document.getElementById('score');
const detailsDiv = document.getElementById('details');
const toastRoot = document.getElementById('toast-root');

let currentQuizId = null;
let currentQuestions = [];

// Utils
function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}

function smoothScrollIntoView(el) {
  el.scrollIntoView({behavior: 'smooth', block: 'start'});
}

function setBusy(section, busy) {
  section.setAttribute('aria-busy', busy ? 'true' : 'false');
}

function setGenBusy(busy) {
  if (busy) {
    genStatus.innerHTML = '<span class="spinner" aria-hidden="true"></span> Generating quiz...';
    if (generateBtn) generateBtn.disabled = true;
    topicInput.disabled = true;
    numInput.disabled = true;
    if (difficultySelect) difficultySelect.disabled = true;
    if (modelSelect) modelSelect.disabled = true;
    if (customModelInput) customModelInput.disabled = true;
  } else {
    genStatus.textContent = '';
    if (generateBtn) generateBtn.disabled = false;
    topicInput.disabled = false;
    numInput.disabled = false;
    if (difficultySelect) difficultySelect.disabled = false;
    if (modelSelect) modelSelect.disabled = false;
    if (customModelInput) customModelInput.disabled = false;
  }
}

function setSubmitBusy(busy) {
  if (!submitBtn) return;
  if (busy) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Submitting...';
  } else {
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="btn-label">Submit Answers</span>';
  }
}

function createToast(message) {
  try {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = message;
    toastRoot.classList.remove('sr-only');
    toastRoot.appendChild(t);
    setTimeout(() => {
      t.remove();
      if (!toastRoot.firstChild) toastRoot.classList.add('sr-only');
    }, 3500);
  } catch (e) {
    // Fallback
    alert(message);
  }
}

function renderQuiz(questions) {
  quizForm.innerHTML = '';
  questions.forEach((q, idx) => {
    const fieldset = document.createElement('fieldset');
    fieldset.className = 'question';
    const legend = document.createElement('legend');
    legend.className = 'q-title';
    legend.textContent = `${idx + 1}. ${q.prompt}`;
    fieldset.appendChild(legend);

    q.choices.forEach((choice, cIdx) => {
      const id = `${q.id}_${cIdx}`;
      const label = document.createElement('label');
      label.className = 'choice';

      const input = document.createElement('input');
      input.type = 'radio';
      input.name = q.id;
      input.value = String(cIdx);
      input.id = id;

      const span = document.createElement('span');
      span.textContent = choice;

      label.appendChild(input);
      label.appendChild(span);
      fieldset.appendChild(label);
    });

    quizForm.appendChild(fieldset);
  });
}

async function generateQuiz(evt) {
  evt.preventDefault();
  hide(resultsSection);
  hide(quizSection);
  setGenBusy(true);

  // Determine selected model
  let selectedModel = null;
  try {
    const sel = modelSelect ? modelSelect.value : '';
    if (sel === 'custom') {
      const custom = customModelInput ? customModelInput.value.trim() : '';
      if (!custom) {
        genStatus.textContent = 'Please enter a custom model name or choose a preset model.';
        createToast('Please provide a model name');
        setGenBusy(false);
        return;
      }
      selectedModel = custom;
    } else if (sel) {
      selectedModel = sel;
    }
  } catch {
  }

  // Persist last values
  try {
    localStorage.setItem('quizzer:lastTopic', topicInput.value);
    localStorage.setItem('quizzer:lastNum', String(numInput.value));
    if (difficultySelect) localStorage.setItem('quizzer:lastDifficulty', difficultySelect.value);
    if (modelSelect) localStorage.setItem('quizzer:lastModelSelect', modelSelect.value);
    if (customModelInput) localStorage.setItem('quizzer:lastCustomModel', customModelInput.value.trim());
  } catch {
  }

  try {
    const payload = {
      topic: topicInput.value,
      num_questions: Number(numInput.value),
      difficulty: difficultySelect ? difficultySelect.value : 'medium'
    };
    if (selectedModel) payload.model = selectedModel;

    const res = await fetch('/api/generate_quiz', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Failed to generate quiz');
    }
    const data = await res.json();
    currentQuizId = data.quiz_id;
    currentQuestions = data.questions;
    renderQuiz(currentQuestions);
    show(quizSection);
    smoothScrollIntoView(quizSection);
  } catch (err) {
    const message = (err && err.message) ? err.message : String(err);
    genStatus.textContent = `Error: ${message}`;
    createToast(`Generate failed — ${message}`);
  } finally {
    setGenBusy(false);
  }
}

async function submitAnswers() {
  if (!currentQuizId) return;

  const answers = currentQuestions.map(q => {
    const selected = quizForm.querySelector(`input[name="${q.id}"]:checked`);
    return {
      question_id: q.id,
      selected_index: selected ? Number(selected.value) : null
    };
  }).filter(a => a.selected_index !== null);

  setSubmitBusy(true);
  setBusy(quizSection, true);

  try {
    const res = await fetch('/api/submit', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({quiz_id: currentQuizId, answers})
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Failed to submit answers');
    }
    const data = await res.json();
    const {total_questions, correct_count, results} = data;
    scoreDiv.textContent = `Score: ${correct_count} / ${total_questions}`;

    const frag = document.createDocumentFragment();
    results.forEach((r, idx) => {
      const div = document.createElement('div');
      div.className = 'result-item';
      const hdr = document.createElement('div');
      hdr.className = 'result-q';
      hdr.textContent = `${idx + 1}. ${r.prompt}`;
      div.appendChild(hdr);

      const list = document.createElement('ol');
      list.type = 'A';
      r.choices.forEach((c, i) => {
        const li = document.createElement('li');
        li.textContent = c;
        if (i === r.correct_index) li.classList.add('correct');
        if (r.selected_index === i && !r.is_correct) li.classList.add('selected-wrong');
        list.appendChild(li);
      });
      div.appendChild(list);

      const verdict = document.createElement('div');
      verdict.className = r.is_correct ? 'verdict correct' : 'verdict wrong';
      verdict.textContent = r.is_correct ? 'Correct' : 'Wrong';
      div.appendChild(verdict);

      frag.appendChild(div);
    });

    detailsDiv.innerHTML = '';
    detailsDiv.appendChild(frag);
    show(resultsSection);
    smoothScrollIntoView(resultsSection);
  } catch (err) {
    const message = (err && err.message) ? err.message : String(err);
    createToast(`Submit failed — ${message}`);
  } finally {
    setSubmitBusy(false);
    setBusy(quizSection, false);
  }
}

function updateCustomModelVisibility() {
  if (!modelSelect || !customModelInput) return;
  const isCustom = modelSelect.value === 'custom';
  customModelInput.style.display = isCustom ? 'block' : 'none';
}

// Event wiring
if (genForm) genForm.addEventListener('submit', generateQuiz);
if (submitBtn) submitBtn.addEventListener('click', submitAnswers);
if (modelSelect) modelSelect.addEventListener('change', () => {
  updateCustomModelVisibility();
});

// Restore last values
try {
  const lt = localStorage.getItem('quizzer:lastTopic');
  const ln = localStorage.getItem('quizzer:lastNum');
  const ld = localStorage.getItem('quizzer:lastDifficulty');
  const lmSel = localStorage.getItem('quizzer:lastModelSelect');
  const lmCust = localStorage.getItem('quizzer:lastCustomModel');
  if (lt && topicInput) topicInput.value = lt;
  if (ln && numInput) numInput.value = ln;
  if (ld && difficultySelect) difficultySelect.value = ld;
  if (lmSel && modelSelect) modelSelect.value = lmSel;
  if (lmCust && customModelInput) customModelInput.value = lmCust;
  updateCustomModelVisibility();
} catch {
}
