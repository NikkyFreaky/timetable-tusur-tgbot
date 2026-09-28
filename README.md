# Расписание ТУСУР

Telegram Mini App и бот для просмотра расписания ТУСУР, выбора учебной группы и
настройки уведомлений. Идеи, сообщения об ошибках и улучшения принимаются через
[Issues](https://github.com/NikkyFreaky/timetable-tusur-tgbot/issues), а готовые
изменения — через [Pull Requests](https://github.com/NikkyFreaky/timetable-tusur-tgbot/pulls).

> Проект является независимой инициативой сообщества. Он не аффилирован с ТУСУР,
> не представляет университет и не является официальным сервисом ТУСУР.

## Возможности

- Расписание по дням, неделям и ближайшим занятиям.
- Выбор учебной группы: факультет → курс → группа.
- Учёт чётности недели, каникул, сессии, праздников и выходных.
- Настройки расписания и уведомлений для личного и группового чата.
- Telegram-бот с webhook, поддержкой форум-тем и административной панелью.
- Хранение настроек, участников чатов и кэша в Supabase.

## Технологии и архитектура

Проект построен на Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4,
Supabase и Telegram Bot API.

```text
Telegram / браузер
        │
        ▼
Next.js: страницы, Mini App и API-маршруты
        ├── lib/timetable.ts ──► timetable.tusur.ru / tusur.ru
        ├── /api/telegram/webhook ◄── Telegram Bot API
        ├── /api/cron и /api/cron/cleanup-cache ◄── внешний планировщик
        └── Supabase: Auth, PostgreSQL и кэш
```

- `app/` — маршруты, страницы и API Next.js.
- `components/` — прикладные и UI-компоненты.
- `lib/` — интеграции, доменная логика, клиент Telegram и хранилища Supabase.
- `styles/` — токены темы, базовые, Telegram- и utility-стили.
- `supabase/migrations/` — миграции схемы базы данных.

Глобальная точка входа стилей — `app/globals.css`. Она подключает Tailwind и
специализированные файлы из `styles/`; стили конкретного интерфейса находятся
рядом с компонентами в Tailwind-классах.

## Требования

- Node.js 20.9 или новее;
- npm;
- проект Supabase;
- Telegram-бот, созданный через [@BotFather](https://t.me/BotFather);
- публичный HTTPS-адрес приложения для production.

## Быстрый запуск

```bash
git clone git@github.com:NikkyFreaky/timetable-tusur-tgbot.git
cd timetable-tusur-tgbot
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Приложение будет доступно по адресу `http://localhost:3000`. Заполните
`.env.local` перед работой с Supabase или Telegram. В PowerShell используется
`Copy-Item`; в Unix-подобных оболочках используйте `cp .env.example .env.local`.

## Переменные окружения

Шаблон находится в [`.env.example`](.env.example). Значения задаются в
`.env.local` локально и в настройках окружения платформы при деплое.

| Переменная | Назначение |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL проекта Supabase; может быть доступен браузеру. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Публичный anon key Supabase. |
| `SUPABASE_SERVICE_ROLE_KEY` | Серверный service-role key для административных операций. Никогда не публикуйте его. |
| `BOT_TOKEN` | Токен Telegram-бота из BotFather. |
| `WEBAPP_URL` | HTTPS-адрес Mini App для личных чатов. |
| `NEXT_PUBLIC_WEBAPP_URL` | Тот же публичный адрес, когда он нужен клиентскому коду. |
| `MINI_APP_URL` | HTTPS-адрес приложения для кнопок в группах. |
| `TELEGRAM_WEBHOOK_SECRET` | Случайный секрет для заголовка webhook Telegram. |
| `CRON_SECRET` | Случайный секрет для вызовов заданий планировщика. |

`SUPABASE_SERVICE_ROLE_KEY`, `BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET` и
`CRON_SECRET` — только серверные секреты. Не добавляйте им префикс
`NEXT_PUBLIC_`, не помещайте в репозиторий и не передавайте браузеру. Для двух
последних создайте криптографически случайные неповторяющиеся значения.

## Настройка Supabase

1. Создайте проект в Supabase и сохраните его URL, anon key и service-role key
   из раздела **Settings → API**.
2. Установите или запускайте Supabase CLI через `npx`, затем войдите и свяжите
   рабочую копию с проектом:

   ```bash
   npx supabase login
   npx supabase link --project-ref <project-ref>
   ```

   `project-ref` — идентификатор проекта в URL панели Supabase. Команда может
   запросить пароль базы данных.
3. Проверьте список изменений и примените миграции:

   ```bash
   npx supabase db push --dry-run
   npx supabase db push
   ```

   Не редактируйте и не переименовывайте миграции, уже применённые в общем или
   production-проекте. Для новой схемы создавайте следующую миграцию CLI:

   ```bash
   npx supabase migration new <краткое-имя-изменения>
   ```

4. В **Authentication → URL Configuration** добавьте production URL в
   `Site URL` и `Redirect URLs`, если планируете вход в административную панель
   или сброс пароля по email.

### Первый superadmin

После применения миграций в таблице `public.admins` ещё нет пользователя, поэтому
через интерфейс приложения создать первого администратора нельзя. Сначала в
Supabase Dashboard откройте **Authentication → Users → Add user**, создайте и
подтвердите пользователя с email и паролем. Затем в SQL Editor выполните запрос,
подставив UUID созданного пользователя из `auth.users`:

```sql
insert into public.admins (id, email, display_name, role)
values (
  '<uuid-пользователя-из-auth.users>',
  'admin@example.com',
  'Главный администратор',
  'superadmin'
);
```

После первого входа откройте `/admin`. Остальных администраторов создавайте уже
в панели управления. Не выполняйте этот SQL повторно для того же пользователя.

## Настройка Telegram-бота и webhook

1. В [@BotFather](https://t.me/BotFather) выполните `/newbot`, сохраните токен и
   укажите его в `BOT_TOKEN`.
2. Разверните приложение на публичном HTTPS-домене. Укажите этот адрес в
   `WEBAPP_URL`, `NEXT_PUBLIC_WEBAPP_URL` и `MINI_APP_URL`.
3. Задайте `TELEGRAM_WEBHOOK_SECRET`, затем зарегистрируйте webhook. В PowerShell
   удобнее передать данные через `curl.exe`:

   ```powershell
   curl.exe -X POST "https://api.telegram.org/bot$env:BOT_TOKEN/setWebhook" `
     -d "url=https://your-app.example/api/telegram/webhook" `
     -d "secret_token=$env:TELEGRAM_WEBHOOK_SECRET"
   ```

   В Unix-подобной оболочке используйте те же параметры с `$BOT_TOKEN` и
   `$TELEGRAM_WEBHOOK_SECRET`. Маршрут проверяет заголовок
   `X-Telegram-Bot-Api-Secret-Token`; секрет в команде и в окружении приложения
   должен совпадать.
4. Проверьте состояние webhook:

   ```bash
   curl "https://api.telegram.org/bot<BOT_TOKEN>/getWebhookInfo"
   ```

Для локальной разработки Telegram не сможет обратиться к `localhost`; используйте
временный HTTPS-туннель либо разверните тестовое окружение.

## Планировщик уведомлений и кэша

Внешний планировщик должен вызывать два защищённых маршрута с заголовком
`Authorization: Bearer <CRON_SECRET>`:

```text
GET https://your-app.example/api/cron
GET https://your-app.example/api/cron/cleanup-cache
```

Первый маршрут отправляет запланированные уведомления и ориентируется на часовой
пояс `Asia/Tomsk`; запускайте его не реже раза в минуту. Второй удаляет
просроченный кэш; обычно достаточно запуска раз в сутки. Пример проверки:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" \
  https://your-app.example/api/cron
```

Не передавайте `CRON_SECRET` через query string: URL нередко попадает в логи и
историю браузера.

## Деплой

Приложение можно развернуть на любой платформе, поддерживающей Next.js и
переменные окружения (например, Vercel, Docker-инфраструктура или Node.js-сервер).

1. Создайте production-проект Supabase и примените миграции.
2. Подключите репозиторий либо соберите приложение командой `npm run build`.
3. Добавьте все переменные из `.env.example` в настройки окружения платформы.
4. Разверните приложение и убедитесь, что оно открывается по HTTPS.
5. Обновите URLs в настройках Supabase, зарегистрируйте Telegram webhook и
   настройте внешний cron после получения production URL.

Перед релизом выполните:

```bash
npx tsc --noEmit
npm run build
```

## Источник расписания

Расписание, список факультетов и групп загружаются во время работы из
[timetable.tusur.ru](https://timetable.tusur.ru); изображения факультетов могут
дополнительно загружаться с [tusur.ru](https://tusur.ru). Приложение разбирает
публично доступные страницы этих сайтов и кэширует результат в Supabase. Источник
может менять разметку, состав и актуальность данных, поэтому не гарантируйте
абсолютную точность расписания: окончательную информацию следует сверять с
официальными ресурсами университета.

## Команды

```bash
npm run dev       # разработка
npm run build     # production-сборка
npm start         # запуск production-сборки
npx tsc --noEmit  # проверка TypeScript
npm run lint      # текущий lint-процесс (TypeScript)
```

## Вклад в проект

1. Проверьте, нет ли уже подходящего Issue.
2. Для ошибки приложите шаги воспроизведения, ожидаемый и фактический результат.
3. Для изменения создайте ветку от актуальной основной ветки, выполните
   `npx tsc --noEmit` и отправьте Pull Request с понятным описанием.
4. Не включайте ключи, токены, дампы базы и другие персональные данные в Issue,
   коммиты или PR.

Для сообщения об уязвимости не создавайте публичный Issue: свяжитесь с владельцем
репозитория приватно.

## Лицензия

Перед публичным переиспользованием проекта владельцу репозитория следует добавить
файл `LICENSE`. Пока лицензии нет, исходный код доступен для просмотра, но права
на его использование не предоставляются автоматически.

## Релизы

Текущая версия — **2.1.0**. Следующий несовместимый релиз должен повышать старшую
версию согласно Semantic Versioning.
