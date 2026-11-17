from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class ConversationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    created_at: datetime
    updated_at: datetime


class MessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class ChatRequest(BaseModel):
    provider: Literal["openai", "groq"]
    message: str = Field(min_length=1, max_length=20_000)
    conversation_id: int | None = None


class ChatResponse(BaseModel):
    conversation_id: int
    response: str
    provider: Literal["openai", "groq"]
    model: str
