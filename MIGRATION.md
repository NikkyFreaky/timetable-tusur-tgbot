# Миграция данных в Supabase ✅ ЗАВЕРШЕНА

## Статус миграции

- ✅ 3 пользователя перенесены
- ✅ 3 устройства перенесены
- ✅ Бэкап создан: `data/users.json.backup`

## Что было сделано

### 1. Установленные зависимости
- `@supabase/supabase-js` - клиент Supabase
- `dotenv` - загрузка переменных окружения
- `tsx` - выполнение TypeScript скриптов

### 2. Созданные файлы
- `lib/supabase.ts` - клиент Supabase с типами
- `lib/user-store.ts` - переписан для работы с Supabase
- `lib/chat-store.ts` - переписан для работы с Supabase
- `supabase-schema.sql` - SQL схема базы данных
- `scripts/migrate-to-supabase.ts` - скрипт миграции
- `scripts/apply-schema.ts` - скрипт применения схемы
- `.env.local` - переменные окружения
- `.env.example` - пример переменных окружения

### 3. Структура базы данных

**Таблица users:**
- `id` - Telegram ID
- `first_name`, `last_name`, `username`, `photo_url`
- `language_code`, `is_premium`, `is_bot`
- `settings` - JSONB с настройками пользователя
- `notification_state` - JSONB для уведомлений
- `created_at`, `updated_at`, `last_seen_at`

**Таблица chats:**
- `id` - Telegram Chat ID
- `type`, `title`, `username`, `photo_url`
- `settings` - JSONB с настройками чата
- `notification_state` - JSONB для уведомлений

**Таблица user_devices:**
- `id` - ID устройства (хэш)
- `user_id` - ссылка на пользователя
- `label`, `tg_platform`, `tg_version`, `platform`
- `first_seen_at`, `last_seen_at`

## Важно

⚠️ **SQL схема была применена вручную**

Для повторного создания таблиц откройте SQL Editor:
https://supabase.com/dashboard/project/wujyhmdwhgvyhkxxvbta/sql

И выполните содержимое `supabase-schema.sql`

## Переменные окружения

Для продакшена добавьте в Vercel Environment Variables:
```
NEXT_PUBLIC_SUPABASE_URL=https://wujyhmdwhgvyhkxxvbta.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_Q-v2yW1ad76XGzWDVWUGTw_iRqCz6Kq
```

## Откат

```sql
-- Удалить все данные из Supabase
TRUNCATE user_devices CASCADE;
TRUNCATE chats CASCADE;
TRUNCATE users CASCADE;

-- Восстановить JSON файлы
mv data/users.json.backup data/users.json
```

