const genForm = document.getElementById('generate-form');
const topicInput = document.getElementById('topic');
const numInput = document.getElementById('num');
const genStatus = document.getElementById('gen-status');
const quizSection = document.getElementById('quiz');
const quizForm = document.getElementById('quiz-form');
const submitBtn = document.getElementById('submit-answers');
const resultsSection = document.getElementById('results');
const scoreDiv = document.getElementById('score');
const detailsDiv = document.getElementById('details');

let currentQuizId = null;
let currentQuestions = [];

function show(el) {
  el.classList.remove('hidden');
}

function hide(el) {
  el.classList.add('hidden');
}

function renderQuiz(questions) {
  quizForm.innerHTML = '';
  questions.forEach((q, idx) => {
    const fieldset = document.createElement('fieldset');
    const legend = document.createElement('legend');
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
  genStatus.textContent = 'Generating quiz...';

  try {
    const res = await fetch('/api/generate_quiz', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({topic: topicInput.value, num_questions: Number(numInput.value)})
    });
    if (!res.ok) {
      const msg = await res.text();
      throw new Error(msg || 'Failed to generate quiz');
    }
    const data = await res.json();
    currentQuizId = data.quiz_id;
    currentQuestions = data.questions;
    renderQuiz(currentQuestions);
    genStatus.textContent = '';
    show(quizSection);
  } catch (err) {
    genStatus.textContent = `Error: ${err.message}`;
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
  } catch (err) {
    alert('Error submitting answers: ' + err.message);
  }
}

genForm.addEventListener('submit', generateQuiz);
submitBtn.addEventListener('click', submitAnswers);
