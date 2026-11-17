import logging
import os
from contextlib import asynccontextmanager
from typing import Iterator

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import OpenAI, OpenAIError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import Base, SessionLocal, engine
from app.models import Conversation, Message
from app.schemas import (
    ChatRequest,
    ChatResponse,
    ConversationResponse,
    MessageResponse,
)

logger = logging.getLogger(__name__)
MODEL_BY_PROVIDER = {
    "openai": "gpt-4o-mini",
    "groq": "llama-3.3-70b-versatile",
}


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(title="RockLee API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://organic-cod-r4q6ggpjrrwxcxj7-5173.app.github.dev",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)



def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session


def make_client(provider: str) -> OpenAI:
    if provider == "groq":
        api_key = os.getenv("GROQ_API_KEY")
        base_url = "https://api.groq.com/openai/v1"
    else:
        api_key = os.getenv("OPENAI_API_KEY")
        base_url = None

    if not api_key:
        raise HTTPException(
            status_code=503,
            detail=f"{provider.title()} is not configured. Add its API key to server/.env.",
        )

    if base_url:
        return OpenAI(api_key=api_key, base_url=base_url)
    return OpenAI(api_key=api_key)


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/conversations", response_model=list[ConversationResponse])
def list_conversations(db: Session = Depends(get_db)) -> list[Conversation]:
    return list(
        db.scalars(select(Conversation).order_by(Conversation.updated_at.desc())).all()
    )


@app.get(
    "/api/conversations/{conversation_id}/messages",
    response_model=list[MessageResponse],
)
def list_messages(
    conversation_id: int, db: Session = Depends(get_db)
) -> list[Message]:
    conversation = db.get(Conversation, conversation_id)
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")
    return conversation.messages


@app.post("/api/chat", response_model=ChatResponse)
def chat(payload: ChatRequest, db: Session = Depends(get_db)) -> ChatResponse:
    conversation = (
        db.get(Conversation, payload.conversation_id)
        if payload.conversation_id is not None
        else Conversation(title=payload.message[:60])
    )
    if conversation is None:
        raise HTTPException(status_code=404, detail="Conversation not found.")

    client = make_client(payload.provider)
    model = MODEL_BY_PROVIDER[payload.provider]
    chat_messages = [
        {"role": message.role, "content": message.content}
        for message in conversation.messages
    ]
    chat_messages.append({"role": "user", "content": payload.message})

    try:
        completion = client.chat.completions.create(
            model=model,
            messages=chat_messages,
            max_tokens=1024,
        )
    except OpenAIError as error:
        logger.exception("AI provider request failed (%s).", payload.provider)
        raise HTTPException(
            status_code=502,
            detail=f"The {payload.provider.title()} request failed. Check the API key and try again.",
        ) from error

    answer = completion.choices[0].message.content or ""
    if payload.conversation_id is None:
        db.add(conversation)
        db.flush()
    conversation.messages.extend(
        [
            Message(role="user", content=payload.message),
            Message(role="assistant", content=answer),
        ]
    )
    db.commit()
    return ChatResponse(
        conversation_id=conversation.id,
        response=answer,
        provider=payload.provider,
        model=model,
    )
