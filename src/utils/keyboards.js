/**
 * Утилиты для создания inline клавиатур
 */

import {KEYBOARD_LAYOUT, AVAILABLE_MINUTES} from '../config/constants.js';
import {MESSAGES} from '../config/messages.js';

/**
 * Создает inline клавиатуру для настроек чата
 * @param {string} chatId - ID чата
 * @param {Object} settings - Текущие настройки чата
 * @param {boolean} showBackButton - Показывать ли кнопку "Назад к списку чатов"
 * @returns {Object} Inline keyboard markup
 */
export function createSettingsKeyboard(chatId, settings, showBackButton = false) {
  const keyboard = [
    [
      {
        text: settings.enabled
          ? MESSAGES.BUTTON_ENABLED
          : MESSAGES.BUTTON_DISABLED,
        callback_data: `toggle_enabled:${chatId}`,
      },
    ],
    [
      {
        text: MESSAGES.BUTTON_SELECT_GROUP,
        callback_data: `change_group:${chatId}`,
      },
    ],
    [
      {
        text: MESSAGES.BUTTON_CONFIGURE_THREAD,
        callback_data: `change_thread:${chatId}`,
      },
    ],
    [
      {
        text: MESSAGES.BUTTON_CONFIGURE_TIME,
        callback_data: `change_time:${chatId}`,
      },
    ],
  ];

  // Добавляем кнопку "Назад" если это личные сообщения
  if (showBackButton) {
    keyboard.push([
      {
        text: MESSAGES.BUTTON_BACK_TO_CHATS,
        callback_data: `back_to_chats:${chatId}`,
      },
    ]);
  }

  return {
    inline_keyboard: keyboard,
  };
}

/**
 * Создает inline клавиатуру для настроек личных сообщений пользователя
 * @param {string} userId - ID пользователя
 * @param {Object} settings - Текущие настройки пользователя
 * @returns {Object} Inline keyboard markup
 */
export function createUserSettingsKeyboard(userId, settings) {
  const keyboard = [
    [
      {
        text: settings.enabled
          ? MESSAGES.BUTTON_ENABLED
          : MESSAGES.BUTTON_DISABLED,
        callback_data: `toggle_user_enabled:${userId}`,
      },
    ],
    [
      {
        text: MESSAGES.BUTTON_SELECT_GROUP,
        callback_data: `change_user_group:${userId}`,
      },
    ],
    [
      {
        text: MESSAGES.BUTTON_CONFIGURE_TIME,
        callback_data: `change_user_time:${userId}`,
      },
    ],
    [
      {
        text: MESSAGES.BUTTON_BACK_TO_MAIN,
        callback_data: `back_to_main:${userId}`,
      },
    ],
  ];

  return {
    inline_keyboard: keyboard,
  };
}

/**
 * Создает главное меню для личных сообщений
 * @param {string} userId - ID пользователя
 * @returns {Object} Inline keyboard markup
 */
export function createMainMenuKeyboard(userId) {
  const keyboard = [
    [
      {
        text: MESSAGES.BUTTON_MY_SETTINGS,
        callback_data: `my_settings:${userId}`,
      },
    ],
    [
      {
        text: MESSAGES.BUTTON_GROUP_CHATS,
        callback_data: `group_chats:${userId}`,
      },
    ],
  ];

  return {
    inline_keyboard: keyboard,
  };
}

/**
 * Создает inline клавиатуру для выбора чата в личных сообщениях
 * @param {Array} chats - Список чатов пользователя
 * @returns {Object} Inline keyboard markup
 */
export function createChatsListKeyboard(chats) {
  const keyboard = chats.map((chat) => [
    {
      text: `${chat.enabled ? '✅' : '❌'} ${
        chat.chatName || `${MESSAGES.CHAT_PREFIX} ${chat.chatId}`
      }`,
      callback_data: `select_chat:${chat.chatId}`,
    },
  ]);

  return {
    inline_keyboard: keyboard,
  };
}

/**
 * Создает inline клавиатуру для выбора темы (thread)
 * @param {string} chatId - ID чата
 * @param {Object} forumTopics - Объект с топиками {threadId: threadName}
 * @returns {Object} Inline keyboard markup
 */
export function createThreadSelectionKeyboard(chatId, forumTopics) {
  const keyboard = [];

  if (forumTopics && Object.keys(forumTopics).length > 0) {
    for (const [threadId, threadName] of Object.entries(forumTopics)) {
      keyboard.push([
        {
          text: threadName,
          callback_data: `select_thread:${chatId}:${threadId}`,
        },
      ]);
    }
  } else {
    keyboard.push([
      {
        text: MESSAGES.BUTTON_NO_THREADS,
        callback_data: `no_threads:${chatId}`,
      },
    ]);
  }

  // Добавляем кнопку "Назад"
  keyboard.push([
    {
      text: MESSAGES.BUTTON_BACK_TO_SETTINGS,
      callback_data: `back_to_settings:${chatId}`,
    },
  ]);

  return {
    inline_keyboard: keyboard,
  };
}

/**
 * Создает inline клавиатуру для выбора факультета
 * @param {string} chatId - ID чата
 * @param {Array} faculties - Список факультетов
 * @returns {Object} Inline keyboard markup
 */
