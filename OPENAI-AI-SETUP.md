# OpenAI API setup

У Netlify → Site configuration → Environment variables додайте:
- `OPENAI_API_KEY` — секретний API-ключ
- `OPENAI_MODEL` — необов’язково; за замовчуванням `gpt-5.4-mini`

Після цього запустіть новий deploy.
Не додавайте ключ у `VITE_`, `src/`, GitHub або публічний `.env`.
