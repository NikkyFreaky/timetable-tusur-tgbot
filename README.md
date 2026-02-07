# TUSUR Timetable Web App

Web-приложение для просмотра расписания занятий ТУСУР. Telegram Mini App с интеграцией в Telegram Bot.

## Основные возможности

- Просмотр расписания по дням и неделям
- Интерактивный выбор группы (факультет → курс → группа)
- Два режима отображения: "По дням" и "Ближайшие"
- Навигация по неделям с автоматическим определением типа (чётная/нечётная)
- Отображение специальных периодов (каникулы, сессия, выходные)
- Интеграция с Telegram Mini App
- Хранение настроек в Supabase

## Развертывание

### Переменные окружения

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
BOT_TOKEN=your-telegram-bot-token
WEBAPP_URL=https://your-app.vercel.app
NEXT_PUBLIC_WEBAPP_URL=https://your-app.vercel.app
```

### Установка зависимостей

```bash
npm install
```

### Запуск разработки

```bash
npm run dev
```

### Сборка

```bash
npm run build
```

## Структура проекта

```
app/                    # Next.js App Router
├── api/                # API routes
│   ├── timetable/      # Расписание
│   ├── faculties/      # Факультеты
│   ├── telegram/       # Telegram webhook
│   ├── users/          # Пользователи
│   └── chats/          # Чаты
├── list/               # Список пользователей
└── page.tsx            # Главная страница

components/             # React компоненты
├── schedule/           # Компоненты расписания
│   ├── schedule-app.tsx       # Главный компонент
│   ├── day-view.tsx            # Вид на день
│   ├── lesson-card.tsx         # Карточка занятия
│   ├── settings-panel.tsx      # Панель настроек
│   └── ...
└── ui/                 # UI компоненты (Radix UI)

lib/                    # Утилиты и типы
├── timetable.ts        # Парсинг расписания
├── schedule-types.ts   # Типы данных
├── schedule-data.ts    # Даты и вычисления
├── supabase.ts        # Supabase клиент
├── telegram-bot.ts    # Telegram Bot API
└── ...                 # Другие утилиты
```

## API Routes

| Endpoint | Описание |
|----------|----------|
| `/api/timetable` | Получение расписания по группе |
| `/api/faculties` | Список факультетов |
| `/api/faculties/[faculty]/courses` | Курсы факультета |
| `/api/users` | Управление пользователями |
| `/api/chats` | Управление чатами |
| `/api/telegram/webhook` | Telegram webhook |

## Технологии

- **Next.js 16** - React фреймворк
- **React 19** - UI библиотека
- **TypeScript** - Типизация
- **Tailwind CSS 4** - Стили
- **Radix UI** - UI компоненты
- **Supabase** - База данных
- **date-fns** - Работа с датами
- **Zod** - Валидация данных

## База данных

### Таблицы Supabase

- `users` - Профили пользователей Telegram
- `chats` - Групповые чаты
- `user_devices` - Устройства пользователей
