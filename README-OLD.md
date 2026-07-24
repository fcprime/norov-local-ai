# Norov Local AI MVP 0.3 — безкоштовний пошук

Робочий локальний MVP без Google Cloud і без платних API.

## Джерела даних

- Nominatim — одноразово визначає координати міста.
- Overpass API / OpenStreetMap — шукає реальні компанії в радіусі.
- localStorage — зберігає CRM-статуси та нотатки у браузері.

## Запуск

```bash
npm install
npm run dev
```

Відкрий адресу Vite, зазвичай `http://localhost:5173`.

## Як шукати

Для найкращого результату почни з відомих OSM-категорій:

- cleaning / sprzątanie / czyszczenie
- hotel
- restaurant
- dentist
- car wash / myjnia
- roofing / dach
- solar

Вузькі послуги можуть бути позначені в OpenStreetMap неповно. Це обмеження джерела даних, а не помилка програми.

## Важливе обмеження

Публічні сервери Nominatim та Overpass безкоштовні, але не призначені для необмеженого комерційного навантаження. У MVP додані кеш та обмеження частоти. Для великого SaaS пізніше знадобиться власний сервер OSM або платний провайдер даних.

## Атрибуція

Інтерфейс має зберігати напис `© OpenStreetMap contributors` та посилання на OpenStreetMap.