export function createFacultySelectionKeyboard(chatId, faculties) {
  const keyboard = [];

  // Группируем факультеты по 1 в ряд для удобства
  for (const faculty of faculties) {
    keyboard.push([
      {
        text: faculty.name,
        callback_data: `select_faculty:${chatId}:${faculty.slug}`,
      },
    ]);
  }

  // Добавляем кнопку "Назад"
  keyboard.push([
    {
      text: MESSAGES.BUTTON_BACK_TO_SETTINGS,
      callback_data: `back_to_settings:${chatId}`,
    },
  ]);

  return {
    inline_keyboard: keyboard,
  };
}

/**
 * Создает inline клавиатуру для выбора курса
 * @param {string} chatId - ID чата
 * @param {string} facultySlug - Slug факультета
 * @param {Object} courses - Объект с курсами
 * @returns {Object} Inline keyboard markup
 */
export function createCourseSelectionKeyboard(chatId, facultySlug, courses) {
  const keyboard = [];

  // Сортируем курсы по номеру
  const sortedCourses = Object.values(courses).sort(
    (a, b) => parseInt(a.number) - parseInt(b.number)
  );

  // Группируем курсы по 2 в ряд
  for (let i = 0; i < sortedCourses.length; i += KEYBOARD_LAYOUT.COURSES_PER_ROW) {
    const row = [];

    row.push({
      text: `${sortedCourses[i].number} ${MESSAGES.COURSE_SUFFIX}`,
      callback_data: `select_course:${chatId}:${facultySlug}:${sortedCourses[i].number}`,
    });

    if (i + 1 < sortedCourses.length) {
      row.push({
        text: `${sortedCourses[i + 1].number} ${MESSAGES.COURSE_SUFFIX}`,
        callback_data: `select_course:${chatId}:${facultySlug}:${
          sortedCourses[i + 1].number
        }`,
      });
    }

    keyboard.push(row);
  }

  // Добавляем кнопку "Назад"
  keyboard.push([
    {
      text: MESSAGES.BUTTON_BACK_TO_FACULTIES,
      callback_data: `back_to_faculties:${chatId}`,
    },
  ]);

  return {
    inline_keyboard: keyboard,
  };
}

/**
 * Создает inline клавиатуру для выбора группы
 * @param {string} chatId - ID чата
 * @param {string} facultySlug - Slug факультета
 * @param {string} courseNumber - Номер курса
 * @param {Array} groups - Список групп
 * @returns {Object} Inline keyboard markup
 */
export function createGroupSelectionKeyboard(
  chatId,
  facultySlug,
  courseNumber,
  groups
) {
  const keyboard = [];

  // Группируем группы по 2 в ряд
  for (let i = 0; i < groups.length; i += KEYBOARD_LAYOUT.GROUPS_PER_ROW) {
    const row = [];

    row.push({
      text: groups[i].name,
      callback_data: `select_group:${chatId}:${facultySlug}:${groups[i].slug}`,
    });

    if (i + 1 < groups.length) {
      row.push({
        text: groups[i + 1].name,
        callback_data: `select_group:${chatId}:${facultySlug}:${
          groups[i + 1].slug
        }`,
      });
    }

    keyboard.push(row);
  }

  // Добавляем кнопку "Назад"
  keyboard.push([
    {
      text: MESSAGES.BUTTON_BACK_TO_COURSES,
      callback_data: `back_to_courses:${chatId}:${facultySlug}`,
    },
  ]);

  return {
    inline_keyboard: keyboard,
  };
}

/**
 * Создает inline клавиатуру для выбора часа отправки
 * @param {string} chatId - ID чата
 * @param {number} currentHour - Текущий выбранный час
 * @returns {Object} Inline keyboard markup
 */
export function createHourSelectionKeyboard(chatId, currentHour = 7) {
  const keyboard = [];

  // Создаем кнопки для часов от 0 до 23
  for (let hour = 0; hour < 24; hour += KEYBOARD_LAYOUT.HOURS_PER_ROW) {
    const row = [];
    for (let i = 0; i < KEYBOARD_LAYOUT.HOURS_PER_ROW && hour + i < 24; i++) {
      const h = hour + i;
      const isSelected = h === currentHour;
      row.push({
        text: isSelected ? `✅ ${h}` : `${h}`,
        callback_data: `select_hour:${chatId}:${h}`,
      });
    }
    keyboard.push(row);
  }

  // Добавляем кнопку "Назад"
  keyboard.push([
    {
      text: MESSAGES.BUTTON_BACK_TO_SETTINGS,
      callback_data: `back_to_settings:${chatId}`,
    },
  ]);

  return {
    inline_keyboard: keyboard,
  };
}

/**
 * Создает inline клавиатуру для выбора минуты отправки
 * @param {string} chatId - ID чата
 * @param {number} currentMinute - Текущая выбранная минута
 * @returns {Object} Inline keyboard markup
 */
export function createMinuteSelectionKeyboard(chatId, currentMinute = 0) {
  const keyboard = [];

  // Создаем кнопки для доступных минут
  const row = [];
  for (const minute of AVAILABLE_MINUTES) {
    const isSelected = minute === currentMinute;
    const minuteStr = minute.toString().padStart(2, '0');
    row.push({
      text: isSelected ? `✅ ${minuteStr}` : minuteStr,
      callback_data: `select_minute:${chatId}:${minute}`,
    });
  }
  keyboard.push(row);

  // Добавляем кнопку "Назад"
  keyboard.push([
    {
      text: MESSAGES.BUTTON_BACK_TO_SETTINGS,
      callback_data: `back_to_settings:${chatId}`,
    },
  ]);

  return {
    inline_keyboard: keyboard,
  };
}

