# L_Shop — финальная лаба (без звездочек)

## Реализовано по заданию

1. Локализация:
- 2 языка: русский и английский.
- Статический текст вынесен в словарь в `public/main.ts`.
- Есть сессионная плашка выбора языка.
- Выбор локали хранится в серверной сессии (`ww_session`) и сбрасывается при завершении сессии браузера.

2. Система рекомендаций:
- Для каждого товара есть скрытые теги (`tags`).
- При лайке товара его теги попадают в профиль рекомендаций сессии.
- Лента выдается через `/api/feed`, рекомендации встроены в общий поток (не полностью сортировка).
- Рекомендации затухают по времени.

3. Роли и управление товарами:
- Роли: `user`, `admin`.
- Добавлен API для хозяина магазина:
  - `POST /api/admin/products`
  - `PUT /api/admin/products/:skinId`
- На фронте доступна отдельная вкладка админа с формой создания товара.
- Админ-сессия протухает через 30 минут неактивности.

4. Комментарии и оценки:
- Добавлен `POST /api/skins/:skinId/reviews`.
- Коммент и оценку могут оставить только авторизованные пользователи.
- У товара отображаются средний рейтинг, комментарии и дата.

5. Тесты:
- Базовые API-тесты на `supertest` в `tests/api.core.test.js`.
- Фичевые API-тесты на `supertest` в `tests/api.features.test.js`.
- Тесты утилит на `jest` в `tests/utils.test.js`.

## API (основное)

- `GET /api/skins`
- `GET /api/feed`
- `POST /api/register`
- `POST /api/login`
- `POST /api/logout`
- `GET /api/me`
- `POST /api/buy`
- `POST /api/sell`
- `GET /api/session-locale`
- `POST /api/session-locale`
- `POST /api/skins/:skinId/like`
- `POST /api/skins/:skinId/reviews`
- `POST /api/admin/products` (admin)
- `PUT /api/admin/products/:skinId` (admin)

## Как запускать

```bash
npm install
npm run build
npm run dev
```

Тесты:

```bash
npm test
```
