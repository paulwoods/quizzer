from __future__ import annotations

from pydantic import BaseModel, Field, conint, validator
from typing import List, Optional, Literal


class GenerateQuizRequest(BaseModel):
    topic: str = Field(..., min_length=2, max_length=120)
    num_questions: conint(ge=1, le=20) = 5
    difficulty: Literal["easy", "medium", "hard"] = "medium"


class QuestionPublic(BaseModel):
    id: str
    prompt: str
    choices: List[str]  # exactly 4


class GenerateQuizResponse(BaseModel):
    quiz_id: str
    questions: List[QuestionPublic]


class UserAnswer(BaseModel):
    question_id: str
    selected_index: conint(ge=0, le=3)


class SubmitRequest(BaseModel):
    quiz_id: str
    answers: List[UserAnswer]


class QuestionResult(BaseModel):
    question_id: str
    prompt: str
    choices: List[str]
    correct_index: int
    selected_index: Optional[int]
    is_correct: bool


class SubmitResponse(BaseModel):
    total_questions: int
    correct_count: int
    results: List[QuestionResult]


# Internal models used for parsing OpenAI output
class LLMQuestion(BaseModel):
    id: Optional[str] = None
    prompt: str
    choices: List[str]
    correct_index: conint(ge=0, le=3)

    @validator("choices")
    def four_choices(cls, v):
        if len(v) != 4:
            raise ValueError("Each question must have exactly 4 choices")
        return v


class LLMQuiz(BaseModel):
    questions: List[LLMQuestion]
