# Norov Local AI v2.0 — Geoapify

Чиста версія без Overpass і без Google Cloud.

## 1. Отримайте безкоштовний ключ Geoapify

Створіть акаунт Geoapify та скопіюйте API key.

## 2. Створіть файл `.env`

У корені проєкту скопіюйте `.env.example` у `.env` і вставте ключ:

```env
API_PORT=8787
GEOAPIFY_API_KEY=ваш_ключ
```

Не публікуйте `.env` у GitHub.

## 3. Запуск

```bash
npm install
npm run dev
```

Frontend: http://localhost:5173
API: http://localhost:8787
Health check: http://localhost:8787/api/health

Правильна відповідь health check:

```json
{ "ok": true, "provider": "Geoapify", "configured": true }
```

## Важливо

- У проєкті немає Overpass.
- Якщо ключ не доданий, пошук поверне зрозумілу помилку і не покаже демо-компанію як реальний результат.
- CRM у MVP зберігається локально у браузері.

Update
