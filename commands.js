/**
 * Модуль для обработки команд Telegram бота
 */

import {
  getFacultiesWithCache,
  getFacultyCoursesWithCache,
} from './facultyParser.js';
import {
  getChatSettings,
  getUserChats,
  initializeChatSettings,
  isUserAdmin,
  saveChatSettings,
  updateChatSetting,
} from './settings.js';
import {getChatInfo} from './telegram.js';

/**
 * Проверяет, является ли пользователь администратором чата через Telegram API
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @returns {Promise<boolean>} Является ли пользователь администратором
 */
export async function checkTelegramAdmin(botToken, chatId, userId) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/getChatMember`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        chat_id: chatId,
        user_id: userId,
      }),
    });

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    if (!data.ok) {
      return false;
    }

    const status = data.result.status;
    return status === 'creator' || status === 'administrator';
  } catch (error) {
    console.error('Ошибка при проверке прав администратора:', error);
    return false;
  }
}

/**
 * Отправляет сообщение в чат
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @param {string} text - Текст сообщения
 * @param {Object} options - Дополнительные опции (reply_markup, message_thread_id и т.д.)
 * @returns {Promise<Object>} Ответ от Telegram API
 */
export async function sendMessage(botToken, chatId, text, options = {}) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: 'HTML',
    ...options,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return await response.json();
}

/**
 * Редактирует сообщение
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @param {number} messageId - ID сообщения
 * @param {string} text - Новый текст
 * @param {Object} options - Дополнительные опции
 * @returns {Promise<Object>} Ответ от Telegram API
 */
export async function editMessage(
  botToken,
  chatId,
  messageId,
  text,
  options = {}
) {
  const url = `https://api.telegram.org/bot${botToken}/editMessageText`;

  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: 'HTML',
    ...options,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return await response.json();
}

/**
 * Отвечает на callback query
 * @param {string} botToken - Токен бота
 * @param {string} callbackQueryId - ID callback query
 * @param {string} text - Текст уведомления
 * @param {boolean} showAlert - Показать как alert
 * @returns {Promise<Object>} Ответ от Telegram API
 */
