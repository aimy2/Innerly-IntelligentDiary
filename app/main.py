from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import create_entry, delete_entry, get_entry, init_db, list_entries, update_entry
from .llm import analyze_entry, answer_chat, daily_context
from .models import AnalyzeRequest, AnalyzeResponse, ChatRequest, ChatResponse, DailyContext, Entry, EntryCreate, EntryUpdate


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    yield


settings = get_settings()
app = FastAPI(title=settings.app_name, description="Privacy-first conversational journaling assistant", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_methods=["*"], allow_headers=["*"])
app.mount("/static", StaticFiles(directory="static"), name="static")


@app.get("/", include_in_schema=False)
async def home() -> FileResponse:
    return FileResponse("static/index.html")


@app.get("/api/entries", response_model=list[Entry])
async def entries() -> list[Entry]:
    return list_entries()


@app.post("/api/entries", response_model=Entry, status_code=201)
async def add_entry(payload: EntryCreate) -> Entry:
    title, insight, reflection, goal, tags = await analyze_entry(payload.content)
    return create_entry(payload, payload.title or title, insight, reflection, goal, tags)


@app.post("/api/analyze", response_model=AnalyzeResponse)
async def analyze(payload: AnalyzeRequest) -> AnalyzeResponse:
    title, insight, reflection, goal, tags = await analyze_entry(payload.content)
    return AnalyzeResponse(title=title, insight=insight, reflection=reflection, goal=goal, tags=tags)


@app.put("/api/entries/{entry_id}", response_model=Entry)
async def edit_entry(entry_id: int, payload: EntryUpdate) -> Entry:
    if not get_entry(entry_id):
        raise HTTPException(status_code=404, detail="Entry not found")
    title, insight, reflection, goal, tags = await analyze_entry(payload.content)
    return update_entry(entry_id, payload, payload.title or title, insight, reflection, goal, tags)


@app.delete("/api/entries/{entry_id}", status_code=204)
async def remove_entry(entry_id: int) -> None:
    if not delete_entry(entry_id):
        raise HTTPException(status_code=404, detail="Entry not found")


@app.get("/api/daily-context", response_model=DailyContext)
async def get_daily_context() -> DailyContext:
    assessment, quote, quote_source = await daily_context(list_entries())
    return DailyContext(assessment=assessment, quote=quote, quote_source=quote_source)


@app.post("/api/chat", response_model=ChatResponse)
async def chat(payload: ChatRequest) -> ChatResponse:
    context = payload.context
    if payload.entry_id:
        entry = get_entry(payload.entry_id)
        if not entry:
            raise HTTPException(status_code=404, detail="Entry not found")
        context = entry.content
    reply, source = await answer_chat(payload.message, context)
    return ChatResponse(reply=reply, source=source)


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}
