# Innerly

[![CI](https://github.com/aimy2/Innerly-IntelligentDiary/actions/workflows/ci.yml/badge.svg)](https://github.com/aimy2/Innerly-IntelligentDiary/actions/workflows/ci.yml)

**Innerly is a privacy-first journaling companion that helps people capture daily experiences, notice patterns, and reflect with more clarity.**

It combines a calm writing workspace with generated titles, critical reflections, small goals, mood signals, and conversational follow-up. Journal notes are stored locally in the browser by default, keeping the product centered on user ownership rather than a cloud-first data model.

<img width="1885" height="860" alt="Screenshot 2026-10-07 172037" src="https://github.com/user-attachments/assets/1009ecd9-c071-4461-9fc1-4674f01895ee" />


## Product Highlights

- Local-first journal storage using browser IndexedDB
- Create, edit, and delete journal notes
- Generated creative titles, insights, critical reflections, goals, and tags
- Short journal previews with date, time, and mood
- Conversational follow-up grounded in the current note
- Personalized daily assessment and life quotes
- Offline fallback reflection mode when no LLM key is configured
- Responsive interface for desktop and mobile
- Dockerized FastAPI service with a health check

<img width="1830" height="487" alt="Screenshot 2026-10-07 172055" src="https://github.com/user-attachments/assets/df95d6a2-f338-4373-ae32-f44aa0ae75c4" />


## Privacy Model

Innerly separates persistence from analysis:

- Journal notes are saved in IndexedDB on the device where they are written.
- Existing server-side entries are imported into IndexedDB on the first page load.
- New saves, edits, and deletes in the browser use the local store.
- With no `LLM_API_KEY`, reflection uses local fallback logic and journal text is not sent to an external LLM provider. When the app is run locally, that processing remains on the local machine.
- With an LLM key configured, note text is sent to the configured OpenAI-compatible provider for analysis. The browser workflow does not persist those notes through the API.

Browser storage is device- and browser-specific. Clearing browser data can remove notes, and notes do not automatically synchronize across devices. A production rollout should add encrypted export/import or a user-controlled synchronization service before positioning Innerly as a multi-device system.

## Architecture

```text
Browser
  |-- IndexedDB: local journal notes
  |-- Fetch API: analysis, chat, and daily context
  |
FastAPI service
  |-- Journal and analysis endpoints
  |-- OpenAI-compatible LLM integration
  |-- SQLite persistence for server-side API compatibility
  |
Deployment
  |-- Docker image
  |-- GitHub Actions CI/CD
  |-- GitHub Container Registry publishing
```

### Technology

- **Backend:** Python, FastAPI, Pydantic, SQLite
- **Frontend:** HTML, CSS, vanilla JavaScript, IndexedDB
- **AI integration:** OpenAI-compatible chat completion API
- **Testing:** pytest
- **Delivery:** Docker, Docker Compose, GitHub Actions, GitHub Container Registry

## Quick Start

### Requirements

- Python 3.12+
- pip
- Optional: Docker Desktop
- Optional: an API key for an OpenAI-compatible LLM provider

### Run Locally

```powershell
Copy-Item .env.example .env
python -m venv .venv
.venv\Scripts\Activate.ps1
python -m pip install -r requirements-dev.txt
python -m uvicorn app.main:app --reload
```

Open <http://localhost:8000>.

The application works without an LLM key. To enable provider-backed analysis, add the key to `.env`:

```env
LLM_API_KEY=your_provider_key
```

Never commit `.env` or expose an API key in frontend code.

### Run with Docker

```powershell
Copy-Item .env.example .env
# Edit .env if provider-backed analysis is required.
docker compose up --build
```

Open <http://localhost:8000>. Journal data created by the server-side API is stored in `data/innerly.db` locally or in the `innerly_data` Docker volume. The container runs as a non-root user and exposes `/api/health` for health monitoring.

## API Surface

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service health check |
| `GET` | `/api/entries` | List server-side entries |
| `POST` | `/api/analyze` | Analyze text without persisting it |
| `POST` | `/api/entries` | Create a server-side entry |
| `PUT` | `/api/entries/{id}` | Update and re-analyze an entry |
| `DELETE` | `/api/entries/{id}` | Delete a server-side entry |
| `GET` | `/api/daily-context` | Generate daily assessment and quote |
| `POST` | `/api/chat` | Continue a conversation about a note |

Interactive API documentation is available at <http://localhost:8000/docs> while the service is running.

## Testing

Run the test suite with:

```powershell
pytest -q
```

Validate the browser script with:

```powershell
node --check static/app.js
```

## CI/CD

GitHub Actions runs on pull requests and pushes to `main`:

1. Installs Python dependencies.
2. Runs the pytest suite.
3. Builds the Docker image with Buildx and GitHub Actions cache.
4. Publishes the image on successful `main` pushes to GitHub Container Registry.

Published image references:

```text
ghcr.io/aimy2/innerly-intelligentdiary:latest
ghcr.io/aimy2/innerly-intelligentdiary:sha-<commit>
```

The workflow is defined in [.github/workflows/ci.yml](.github/workflows/ci.yml).

## Deployment Notes

The repository is ready to deploy as a Docker service on a platform such as DigitalOcean, Render, Azure, or another container host. The host must provide:

- A public HTTP port, supplied through the `PORT` environment variable when required
- `LLM_API_KEY` only when provider-backed analysis is desired
- Persistent storage if server-side SQLite data is used
- HTTPS and secret management for production use

No public production deployment is included by default. The local-first browser workflow is suitable for private personal use; multi-user production use requires authentication, authorization, encrypted backups, and a durable database strategy.

## Repository

- GitHub: <https://github.com/aimy2/Innerly-IntelligentDiary>
- CI workflow: [.github/workflows/ci.yml](.github/workflows/ci.yml)
- Docker image definition: [Dockerfile](Dockerfile)
- Application source: [app](app)
- Frontend source: [static](static)
- Tests: [tests](tests)

## License

No license has been specified yet. Add a license before distributing Innerly as a reusable company or open-source project.
