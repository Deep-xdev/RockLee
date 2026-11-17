# RockLee

RockLee is a starter AI chat app with a React/Vite frontend, a FastAPI backend, and a local SQLite database. The backend can send chat requests to OpenAI or Groq; provider keys stay on the server.

## Requirements

- Node.js 20.19+ or 22.12+
- Python 3.10+
- An API key for OpenAI, Groq, or both

## Configure the API

```bash
cd server
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Add your provider keys to `server/.env`. The SQLite database is created automatically at `server/rocklee.db`.

Start the API:

```bash
uvicorn app.main:app --reload
```

The API docs are available at [http://localhost:8000/docs](http://localhost:8000/docs).

## Start the frontend

In another terminal, from the repository root:

```bash
npm install
npm run dev
```

Open the URL printed by Vite (usually [http://localhost:5173](http://localhost:5173)). Set `VITE_API_BASE_URL` if the API is hosted somewhere other than `http://localhost:8000`.
