NOROV LOCAL AI — GEOAPIFY HOTFIX

Змінені файли:
- server.mjs
- src/api.ts
- src/App.tsx
- .env.example

1. Зареєструйтеся на Geoapify та створіть безкоштовний API key.
2. У корені проєкту створіть файл .env.
3. Додайте:

GEOAPIFY_API_KEY=ВАШ_КЛЮЧ

4. Перезапустіть сервер:
Control + C
npm run dev

Перевірка:
http://localhost:8787/api/health

Має бути:
{"ok":true,"provider":"Geoapify","configured":true}
