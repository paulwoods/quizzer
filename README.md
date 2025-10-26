### Quizzer — FastAPI + OpenAI quiz generator

A simple web app where you enter a topic and number of questions. The backend calls OpenAI to generate multiple‑choice
questions (4 options, exactly one correct). You answer in the browser, then see your score and which you got right or
wrong.

#### Prerequisites

- Python 3.10+
- An OpenAI API key with access to a chat model (default: `gpt-4o-mini`)

#### Setup

1) Create and activate a virtual environment (recommended):

```
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
```

2) Install dependencies:

```
pip install -r requirements.txt
```

3) Set your API key in the environment:

- macOS/Linux:

```
export OPENAI_API_KEY=sk-your-key-here
```

- Windows PowerShell:

```
$env:OPENAI_API_KEY="sk-your-key-here"
```

Optional: choose a model via env var (defaults to `gpt-4o-mini`):

```
export OPENAI_MODEL=gpt-4o-mini
```

#### Run

Start the server (from project root):

```
uvicorn app.main:app --reload --port 8000
```

Open your browser to:

```
http://localhost:8000/
```

#### How it works

- POST `/api/generate_quiz` with `{ topic: string, num_questions: number (1..20) }`.
    - Calls OpenAI to generate N questions.
    - Stores the correct answers in memory keyed by `quiz_id` and returns only the questions to the client.
- POST `/api/submit` with `{ quiz_id: string, answers: [{ question_id, selected_index }] }`.
    - Scores the quiz and returns detailed per‑question results and totals.

#### Notes

- Data is stored in memory only; restarting the server clears quizzes.
- The LLM is asked to return strict JSON; the backend validates and will retry once if parsing fails.
- Frontend is static HTML/CSS/JS in the `static/` folder and is served by FastAPI at `/`.

#### Troubleshooting

- 502 on generation: ensure `OPENAI_API_KEY` is set and you have access to the chosen model.
- CORS/browser errors during development: the app enables permissive CORS by default.
- If your network blocks OpenAI, set a proxy in your environment or run from a network that allows outbound HTTPS to the
  OpenAI API.
