/**
 * Модуль для обработки команд Telegram бота
 */

import {
  getChatSettings,
  saveChatSettings,
  getUserChats,
  initializeChatSettings,
  updateChatSetting,
  isUserAdmin,
} from './settings.js';

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
export async function editMessage(botToken, chatId, messageId, text, options = {}) {
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
export async function answerCallbackQuery(botToken, callbackQueryId, text = '', showAlert = false) {
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
        text: settings.enabled ? '✅ Включен' : '❌ Выключен',
        callback_data: `toggle_enabled:${chatId}`,
      },
    ],
    [
      {
        text: '🔗 Изменить URL расписания',
        callback_data: `change_url:${chatId}`,
      },
    ],
    [
      {
        text: '📍 Настроить тему (thread)',
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
      text: `${chat.enabled ? '✅' : '❌'} Чат ${chat.chatId}`,
      callback_data: `select_chat:${chat.chatId}`,
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
    
    let text = '<b>👋 Добро пожаловать в бот расписания ТУСУР!</b>\n\n';
    
    if (userChats.length === 0) {
      text += 'У вас пока нет настроенных чатов.\n\n';
      text += 'Добавьте бота в групповой чат, и вы сможете управлять им отсюда.';
      
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
      await sendMessage(botToken, chatId, 'Только администраторы могут настраивать бота.', {
        message_thread_id: message.message_thread_id,
      });
      return;
    }

    const settings = await initializeChatSettings(kv, chatId.toString(), userId.toString());
    
    if (settings) {
      const text = '<b>✅ Бот успешно настроен!</b>\n\n' +
        'Используйте команду /settings для настройки параметров.';
      
      await sendMessage(botToken, chatId, text, {
        message_thread_id: message.message_thread_id,
      });
    } else {
      await sendMessage(botToken, chatId, 'Произошла ошибка при настройке бота.', {
        message_thread_id: message.message_thread_id,
      });
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
      await sendMessage(botToken, chatId, 'Только администраторы могут просматривать настройки.', {
        message_thread_id: message.message_thread_id,
      });
      return;
    }

    const settings = await getChatSettings(kv, chatId.toString());
    
    if (!settings) {
      await sendMessage(botToken, chatId, 'Настройки не найдены. Используйте /start для инициализации.', {
        message_thread_id: message.message_thread_id,
      });
      return;
    }

    const text = '<b>⚙️ Настройки бота</b>\n\n' +
      `Статус: ${settings.enabled ? '✅ Включен' : '❌ Выключен'}\n` +
      `URL расписания: ${settings.timetableUrl}\n` +
      `Тема (thread): ${settings.threadId || 'Не установлена'}\n\n` +
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

  const text = '<b>📚 Справка по командам</b>\n\n' +
    '/start - Начать работу с ботом\n' +
    '/settings - Настройки бота\n' +
    '/help - Показать эту справку\n' +
    '/status - Показать текущий статус\n\n' +
    '<b>Как использовать:</b>\n' +
    '1. Добавьте бота в групповой чат\n' +
    '2. Используйте /start для инициализации\n' +
    '3. Настройте параметры через /settings\n' +
    '4. Бот будет автоматически отправлять расписание по расписанию\n\n' +
    (isPrivate ? 'Вы также можете управлять всеми чатами из личных сообщений!' : '');

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
    
    let text = '<b>📊 Статус ваших чатов</b>\n\n';
    
    if (userChats.length === 0) {
      text += 'У вас нет настроенных чатов.';
    } else {
      userChats.forEach((chat, index) => {
        text += `${index + 1}. Чат ${chat.chatId}\n`;
        text += `   Статус: ${chat.enabled ? '✅ Активен' : '❌ Выключен'}\n`;
        text += `   URL: ${chat.timetableUrl}\n\n`;
      });
    }

    await sendMessage(botToken, chatId, text);
  } else {
    const settings = await getChatSettings(kv, chatId.toString());
    
    if (!settings) {
      await sendMessage(botToken, chatId, 'Бот не настроен. Используйте /start для инициализации.', {
        message_thread_id: message.message_thread_id,
      });
      return;
    }

    const text = '<b>📊 Статус бота</b>\n\n' +
      `Статус: ${settings.enabled ? '✅ Активен' : '❌ Выключен'}\n` +
      `URL расписания: ${settings.timetableUrl}\n` +
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

  const [action, targetChatId] = data.split(':');

  // Проверяем права администратора
  const isAdmin = await checkTelegramAdmin(botToken, targetChatId, userId);
  const isAdminInKV = await isUserAdmin(kv, targetChatId, userId.toString());

  if (!isAdmin && !isAdminInKV) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'У вас нет прав для этого действия', true);
    return;
  }

  const settings = await getChatSettings(kv, targetChatId);
  
  if (!settings) {
    await answerCallbackQuery(botToken, callbackQuery.id, 'Настройки не найдены', true);
    return;
  }

  switch (action) {
    case 'toggle_enabled':
      settings.enabled = !settings.enabled;
      await saveChatSettings(kv, targetChatId, settings);
      
      const statusText = '<b>⚙️ Настройки бота</b>\n\n' +
        `Статус: ${settings.enabled ? '✅ Включен' : '❌ Выключен'}\n` +
        `URL расписания: ${settings.timetableUrl}\n` +
        `Тема (thread): ${settings.threadId || 'Не установлена'}\n\n` +
        'Выберите параметр для изменения:';

      await editMessage(botToken, chatId, messageId, statusText, {
        reply_markup: createSettingsKeyboard(targetChatId, settings),
      });
      
      await answerCallbackQuery(botToken, callbackQuery.id, 
        settings.enabled ? 'Бот включен' : 'Бот выключен');
      break;

    case 'change_url':
      await answerCallbackQuery(botToken, callbackQuery.id, 
        'Отправьте новый URL расписания в формате: /seturl <URL>');
      break;

    case 'change_thread':
      await answerCallbackQuery(botToken, callbackQuery.id, 
        'Отправьте команду /setthread в нужной теме чата');
      break;

    case 'select_chat':
      const chatText = '<b>⚙️ Настройки чата</b>\n\n' +
        `ID чата: ${settings.chatId}\n` +
        `Статус: ${settings.enabled ? '✅ Включен' : '❌ Выключен'}\n` +
        `URL расписания: ${settings.timetableUrl}\n` +
        `Тема (thread): ${settings.threadId || 'Не установлена'}\n\n` +
        'Выберите параметр для изменения:';

      await editMessage(botToken, chatId, messageId, chatText, {
        reply_markup: createSettingsKeyboard(targetChatId, settings),
      });
      
      await answerCallbackQuery(botToken, callbackQuery.id);
      break;

    default:
      await answerCallbackQuery(botToken, callbackQuery.id, 'Неизвестная команда');
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
    await sendMessage(botToken, chatId, 'Только администраторы могут изменять настройки.', {
      message_thread_id: message.message_thread_id,
    });
    return;
  }

  if (!url || !url.startsWith('http')) {
    await sendMessage(botToken, chatId, 'Пожалуйста, укажите корректный URL.\nПример: /seturl https://timetable.tusur.ru/faculties/fsu/groups/425-m', {
      message_thread_id: message.message_thread_id,
    });
    return;
  }

  const success = await updateChatSetting(kv, chatId.toString(), 'timetableUrl', url);
  
  if (success) {
    await sendMessage(botToken, chatId, `✅ URL расписания обновлен:\n${url}`, {
      message_thread_id: message.message_thread_id,
    });
  } else {
    await sendMessage(botToken, chatId, '❌ Ошибка при обновлении URL', {
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
    await sendMessage(botToken, chatId, 'Только администраторы могут изменять настройки.', {
      message_thread_id: threadId,
    });
    return;
  }

  if (!threadId) {
    await sendMessage(botToken, chatId, 'Эта команда должна быть отправлена в теме (топике) чата.', {
      message_thread_id: threadId,
    });
    return;
  }

  const success = await updateChatSetting(kv, chatId.toString(), 'threadId', threadId.toString());
  
  if (success) {
    await sendMessage(botToken, chatId, `✅ Тема для отправки расписания установлена!\nThread ID: ${threadId}`, {
      message_thread_id: threadId,
    });
  } else {
    await sendMessage(botToken, chatId, '❌ Ошибка при установке темы', {
      message_thread_id: threadId,
    });
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

