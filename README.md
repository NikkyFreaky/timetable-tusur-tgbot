# Расписание ТУСУР

Telegram Mini App и бот для просмотра расписания ТУСУР, выбора учебной группы и
настройки уведомлений. Проект развивается открыто: идеи, сообщения об ошибках и
улучшения принимаются через [Issues](https://github.com/NikkyFreaky/timetable-tusur-tgbot/issues),
а готовые изменения — через [Pull Requests](https://github.com/NikkyFreaky/timetable-tusur-tgbot/pulls).

> Перед публичным переиспользованием проекта владельцу репозитория следует добавить
> файл `LICENSE`: без лицензии исходный код доступен, но права на его использование
> не предоставлены автоматически.

## Возможности

- Расписание по дням, неделям и ближайшим занятиям.
- Поиск учебной группы: факультет → курс → группа.
- Учёт чётности недели, каникул, сессии, праздников и выходных.
- Настройки расписания и уведомлений для личного чата и групповых чатов.
- Telegram-бот с вебхуком, поддержкой форум-тем и административной панелью.
- Хранение настроек, участников чатов и кэша в Supabase.

## Технологии

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4, Radix UI,
Supabase и Telegram Bot API.

## Быстрый запуск

Нужны Node.js 20.9+ и проект Supabase.

```bash
git clone git@github.com:NikkyFreaky/timetable-tusur-tgbot.git
cd timetable-tusur-tgbot
npm ci
npm run dev
```

Приложение будет доступно по адресу `http://localhost:3000`.

### Переменные окружения

Создайте `.env.local` (он намеренно не попадает в Git):

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

BOT_TOKEN=your-telegram-bot-token
WEBAPP_URL=https://your-app.example
NEXT_PUBLIC_WEBAPP_URL=https://your-app.example
MINI_APP_URL=https://your-app.example

# Случайные секреты, не публикуйте их
TELEGRAM_WEBHOOK_SECRET=generated-webhook-secret
CRON_SECRET=generated-cron-secret
```

`SUPABASE_SERVICE_ROLE_KEY`, `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` и
`CRON_SECRET` — серверные секреты. Не добавляйте к ним префикс `NEXT_PUBLIC_` и
не передавайте их в браузер.

### База данных

Примените миграции из `supabase/migrations` в порядке их нумерации. Для
production рекомендуется включить RLS и выдать минимально необходимые политики
доступа для используемых таблиц.

### Telegram webhook

Вебхук принимает запросы только с заголовком
`X-Telegram-Bot-Api-Secret-Token`. Укажите тот же секрет при регистрации:

```bash
curl -X POST "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
  -d "url=https://your-app.example/api/telegram/webhook" \
  -d "secret_token=$TELEGRAM_WEBHOOK_SECRET"
```

Планировщик обращается к `/api/cron` и `/api/cron/cleanup-cache` только с
заголовком `Authorization: Bearer $CRON_SECRET`. Передавать секрет в query string
нельзя: он может попасть в логи и историю браузера.

## Команды

```bash
npm run dev       # разработка
npm run build     # production-сборка
npm start         # запуск production-сборки
npx tsc --noEmit  # проверка TypeScript
npm run lint      # проверка типов (текущий основной lint-процесс)
```

## Структура проекта

```text
app/                 маршруты, страницы и API Next.js
components/          прикладные и UI-компоненты
lib/                 интеграции, доменная логика и хранилища
styles/              токены темы, базовые, Telegram- и utility-стили
supabase/migrations/ миграции схемы базы данных
```

Глобальный вход для стилей — `app/globals.css`. Он только подключает Tailwind и
небольшие специализированные файлы из `styles/`: `tokens.css` содержит дизайн-
токены, `base.css` — базовые правила, `telegram.css` — интеграцию Mini App, а
`utilities.css` — переиспользуемые utility-классы. Стили конкретного интерфейса
остаются рядом с компонентами в Tailwind-классах; это не даёт глобальному CSS
снова стать монолитом.

## Вклад в проект

1. Проверьте, нет ли уже подходящего Issue.
2. Для ошибки приложите шаги воспроизведения, ожидаемый и фактический результат.
3. Для изменения создайте ветку от актуальной основной ветки, выполните
   `npx tsc --noEmit` и отправьте Pull Request с понятным описанием.
4. Не включайте ключи, токены, дампы базы и другие персональные данные в Issue,
   коммиты или PR.

Для уязвимостей не создавайте публичный Issue: свяжитесь с владельцем
репозитория приватно.

## Релизы

Текущая версия — **2.1.0**. Она синхронизирует манифест с историей ветки 2.0.0 и
включает накопившиеся совместимые доработки; следующий несовместимый релиз должен
повышать старшую версию согласно Semantic Versioning.
