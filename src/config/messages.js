/**
 * Текстовые сообщения для Telegram бота
 */

export const MESSAGES = {
  // Приветственные сообщения
  WELCOME_PRIVATE: '<b>Добро пожаловать в бот расписания ТУСУР!</b>\n\n',
  WELCOME_NO_CHATS:
    'У вас пока нет настроенных чатов.\n\nДобавьте бота в групповой чат, и вы сможете управлять им отсюда.',
  WELCOME_SELECT_CHAT: 'Выберите чат для настройки:',
  BOT_CONFIGURED: '<b>Бот успешно настроен!</b>\n\nИспользуйте команду /settings для настройки параметров.',

  // Ошибки
  ERROR_ADMIN_ONLY: 'Только администраторы могут настраивать бота.',
  ERROR_ADMIN_ONLY_SETTINGS: 'Только администраторы могут просматривать настройки.',
  ERROR_ADMIN_ONLY_CHANGE: 'Только администраторы могут изменять настройки.',
  ERROR_BOT_SETUP: 'Произошла ошибка при настройке бота.',
  ERROR_NO_SETTINGS: 'Настройки не найдены. Используйте /start для инициализации.',
  ERROR_NO_CHATS: 'У вас нет настроенных чатов.',
  ERROR_BOT_NOT_CONFIGURED: 'Бот не настроен. Используйте /start для инициализации.',
  ERROR_NO_RIGHTS: 'У вас нет прав для этого действия',
  ERROR_SETTINGS_NOT_FOUND: 'Настройки не найдены',
  ERROR_LOADING_FACULTIES: 'Ошибка при загрузке списка факультетов',
  ERROR_LOADING_COURSES: 'Ошибка при загрузке списка курсов',
  ERROR_LOADING_GROUPS: 'Ошибка при загрузке списка групп',
  ERROR_SAVING_GROUP: 'Ошибка при сохранении группы',
  ERROR_LOADING: 'Ошибка при загрузке',
  ERROR_NO_COURSES: 'На этом факультете нет доступных курсов',
  ERROR_COURSE_NOT_FOUND: 'Курс не найден',
  ERROR_NO_GROUPS: 'На этом курсе нет доступных групп',
  ERROR_INVALID_URL: 'Пожалуйста, укажите корректный URL.\nПример: /seturl https://timetable.tusur.ru/faculties/fsu/groups/425-m',
  ERROR_THREAD_COMMAND: 'Эта команда должна быть отправлена в теме (топике) чата.',
  ERROR_THREAD_SETTING: 'Ошибка при установке темы',
  ERROR_URL_UPDATE: 'Ошибка при обновлении URL',
  ERROR_TIMETABLE: '<b>Произошла ошибка при получении расписания</b>\n\nПожалуйста, попробуйте позже или проверьте настройки бота.',

  // Настройки
  SETTINGS_HEADER: '<b>Настройки чата</b>\n\n',
  SETTINGS_SELECT_CHAT: 'Выберите чат для настройки:',
  SETTINGS_SELECT_PARAMETER: 'Выберите параметр для изменения:',
  SETTINGS_CHAT_NAME: '<b>Название чата:</b>',
  SETTINGS_STATUS: '<b>Статус:</b>',
  SETTINGS_GROUP: '<b>Группа:</b>',
  SETTINGS_THREAD: '<b>Тема (thread):</b>',
  SETTINGS_URL: '<b>URL расписания:</b>',
  SETTINGS_NOT_SET: 'Не установлена',
  SETTINGS_NOT_SELECTED: 'Не выбрана',

  // Статусы
  STATUS_ENABLED: 'Включен',
  STATUS_DISABLED: 'Выключен',
  STATUS_ACTIVE: 'Активен',
  STATUS_BOT_ENABLED: 'Бот включен',
  STATUS_BOT_DISABLED: 'Бот выключен',

  // Выбор группы
  GROUP_SELECTION_STEP1: '<b>Выбор группы</b>\n\nШаг 1 из 3: Выберите факультет',
  GROUP_SELECTION_STEP2: '<b>Выбор группы</b>\n\nШаг 2 из 3: Выберите курс',
  GROUP_SELECTION_STEP3: '<b>Выбор группы</b>\n\nШаг 3 из 3: Выберите группу',

  // Выбор темы
  THREAD_SELECTION: '<b>Выбор темы для отправки расписания</b>\n\nВыберите тему из списка ниже:',
  THREAD_NO_TOPICS: 'Нет доступных тем',
  THREAD_SET_SUCCESS: 'Тема установлена:',
  THREAD_SET_COMMAND: 'Нет доступных тем. Отправьте команду /setthread в нужной теме чата.',
  THREAD_CONFIGURED: 'Тема для отправки расписания установлена!',

  // URL
  URL_UPDATED: 'URL расписания обновлен:',
  URL_CHANGE_INSTRUCTION: 'Отправьте новый URL расписания в формате: /seturl <URL>',

  // Группа
  GROUP_SELECTED: 'Группа',
  GROUP_SELECTED_SUFFIX: 'выбрана',

  // Кнопки
  BUTTON_ENABLED: 'Включен',
  BUTTON_DISABLED: 'Выключен',
  BUTTON_SELECT_GROUP: 'Выбрать группу',
  BUTTON_CONFIGURE_THREAD: 'Настроить тему',
  BUTTON_BACK_TO_SETTINGS: 'Назад к настройкам',
  BUTTON_BACK_TO_FACULTIES: 'Назад к факультетам',
  BUTTON_BACK_TO_COURSES: 'Назад к курсам',
  BUTTON_NO_THREADS: 'Нет доступных тем',

  // Справка
  HELP_HEADER: '<b>Справка по командам</b>\n\n',
  HELP_COMMANDS:
    '/start - Начать работу с ботом\n' +
    '/settings - Настройки бота\n' +
    '/help - Показать эту справку\n' +
    '/status - Показать текущий статус\n\n',
  HELP_USAGE:
    '<b>Как использовать:</b>\n' +
    '1. Добавьте бота в групповой чат\n' +
    '2. Используйте /start для инициализации\n' +
    '3. Настройте параметры через /settings\n' +
    '4. Бот будет автоматически отправлять расписание по расписанию\n\n',
  HELP_PRIVATE_NOTE: 'Вы также можете управлять всеми чатами из личных сообщений!',

  // Статус
  STATUS_HEADER: '<b>Статус ваших чатов</b>\n\n',
  STATUS_NO_CHATS: 'У вас нет настроенных чатов.',
  STATUS_BOT_HEADER: '<b>Статус бота</b>\n\n',
  STATUS_CREATED: 'Создан:',
  STATUS_UPDATED: 'Обновлен:',

  // Расписание
  TIMETABLE_HEADER: 'Расписание на',
  TIMETABLE_WEEK: 'Неделя:',
  TIMETABLE_NO_LESSONS: 'На текущий день нет расписания',
  TIMETABLE_NO_LESSONS_TODAY: 'Сегодня нет пар',
  TIMETABLE_LESSON: 'Пара:',
  TIMETABLE_TIME: 'Время:',
  TIMETABLE_TYPE: 'Тип:',
  TIMETABLE_AUDITORIUM: 'Аудитория:',
  TIMETABLE_TEACHER: 'Преподаватель:',
  TIMETABLE_TOTAL: '<b>Всего пар:</b>',

  // Разное
  UNKNOWN_COMMAND: 'Неизвестная команда',
  CHAT_PREFIX: 'Чат',
  TOPIC_PREFIX: 'Тема',
  COURSE_SUFFIX: 'курс',
};

