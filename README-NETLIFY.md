# Деплой Norov Local AI на Netlify

1. Завантажте цей проєкт у GitHub.
2. У Netlify: Add new project → Import an existing project → GitHub.
3. Netlify автоматично прочитає `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. У Project configuration → Environment variables додайте:

```text
GEOAPIFY_API_KEY=ваш_ключ
```

5. Запустіть новий deploy.

Сайт отримає адресу виду `https://назва-проєкту.netlify.app`.
Пошук працює через Netlify Function, тому Geoapify API key не відкривається у браузері.
