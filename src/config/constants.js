/**
 * Константы и настройки приложения
 */

// URL сайта расписания ТУСУР
export const BASE_URL = 'https://timetable.tusur.ru';

// Время жизни кэша (в секундах)
export const CACHE_TTL = {
  FACULTIES: 86400, // 24 часа
  COURSES: 86400, // 24 часа
  GROUPS: 86400, // 24 часа
};

// Префиксы для ключей в KV хранилище
export const KV_KEYS = {
  CHAT_PREFIX: 'chat:',
  USER_PREFIX: 'user:',
  FACULTIES_CACHE: 'faculties_cache',
  FACULTY_COURSES_PREFIX: 'faculty_courses:',
};

// Дни недели (сокращенные)
export const DAYS_SHORT = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

// Месяцы (сокращенные)
export const MONTHS_SHORT = [
  'янв',
  'фев',
  'мар',
  'апр',
  'май',
  'июн',
  'июл',
  'авг',
  'сен',
  'окт',
  'нояб',
  'дек',
];

// Типы недель
export const WEEK_TYPES = {
  EVEN: 'чётная',
  ODD: 'нечётная',
};

// Настройки по умолчанию для чата
export const DEFAULT_CHAT_SETTINGS = {
  threadId: null,
  timetableUrl: 'https://timetable.tusur.ru/faculties/fsu/groups/425-m',
  enabled: true,
  adminIds: [],
  sendHour: 7, // Час отправки (0-23)
  sendMinute: 0, // Минута отправки (0 или 30)
};

// Настройки по умолчанию для личного чата пользователя
export const DEFAULT_USER_SETTINGS = {
  timetableUrl: 'https://timetable.tusur.ru/faculties/fsu/groups/425-m',
  enabled: false, // По умолчанию выключено
  sendHour: 7,
  sendMinute: 0,
};

// Настройки дебаунса для предотвращения дублирования запросов
export const DEBOUNCE_MS = 1000;

// Telegram API endpoints
export const TELEGRAM_API = {
  BASE_URL: 'https://api.telegram.org/bot',
  METHODS: {
    SEND_MESSAGE: 'sendMessage',
    EDIT_MESSAGE: 'editMessageText',
    ANSWER_CALLBACK: 'answerCallbackQuery',
    GET_CHAT_MEMBER: 'getChatMember',
    GET_CHAT: 'getChat',
  },
};

// Статусы администраторов в Telegram
export const TELEGRAM_ADMIN_STATUSES = ['creator', 'administrator'];

// Типы чатов
export const CHAT_TYPES = {
  PRIVATE: 'private',
  GROUP: 'group',
  SUPERGROUP: 'supergroup',
  CHANNEL: 'channel',
};

// Режим парсинга сообщений
export const PARSE_MODE = 'HTML';

// Количество кнопок в ряду для inline клавиатур
export const KEYBOARD_LAYOUT = {
  COURSES_PER_ROW: 2,
  GROUPS_PER_ROW: 2,
  HOURS_PER_ROW: 6,
  MINUTES_PER_ROW: 2,
};

// Доступные минуты для выбора времени отправки
export const AVAILABLE_MINUTES = [0, 30];

