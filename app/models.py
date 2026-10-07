from datetime import datetime

from pydantic import BaseModel, Field


class EntryCreate(BaseModel):
    content: str = Field(min_length=1, max_length=20_000)
    mood: str = Field(default="steady", max_length=40)
    title: str | None = Field(default=None, max_length=120)


class EntryUpdate(BaseModel):
    content: str = Field(min_length=1, max_length=20_000)
    mood: str = Field(default="steady", max_length=40)
    title: str | None = Field(default=None, max_length=120)


class Entry(BaseModel):
    id: int
    content: str
    mood: str
    title: str
    created_at: datetime
    updated_at: datetime
    insight: str | None = None
    reflection: str | None = None
    goal: str | None = None
    tags: list[str] = []


class DailyContext(BaseModel):
    assessment: str
    quote: str
    quote_source: str


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4_000)
    entry_id: int | None = None


class ChatResponse(BaseModel):
    reply: str
    source: str
