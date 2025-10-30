import os
import uuid
from typing import Dict, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles

from .models import (
    GenerateQuizRequest,
    GenerateQuizResponse,
    QuestionPublic,
    SubmitRequest,
    SubmitResponse,
    QuestionResult,
)
from .openai_client import generate_quiz_via_openai, QuizGenerationError

# In-memory store: quiz_id -> {"questions": [...], "answer_key": {qid: idx}}
QUIZ_STORE: Dict[str, Dict] = {}

app = FastAPI(title="Quizzer", version="0.1.0")

# CORS (allow all origins for simplicity in local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files (frontend)
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static")
if os.path.isdir(static_dir):
    app.mount("/static", StaticFiles(directory=static_dir), name="static")


    @app.get("/")
    async def serve_index():
        index_path = os.path.join(static_dir, "index.html")
        if os.path.exists(index_path):
            from fastapi.responses import FileResponse
            return FileResponse(index_path)
        return HTMLResponse("<h1>Quizzer</h1>")


@app.post("/api/generate_quiz", response_model=GenerateQuizResponse)
async def generate_quiz(req: GenerateQuizRequest) -> GenerateQuizResponse:
    try:
        llm_quiz = generate_quiz_via_openai(req.topic, req.num_questions, req.difficulty)
    except QuizGenerationError as e:
        raise HTTPException(status_code=502, detail=str(e))

    quiz_id = str(uuid.uuid4())
    questions_public: List[QuestionPublic] = []
    answer_key: Dict[str, int] = {}

    for q in llm_quiz.questions:
        # Enforce single correct answer and 4 choices already validated in model
        questions_public.append(
            QuestionPublic(id=q.id, prompt=q.prompt, choices=q.choices)
        )
        answer_key[q.id] = int(q.correct_index)

    QUIZ_STORE[quiz_id] = {
        "questions": {qp.id: qp for qp in questions_public},
        "answer_key": answer_key,
    }

    return GenerateQuizResponse(quiz_id=quiz_id, questions=questions_public)


@app.post("/api/submit", response_model=SubmitResponse)
async def submit_answers(req: SubmitRequest) -> SubmitResponse:
    record = QUIZ_STORE.get(req.quiz_id)
    if not record:
        raise HTTPException(status_code=404, detail="Quiz not found or expired")

    questions: Dict[str, QuestionPublic] = record["questions"]
    answer_key: Dict[str, int] = record["answer_key"]

    selected_map: Dict[str, int] = {a.question_id: a.selected_index for a in req.answers}

    results: List[QuestionResult] = []
    correct_count = 0

    for qid, q in questions.items():
        correct_idx = answer_key.get(qid)
        selected_idx = selected_map.get(qid)
        is_correct = selected_idx == correct_idx
        if is_correct:
            correct_count += 1
        results.append(
            QuestionResult(
                question_id=q.id,
                prompt=q.prompt,
                choices=q.choices,
                correct_index=correct_idx,
                selected_index=selected_idx,
                is_correct=is_correct,
            )
        )

    return SubmitResponse(
        total_questions=len(questions), correct_count=correct_count, results=results
    )