export async function answerCallbackQuery(
  botToken,
  callbackQueryId,
  text = '',
  showAlert = false
) {
  const url = `https://api.telegram.org/bot${botToken}/answerCallbackQuery`;

  const body = {
    callback_query_id: callbackQueryId,
    text: text,
    show_alert: showAlert,
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return await response.json();
}

/**
 * Создает inline клавиатуру для настроек чата
 * @param {string} chatId - ID чата
 * @param {Object} settings - Текущие настройки чата
 * @returns {Object} Inline keyboard markup
 */
function createSettingsKeyboard(chatId, settings) {
  const keyboard = [
    [
      {
        text: settings.enabled ? 'Включен' : 'Выключен',
        callback_data: `toggle_enabled:${chatId}`,
      },
    ],
    [
      {
        text: 'Выбрать группу',
        callback_data: `change_group:${chatId}`,
      },
    ],
    [
      {
        text: 'Настроить тему',
        callback_data: `change_thread:${chatId}`,
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
function createChatsListKeyboard(chats) {
  const keyboard = chats.map((chat) => [
    {
      text: `${chat.enabled ? '[Вкл] ' : '[Выкл] '}${
        chat.chatName || `Чат ${chat.chatId}`
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
function createThreadSelectionKeyboard(chatId, forumTopics) {
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
        text: 'Нет доступных тем',
        callback_data: `no_threads:${chatId}`,
      },
    ]);
  }

  // Добавляем кнопку "Назад"
  keyboard.push([
    {
      text: 'Назад к настройкам',
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
function createFacultySelectionKeyboard(chatId, faculties) {
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
      text: 'Назад к настройкам',
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
function createCourseSelectionKeyboard(chatId, facultySlug, courses) {
  const keyboard = [];

  // Сортируем курсы по номеру
  const sortedCourses = Object.values(courses).sort(
    (a, b) => parseInt(a.number) - parseInt(b.number)
  );

  // Группируем курсы по 2 в ряд
  for (let i = 0; i < sortedCourses.length; i += 2) {
    const row = [];

    row.push({
      text: `${sortedCourses[i].number} курс`,
      callback_data: `select_course:${chatId}:${facultySlug}:${sortedCourses[i].number}`,
    });

    if (i + 1 < sortedCourses.length) {
      row.push({
        text: `${sortedCourses[i + 1].number} курс`,
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
      text: 'Назад к факультетам',
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
function createGroupSelectionKeyboard(
  chatId,
  facultySlug,
  courseNumber,
  groups
) {
  const keyboard = [];

  // Группируем группы по 2 в ряд
  for (let i = 0; i < groups.length; i += 2) {
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
      text: 'Назад к курсам',
      callback_data: `back_to_courses:${chatId}:${facultySlug}`,
    },
  ]);

  return {
    inline_keyboard: keyboard,
  };
}

/**
 * Обрабатывает команду /start
 * @param {Object} message - Объект сообщения от Telegram
 * @param {string} botToken - Токен бота
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<void>}
 */
export async function handleStartCommand(message, botToken, kv) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const isPrivate = message.chat.type === 'private';

  if (isPrivate) {
    // В личных сообщениях показываем список чатов
    const userChats = await getUserChats(kv, userId.toString());

    let text = '<b>Добро пожаловать в бот расписания ТУСУР!</b>\n\n';

    if (userChats.length === 0) {
      text += 'У вас пока нет настроенных чатов.\n\n';
      text +=
        'Добавьте бота в групповой чат, и вы сможете управлять им отсюда.';

      await sendMessage(botToken, chatId, text);
    } else {
      text += 'Выберите чат для настройки:';

      await sendMessage(botToken, chatId, text, {
        reply_markup: createChatsListKeyboard(userChats),
      });
    }
  } else {
    // В групповом чате инициализируем настройки
    const isAdmin = await checkTelegramAdmin(botToken, chatId, userId);

    if (!isAdmin) {
      await sendMessage(
        botToken,
        chatId,
        'Только администраторы могут настраивать бота.',
        {
          message_thread_id: message.message_thread_id,
        }
      );
      return;
    }

    // Получаем информацию о чате
    const chatInfo = await getChatInfo(botToken, chatId);
    const chatName = chatInfo?.title || `Чат ${chatId}`;

    const settings = await initializeChatSettings(
      kv,
      chatId.toString(),
      userId.toString(),
      {
        chatName: chatName,
      }
    );

    if (settings) {
      const text =
        '<b>Бот успешно настроен!</b>\n\n' +
        'Используйте команду /settings для настройки параметров.';

      await sendMessage(botToken, chatId, text, {
        message_thread_id: message.message_thread_id,
      });
    } else {
      await sendMessage(
        botToken,
        chatId,
        'Произошла ошибка при настройке бота.',
        {
          message_thread_id: message.message_thread_id,
        }
      );
    }
  }
}

/**
 * Обрабатывает команду /settings
 * @param {Object} message - Объект сообщения от Telegram
 * @param {string} botToken - Токен бота
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<void>}
 */
export async function handleSettingsCommand(message, botToken, kv) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const isPrivate = message.chat.type === 'private';

  if (isPrivate) {
    // В личных сообщениях показываем список чатов
    const userChats = await getUserChats(kv, userId.toString());

    if (userChats.length === 0) {
      await sendMessage(botToken, chatId, 'У вас нет настроенных чатов.');
      return;
    }

    await sendMessage(botToken, chatId, 'Выберите чат для настройки:', {
      reply_markup: createChatsListKeyboard(userChats),
    });
  } else {
    // В групповом чате показываем настройки
    const isAdmin = await checkTelegramAdmin(botToken, chatId, userId);

    if (!isAdmin) {
      await sendMessage(
        botToken,
        chatId,
        'Только администраторы могут просматривать настройки.',
        {
          message_thread_id: message.message_thread_id,
        }
      );
      return;
    }

    const settings = await getChatSettings(kv, chatId.toString());

    if (!settings) {
      await sendMessage(
        botToken,
        chatId,
        'Настройки не найдены. Используйте /start для инициализации.',
        {
          message_thread_id: message.message_thread_id,
        }
      );
      return;
    }

    // Обновляем название чата, если оно изменилось
    const chatInfo = await getChatInfo(botToken, chatId);
    if (chatInfo?.title && chatInfo.title !== settings.chatName) {
      settings.chatName = chatInfo.title;
      await saveChatSettings(kv, chatId.toString(), settings);
    }

    const threadDisplay = settings.threadName
      ? `${settings.threadName} (ID: ${settings.threadId})`
      : settings.threadId
      ? `ID: ${settings.threadId}`
      : 'Не установлена';

    const groupDisplay = settings.groupSlug
      ? settings.groupSlug.toUpperCase()
      : 'Не выбрана';

    const text =
      '<b>Настройки чата</b>\n\n' +
      `<b>Название чата:</b> ${
        settings.chatName || `ID: ${settings.chatId}`
      }\n` +
      `<b>Статус:</b> ${settings.enabled ? 'Включен' : 'Выключен'}\n` +
      `<b>Группа:</b> ${groupDisplay}\n` +
      `<b>Тема (thread):</b> ${threadDisplay}\n\n` +
      'Выберите параметр для изменения:';

    await sendMessage(botToken, chatId, text, {
      message_thread_id: message.message_thread_id,
      reply_markup: createSettingsKeyboard(chatId.toString(), settings),
    });
  }
}

/**
 * Обрабатывает команду /help
 * @param {Object} message - Объект сообщения от Telegram
 * @param {string} botToken - Токен бота
 * @returns {Promise<void>}
 */
export async function handleHelpCommand(message, botToken) {
  const chatId = message.chat.id;
  const isPrivate = message.chat.type === 'private';

  const text =
    '<b>Справка по командам</b>\n\n' +
    '/start - Начать работу с ботом\n' +
    '/settings - Настройки бота\n' +
    '/help - Показать эту справку\n' +
    '/status - Показать текущий статус\n\n' +
    '<b>Как использовать:</b>\n' +
    '1. Добавьте бота в групповой чат\n' +
    '2. Используйте /start для инициализации\n' +
    '3. Настройте параметры через /settings\n' +
    '4. Бот будет автоматически отправлять расписание по расписанию\n\n' +
    (isPrivate
      ? 'Вы также можете управлять всеми чатами из личных сообщений!'
      : '');

  await sendMessage(botToken, chatId, text, {
    message_thread_id: message.message_thread_id,
  });
}

/**
 * Обрабатывает команду /status
 * @param {Object} message - Объект сообщения от Telegram
 * @param {string} botToken - Токен бота
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<void>}
 */
export async function handleStatusCommand(message, botToken, kv) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const isPrivate = message.chat.type === 'private';

  if (isPrivate) {
    const userChats = await getUserChats(kv, userId.toString());

    let text = '<b>Статус ваших чатов</b>\n\n';

    if (userChats.length === 0) {
      text += 'У вас нет настроенных чатов.';
    } else {
      userChats.forEach((chat, index) => {
        text += `${index + 1}. Чат ${chat.chatId}\n`;
        text += `   Статус: ${chat.enabled ? 'Активен' : 'Выключен'}\n`;
        text += `   URL: ${chat.timetableUrl}\n\n`;
      });
    }

    await sendMessage(botToken, chatId, text);
  } else {
    const settings = await getChatSettings(kv, chatId.toString());

    if (!settings) {
      await sendMessage(
        botToken,
        chatId,
        'Бот не настроен. Используйте /start для инициализации.',
        {
          message_thread_id: message.message_thread_id,
        }
      );
      return;
    }

    const statusGroupDisplay = settings.groupSlug
      ? settings.groupSlug.toUpperCase()
      : 'Не выбрана';

    const text =
      '<b>Статус бота</b>\n\n' +
      `Статус: ${settings.enabled ? 'Активен' : 'Выключен'}\n` +
      `Группа: ${statusGroupDisplay}\n` +
      `Тема (thread): ${settings.threadId || 'Не установлена'}\n` +
      `Создан: ${new Date(settings.createdAt).toLocaleString('ru-RU')}\n` +
      `Обновлен: ${new Date(settings.updatedAt).toLocaleString('ru-RU')}`;

    await sendMessage(botToken, chatId, text, {
      message_thread_id: message.message_thread_id,
    });
  }
}

/**
 * Обрабатывает callback query от inline кнопок
 * @param {Object} callbackQuery - Объект callback query от Telegram
 * @param {string} botToken - Токен бота
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<void>}
 */
export async function handleCallbackQuery(callbackQuery, botToken, kv) {
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const messageId = message.message_id;

  const parts = data.split(':');
  const action = parts[0];
  const targetChatId = parts[1];

  // Проверяем права администратора
  const isAdmin = await checkTelegramAdmin(botToken, targetChatId, userId);
  const isAdminInKV = await isUserAdmin(kv, targetChatId, userId.toString());

  if (!isAdmin && !isAdminInKV) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'У вас нет прав для этого действия',
      true
    );
    return;
  }

  const settings = await getChatSettings(kv, targetChatId);

  if (!settings) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      'Настройки не найдены',
      true
    );
    return;
  }

  switch (action) {
    case 'toggle_enabled':
      settings.enabled = !settings.enabled;
      await saveChatSettings(kv, targetChatId, settings);

      const statusThreadDisplay = settings.threadName
        ? `${settings.threadName} (ID: ${settings.threadId})`
        : settings.threadId
        ? `ID: ${settings.threadId}`
        : 'Не установлена';

      const statusGroupDisplay = settings.groupSlug
        ? settings.groupSlug.toUpperCase()
        : 'Не выбрана';

      const statusText =
        '<b>Настройки чата</b>\n\n' +
        `<b>Название чата:</b> ${
          settings.chatName || `ID: ${settings.chatId}`
        }\n` +
        `<b>Статус:</b> ${settings.enabled ? 'Включен' : 'Выключен'}\n` +
        `<b>Группа:</b> ${statusGroupDisplay}\n` +
        `<b>Тема (thread):</b> ${statusThreadDisplay}\n\n` +
        'Выберите параметр для изменения:';

      await editMessage(botToken, chatId, messageId, statusText, {
        reply_markup: createSettingsKeyboard(targetChatId, settings),
      });

      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        settings.enabled ? 'Бот включен' : 'Бот выключен'
      );
      break;

    case 'change_url':
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        'Отправьте новый URL расписания в формате: /seturl <URL>'
      );
      break;

    case 'change_group':
      // Показываем список факультетов
      try {
        const faculties = await getFacultiesWithCache(kv);
        const facultiesText =
          '<b>Выбор группы</b>\n\n' + 'Шаг 1 из 3: Выберите факультет';

        await editMessage(botToken, chatId, messageId, facultiesText, {
          reply_markup: createFacultySelectionKeyboard(targetChatId, faculties),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при получении списка факультетов:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          'Ошибка при загрузке списка факультетов',
          true
        );
      }
      break;

    case 'change_thread':
      // Показываем список доступных тем
      const threadsText =
        '<b>Выбор темы для отправки расписания</b>\n\n' +
        'Выберите тему из списка ниже:';

      await editMessage(botToken, chatId, messageId, threadsText, {
        reply_markup: createThreadSelectionKeyboard(
          targetChatId,
          settings.forumTopics || {}
        ),
      });

      await answerCallbackQuery(botToken, callbackQuery.id);
      break;

    case 'select_chat':
      const threadDisplay = settings.threadName
        ? `${settings.threadName} (ID: ${settings.threadId})`
        : settings.threadId
        ? `ID: ${settings.threadId}`
        : 'Не установлена';

      const selectChatGroupDisplay = settings.groupSlug
        ? settings.groupSlug.toUpperCase()
        : 'Не выбрана';

      const chatText =
        '<b>Настройки чата</b>\n\n' +
        `<b>Название чата:</b> ${
          settings.chatName || `ID: ${settings.chatId}`
        }\n` +
        `<b>Статус:</b> ${settings.enabled ? 'Включен' : 'Выключен'}\n` +
        `<b>Группа:</b> ${selectChatGroupDisplay}\n` +
        `<b>Тема (thread):</b> ${threadDisplay}\n\n` +
        'Выберите параметр для изменения:';

      await editMessage(botToken, chatId, messageId, chatText, {
        reply_markup: createSettingsKeyboard(targetChatId, settings),
      });

      await answerCallbackQuery(botToken, callbackQuery.id);
      break;

    case 'select_thread':
      // Выбор конкретной темы
      const selectedThreadId = parts[2];
      const selectedThreadName =
        settings.forumTopics?.[selectedThreadId] || `Тема ${selectedThreadId}`;

      settings.threadId = selectedThreadId;
      settings.threadName = selectedThreadName;
      await saveChatSettings(kv, targetChatId, settings);

      const successThreadDisplay = settings.threadName
        ? `${settings.threadName} (ID: ${settings.threadId})`
        : `ID: ${settings.threadId}`;

      const successGroupDisplay = settings.groupSlug
        ? settings.groupSlug.toUpperCase()
        : 'Не выбрана';

      const successText =
        '<b>Настройки чата</b>\n\n' +
        `<b>Название чата:</b> ${
          settings.chatName || `ID: ${settings.chatId}`
        }\n` +
        `<b>Статус:</b> ${settings.enabled ? 'Включен' : 'Выключен'}\n` +
        `<b>Группа:</b> ${successGroupDisplay}\n` +
        `<b>Тема (thread):</b> ${successThreadDisplay}\n\n` +
        'Выберите параметр для изменения:';

      await editMessage(botToken, chatId, messageId, successText, {
        reply_markup: createSettingsKeyboard(targetChatId, settings),
      });

      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `Тема установлена: ${selectedThreadName}`
      );
      break;

    case 'back_to_settings':
      // Возврат к настройкам
      const backThreadDisplay = settings.threadName
        ? `${settings.threadName} (ID: ${settings.threadId})`
        : settings.threadId
        ? `ID: ${settings.threadId}`
        : 'Не установлена';

      const backGroupDisplay = settings.groupSlug
        ? settings.groupSlug.toUpperCase()
        : 'Не выбрана';

      const backText =
        '<b>Настройки чата</b>\n\n' +
        `<b>Название чата:</b> ${
          settings.chatName || `ID: ${settings.chatId}`
        }\n` +
        `<b>Статус:</b> ${settings.enabled ? 'Включен' : 'Выключен'}\n` +
        `<b>Группа:</b> ${backGroupDisplay}\n` +
        `<b>Тема (thread):</b> ${backThreadDisplay}\n\n` +
        'Выберите параметр для изменения:';

      await editMessage(botToken, chatId, messageId, backText, {
        reply_markup: createSettingsKeyboard(targetChatId, settings),
      });

      await answerCallbackQuery(botToken, callbackQuery.id);
      break;

    case 'no_threads':
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        'Нет доступных тем. Отправьте команду /setthread в нужной теме чата.',
        true
      );
      break;

    case 'select_faculty':
      // Выбор факультета - показываем курсы
      try {
        const facultySlug = parts[2];
        const courses = await getFacultyCoursesWithCache(kv, facultySlug);

        if (!courses || Object.keys(courses).length === 0) {
          await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            'На этом факультете нет доступных курсов',
            true
          );
          break;
        }

        const coursesText =
          '<b>Выбор группы</b>\n\n' + 'Шаг 2 из 3: Выберите курс';

        await editMessage(botToken, chatId, messageId, coursesText, {
          reply_markup: createCourseSelectionKeyboard(
            targetChatId,
            facultySlug,
            courses
          ),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при получении списка курсов:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          'Ошибка при загрузке списка курсов',
          true
        );
      }
      break;

    case 'select_course':
      // Выбор курса - показываем группы
      try {
        const courseFacultySlug = parts[2];
        const courseNumber = parts[3];
        const coursesData = await getFacultyCoursesWithCache(
          kv,
          courseFacultySlug
        );

        if (!coursesData || !coursesData[courseNumber]) {
          await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            'Курс не найден',
            true
          );
          break;
        }

        const groups = coursesData[courseNumber].groups;

        if (!groups || groups.length === 0) {
          await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            'На этом курсе нет доступных групп',
            true
          );
          break;
        }

        const groupsText =
          '<b>Выбор группы</b>\n\n' + 'Шаг 3 из 3: Выберите группу';

        await editMessage(botToken, chatId, messageId, groupsText, {
          reply_markup: createGroupSelectionKeyboard(
            targetChatId,
            courseFacultySlug,
            courseNumber,
            groups
          ),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при получении списка групп:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          'Ошибка при загрузке списка групп',
          true
        );
      }
      break;

    case 'select_group':
      // Выбор группы - сохраняем в настройки
      try {
        const groupFacultySlug = parts[2];
        const groupSlug = parts[3];
        const groupUrl = `https://timetable.tusur.ru/faculties/${groupFacultySlug}/groups/${groupSlug}`;

        settings.timetableUrl = groupUrl;
        settings.groupSlug = groupSlug;
        settings.facultySlug = groupFacultySlug;
        await saveChatSettings(kv, targetChatId, settings);

        const groupThreadDisplay = settings.threadName
          ? `${settings.threadName} (ID: ${settings.threadId})`
          : settings.threadId
          ? `ID: ${settings.threadId}`
          : 'Не установлена';

        const groupSuccessText =
          '<b>Настройки чата</b>\n\n' +
          `<b>Название чата:</b> ${
            settings.chatName || `ID: ${settings.chatId}`
          }\n` +
          `<b>Статус:</b> ${settings.enabled ? 'Включен' : 'Выключен'}\n` +
          `<b>Группа:</b> ${groupSlug.toUpperCase()}\n` +
          `<b>URL расписания:</b> ${settings.timetableUrl}\n` +
          `<b>Тема (thread):</b> ${groupThreadDisplay}\n\n` +
          'Выберите параметр для изменения:';

        await editMessage(botToken, chatId, messageId, groupSuccessText, {
          reply_markup: createSettingsKeyboard(targetChatId, settings),
        });

        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          `Группа ${groupSlug.toUpperCase()} выбрана`
        );
      } catch (error) {
        console.error('Ошибка при сохранении группы:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          'Ошибка при сохранении группы',
          true
        );
      }
      break;

    case 'back_to_faculties':
      // Возврат к списку факультетов
      try {
        const backFaculties = await getFacultiesWithCache(kv);
        const backFacultiesText =
          '<b>Выбор группы</b>\n\n' + 'Шаг 1 из 3: Выберите факультет';

        await editMessage(botToken, chatId, messageId, backFacultiesText, {
          reply_markup: createFacultySelectionKeyboard(
            targetChatId,
            backFaculties
          ),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при возврате к факультетам:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          'Ошибка при загрузке',
          true
        );
      }
      break;

    case 'back_to_courses':
      // Возврат к списку курсов
      try {
        const backFacultySlug = parts[2];
        const backCourses = await getFacultyCoursesWithCache(
          kv,
          backFacultySlug
        );

        const backCoursesText =
          '<b>Выбор группы</b>\n\n' + 'Шаг 2 из 3: Выберите курс';

        await editMessage(botToken, chatId, messageId, backCoursesText, {
          reply_markup: createCourseSelectionKeyboard(
            targetChatId,
            backFacultySlug,
            backCourses
          ),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при возврате к курсам:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          'Ошибка при загрузке',
          true
        );
      }
      break;

    default:
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        'Неизвестная команда'
      );
  }
}

/**
 * Обрабатывает команду /seturl для изменения URL расписания
 * @param {Object} message - Объект сообщения от Telegram
 * @param {string} botToken - Токен бота
 * @param {KVNamespace} kv - KV namespace
 * @param {string} url - Новый URL
 * @returns {Promise<void>}
 */
export async function handleSetUrlCommand(message, botToken, kv, url) {
  const chatId = message.chat.id;
  const userId = message.from.id;

  const isAdmin = await checkTelegramAdmin(botToken, chatId, userId);

  if (!isAdmin) {
    await sendMessage(
      botToken,
      chatId,
      'Только администраторы могут изменять настройки.',
      {
        message_thread_id: message.message_thread_id,
      }
    );
    return;
  }

  if (!url || !url.startsWith('http')) {
    await sendMessage(
      botToken,
      chatId,
      'Пожалуйста, укажите корректный URL.\nПример: /seturl https://timetable.tusur.ru/faculties/fsu/groups/425-m',
      {
        message_thread_id: message.message_thread_id,
      }
    );
    return;
  }

  const success = await updateChatSetting(
    kv,
    chatId.toString(),
    'timetableUrl',
    url
  );

  if (success) {
    await sendMessage(botToken, chatId, `URL расписания обновлен:\n${url}`, {
      message_thread_id: message.message_thread_id,
    });
  } else {
    await sendMessage(botToken, chatId, 'Ошибка при обновлении URL', {
      message_thread_id: message.message_thread_id,
    });
  }
}

/**
 * Обрабатывает команду /setthread для установки темы (thread) чата
 * @param {Object} message - Объект сообщения от Telegram
 * @param {string} botToken - Токен бота
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<void>}
 */
export async function handleSetThreadCommand(message, botToken, kv) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const threadId = message.message_thread_id;

  const isAdmin = await checkTelegramAdmin(botToken, chatId, userId);

  if (!isAdmin) {
    await sendMessage(
      botToken,
      chatId,
      'Только администраторы могут изменять настройки.',
      {
        message_thread_id: threadId,
      }
    );
    return;
  }

  if (!threadId) {
    await sendMessage(
      botToken,
      chatId,
      'Эта команда должна быть отправлена в теме (топике) чата.',
      {
        message_thread_id: threadId,
      }
    );
    return;
  }

  // Получаем текущие настройки
  const settings = await getChatSettings(kv, chatId.toString());
  if (!settings) {
    await sendMessage(
      botToken,
      chatId,
      'Настройки не найдены. Используйте /start для инициализации.',
      {
        message_thread_id: threadId,
      }
    );
    return;
  }

  // Получаем название темы из сообщения (если это форум)
  const threadName =
    message.reply_to_message?.forum_topic_created?.name ||
    message.is_topic_message
      ? `Тема ${threadId}`
      : null;

  // Обновляем настройки
  settings.threadId = threadId.toString();
  settings.threadName = threadName;

  // Добавляем тему в кэш доступных топиков
  if (!settings.forumTopics) {
    settings.forumTopics = {};
  }
  if (threadName) {
    settings.forumTopics[threadId.toString()] = threadName;
  }

  const success = await saveChatSettings(kv, chatId.toString(), settings);

  if (success) {
    const displayName = threadName
      ? `${threadName} (ID: ${threadId})`
      : `ID: ${threadId}`;
    await sendMessage(
      botToken,
      chatId,
      `Тема для отправки расписания установлена!\n${displayName}`,
      {
        message_thread_id: threadId,
      }
    );
  } else {
    await sendMessage(botToken, chatId, 'Ошибка при установке темы', {
      message_thread_id: threadId,
    });
  }
}

/**
 * Обновляет кэш топиков форума при получении сообщения
 * @param {Object} message - Объект сообщения от Telegram
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<void>}
 */
async function updateForumTopicsCache(message, kv) {
  try {
    // Проверяем, является ли это сообщением из топика
    if (!message.message_thread_id || !message.is_topic_message) {
      return;
    }

    const chatId = message.chat.id.toString();
    const threadId = message.message_thread_id.toString();

    // Получаем настройки чата
    const settings = await getChatSettings(kv, chatId);
    if (!settings) {
      return;
    }

    // Пытаемся получить название темы
    let threadName = null;

    // Если это сообщение о создании топика
    if (message.forum_topic_created) {
      threadName = message.forum_topic_created.name;
    }
    // Если это ответ на сообщение с информацией о топике
    else if (message.reply_to_message?.forum_topic_created) {
      threadName = message.reply_to_message.forum_topic_created.name;
    }
    // Если название уже есть в кэше, не обновляем
    else if (settings.forumTopics?.[threadId]) {
      return;
    }

    // Если получили название, обновляем кэш
    if (threadName) {
      if (!settings.forumTopics) {
        settings.forumTopics = {};
      }
      settings.forumTopics[threadId] = threadName;
      await saveChatSettings(kv, chatId, settings);
    }
  } catch (error) {
    console.error('Ошибка при обновлении кэша топиков:', error);
  }
}

/**
 * Основной обработчик команд
 * @param {Object} update - Объект update от Telegram
 * @param {string} botToken - Токен бота
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<void>}
 */
export async function handleCommand(update, botToken, kv) {
  try {
    if (update.message) {
      const message = update.message;
      const text = message.text || '';

      // Обновляем кэш топиков форума при каждом сообщении
      await updateForumTopicsCache(message, kv);

      if (text.startsWith('/start')) {
        await handleStartCommand(message, botToken, kv);
      } else if (text.startsWith('/settings')) {
        await handleSettingsCommand(message, botToken, kv);
      } else if (text.startsWith('/help')) {
        await handleHelpCommand(message, botToken);
      } else if (text.startsWith('/status')) {
        await handleStatusCommand(message, botToken, kv);
      } else if (text.startsWith('/seturl')) {
        const url = text.split(' ')[1];
        await handleSetUrlCommand(message, botToken, kv, url);
      } else if (text.startsWith('/setthread')) {
        await handleSetThreadCommand(message, botToken, kv);
      }
    } else if (update.callback_query) {
      await handleCallbackQuery(update.callback_query, botToken, kv);
    }
  } catch (error) {
    console.error('Ошибка при обработке команды:', error);
  }
}
