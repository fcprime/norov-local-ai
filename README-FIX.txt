Norov Local AI v2.1 — Geoapify network fix

Змінено:
- server.mjs: Node HTTPS замість fetch/AbortController, IPv4, таймаут 45 секунд, детальні логи.
- src/App.tsx: після помилки старі/демо результати більше не показуються як нові.

Встановлення:
1. Не публікуйте файл .env.
2. npm install
3. npm run dev
4. Відкрийте http://localhost:8787/api/health — version має бути 2.1.
