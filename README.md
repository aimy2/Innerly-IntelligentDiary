# Innerly

A privacy-first conversational journaling assistant powered by FastAPI and an OpenAI-compatible LLM API.

## Run locally

```powershell
Copy-Item .env.example .env
python -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload
```

Open http://localhost:8000. Without an API key, Innerly uses a small local reflection mode so no journal text leaves the machine. Add `LLM_API_KEY` to `.env` to enable personalized LLM analysis.

## Run with Docker

```powershell
Copy-Item .env.example .env
# edit .env and add an API key if desired
docker compose up --build
```

Journal data is stored in `data/innerly.db` locally or in the `innerly_data` Docker volume. The API never logs entry content.

## CI/CD

GitHub Actions runs the test suite on pushes to `main` and pull requests. A successful test job then builds the Docker image with Buildx and GitHub Actions layer caching. The workflow is defined in `.github/workflows/ci.yml`.

To build and run the image locally:

```powershell
docker build -t innerly:local .
docker compose up --build
```

The container runs as a non-root user and exposes a health check at `/api/health`.
