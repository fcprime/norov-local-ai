# Norov Local AI v0.6.1 — деплой

## Що змінено

- виправлено змішування мов у Sales Engine;
- назва послуги та цільового сегмента перекладаються мовою компанії;
- локалізація працює для Email, WhatsApp, Facebook, Instagram, LinkedIn, SMS, Call Script і Follow-up;
- додано United States, Canada, Australia та New Zealand;
- оновлено Netlify Function для нових країн;
- production build успішно перевірено командою `npm run build`.

## Як оновити через GitHub

1. Розпакуйте ZIP.
2. Відкрийте папку проєкту у VS Code.
3. Не копіюйте `node_modules` і `dist` — вони створяться автоматично.
4. У Terminal виконайте:

```bash
npm install
npm run build
git add .
git commit -m "Fix Sales Engine localization and add US Canada"
git push
```

Якщо Netlify підключений до цього GitHub-репозиторію, новий deploy запуститься автоматично.

## Якщо завантажуєте через Netlify вручну

Рекомендований спосіб — GitHub. Для ручного deploy:

```bash
npm install
npm run build
```

Потім у Netlify Deploys завантажте папку `dist`.

Увага: для пошуку компаній потрібна Netlify Function `netlify/functions/search.mjs` і змінна середовища `GEOAPIFY_API_KEY`. Тому просте завантаження лише `dist` підходить тільки тоді, коли functions уже розгорнуті з репозиторію. Повний надійний варіант — deploy через GitHub.

## Перевірка після deploy

Введіть:

- послуга: `Хімчистка меблів`;
- сегмент: `Готелі та хостели`;
- країна: `Poland`.

У Sales Engine має бути:

- `pranie tapicerki meblowej`;
- `hotele i hostele`.

Українські слова не повинні залишатися всередині польського повідомлення.
