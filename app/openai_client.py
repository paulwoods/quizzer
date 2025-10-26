import json
import os
import random
import time
import uuid
from openai import OpenAI
from pydantic import ValidationError
from typing import List

from .models import LLMQuiz, LLMQuestion

DEFAULT_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")


class QuizGenerationError(Exception):
    pass


def _build_system_prompt() -> str:
    return (
        "You are a quiz generator. You create multiple-choice questions with exactly 4 choices, "
        "with exactly one correct answer. Keep questions concise, neutral, and unambiguous. "
        "Avoid trick wording, and ensure choices are plausible."
    )


def _build_user_prompt(topic: str, num_questions: int, difficulty: str) -> str:
    level_guidance = {
        "easy": "Focus on foundational, factual, or definitional knowledge. Avoid multi-step reasoning.",
        "medium": "Typical practitioner difficulty: mix of concepts and light application.",
        "hard": "Advanced/nuanced knowledge; may require multi-step reasoning or subtle distinctions (still unambiguous).",
    }.get(difficulty, "Typical practitioner difficulty: mix of concepts and light application.")

    return (
        f"Generate {num_questions} multiple-choice questions about '{topic}'. "
        f"Difficulty level: {difficulty}. {level_guidance} "
        "Each question must have: a concise 'prompt', exactly 4 'choices' (strings), and a 'correct_index' (0-3). "
        "Ensure exactly one correct choice per question and avoid trick wording. "
        "Respond ONLY as strict JSON with the following structure: \n"
        "{\n  \"questions\": [\n    { \n      \"prompt\": \"...\",\n      \"choices\": [\"...\", \"...\", \"...\", \"...\"],\n      \"correct_index\": 0\n    }\n  ]\n}\n"
    )


def _parse_llm_json(json_text: str) -> LLMQuiz:
    data = json.loads(json_text)
    quiz = LLMQuiz.model_validate(data)
    # Ensure IDs
    q_list: List[LLMQuestion] = []
    for q in quiz.questions:
        q.id = q.id or str(uuid.uuid4())
        q_list.append(q)
    quiz.questions = q_list
    return quiz


def generate_quiz_via_openai(topic: str, num_questions: int, difficulty: str, max_retries: int = 1) -> LLMQuiz:
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise QuizGenerationError("OPENAI_API_KEY environment variable is not set.")

    client = OpenAI(api_key=api_key)

    # We'll ask for JSON output via response_format for higher reliability
    messages = [
        {"role": "system", "content": _build_system_prompt()},
        {"role": "user", "content": _build_user_prompt(topic, num_questions, difficulty)},
    ]

    last_error = None
    for attempt in range(max_retries + 1):
        try:
            completion = client.chat.completions.create(
                model=DEFAULT_MODEL,
                messages=messages,
                temperature=0.7,
                response_format={"type": "json_object"},
            )
            content = completion.choices[0].message.content
            return _parse_llm_json(content)
        except (json.JSONDecodeError, ValidationError, Exception) as e:  # broad to retry
            last_error = e
            # Slight backoff
            time.sleep(0.4 + random.random() * 0.4)
            # On retry, gently restate instructions
            messages.append({
                "role": "user",
                "content": "Your last output was not valid JSON or did not match the schema. Please respond again as STRICT JSON only, matching the schema."
            })
            continue

    raise QuizGenerationError(f"Failed to generate a valid quiz: {last_error}")
