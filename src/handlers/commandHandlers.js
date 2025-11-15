/**
 * Обработчики основных команд бота
 */

import {CHAT_TYPES} from '../config/constants.js';
import {MESSAGES} from '../config/messages.js';
import {
  getChatSettings,
  getUserChats,
  getUserSettings,
  initializeChatSettings,
  initializeUserSettings,
  saveChatSettings,
  updateChatSetting,
} from '../services/settingsService.js';
import {checkTelegramAdmin, getChatInfo, sendMessage} from '../utils/telegramApi.js';
import {
  createChatsListKeyboard,
  createMainMenuKeyboard,
  createSettingsKeyboard,
  createUserSettingsKeyboard,
} from '../utils/keyboards.js';

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
  const isPrivate = message.chat.type === CHAT_TYPES.PRIVATE;

  if (isPrivate) {
    // Инициализируем настройки пользователя, если их еще нет
    await initializeUserSettings(kv, userId.toString());

    // В личных сообщениях показываем главное меню
    const text = MESSAGES.WELCOME_PRIVATE + MESSAGES.WELCOME_PERSONAL;

    await sendMessage(botToken, chatId, text, {
      reply_markup: createMainMenuKeyboard(userId.toString()),
    });
  } else {
    // В групповом чате инициализируем настройки
    const isAdmin = await checkTelegramAdmin(botToken, chatId, userId);

    if (!isAdmin) {
      await sendMessage(botToken, chatId, MESSAGES.ERROR_ADMIN_ONLY, {
        message_thread_id: message.message_thread_id,
      });
      return;
    }

    // Получаем информацию о чате
    const chatInfo = await getChatInfo(botToken, chatId);
    const chatName = chatInfo?.title || `${MESSAGES.CHAT_PREFIX} ${chatId}`;

    const settings = await initializeChatSettings(
      kv,
      chatId.toString(),
      userId.toString(),
      {
        chatName: chatName,
      }
    );

    if (settings) {
      await sendMessage(botToken, chatId, MESSAGES.BOT_CONFIGURED, {
        message_thread_id: message.message_thread_id,
      });
    } else {
      await sendMessage(botToken, chatId, MESSAGES.ERROR_BOT_SETUP, {
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
  const isPrivate = message.chat.type === CHAT_TYPES.PRIVATE;

  if (isPrivate) {
    // В личных сообщениях показываем главное меню
    const text = MESSAGES.WELCOME_PRIVATE + MESSAGES.WELCOME_PERSONAL;

    await sendMessage(botToken, chatId, text, {
      reply_markup: createMainMenuKeyboard(userId.toString()),
    });
  } else {
    // В групповом чате показываем настройки
    const isAdmin = await checkTelegramAdmin(botToken, chatId, userId);

    if (!isAdmin) {
      await sendMessage(botToken, chatId, MESSAGES.ERROR_ADMIN_ONLY_SETTINGS, {
        message_thread_id: message.message_thread_id,
      });
      return;
    }

    const settings = await getChatSettings(kv, chatId.toString());

    if (!settings) {
      await sendMessage(botToken, chatId, MESSAGES.ERROR_NO_SETTINGS, {
        message_thread_id: message.message_thread_id,
      });
      return;
    }

    // Обновляем название чата, если оно изменилось
    const chatInfo = await getChatInfo(botToken, chatId);
    if (chatInfo?.title && chatInfo.title !== settings.chatName) {
      settings.chatName = chatInfo.title;
      await saveChatSettings(kv, chatId.toString(), settings);
    }

    const threadDisplay = settings.threadName
      ? settings.threadName
      : settings.threadId
      ? `ID: ${settings.threadId}`
      : MESSAGES.SETTINGS_NOT_SET;

    const groupDisplay = settings.groupSlug
      ? settings.groupSlug.toUpperCase()
      : MESSAGES.SETTINGS_NOT_SELECTED;

    const text =
      MESSAGES.SETTINGS_HEADER +
      `${MESSAGES.SETTINGS_CHAT_NAME} ${
        settings.chatName || `ID: ${settings.chatId}`
      }\n` +
      `${MESSAGES.SETTINGS_STATUS} ${
        settings.enabled ? MESSAGES.STATUS_ENABLED : MESSAGES.STATUS_DISABLED
      }\n` +
      `${MESSAGES.SETTINGS_GROUP} ${groupDisplay}\n` +
      `${MESSAGES.SETTINGS_THREAD} ${threadDisplay}\n\n` +
      MESSAGES.SETTINGS_SELECT_PARAMETER;

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
  const isPrivate = message.chat.type === CHAT_TYPES.PRIVATE;

  const text =
    MESSAGES.HELP_HEADER +
    MESSAGES.HELP_COMMANDS +
    MESSAGES.HELP_USAGE +
    (isPrivate ? MESSAGES.HELP_PRIVATE_NOTE : '');

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
  const isPrivate = message.chat.type === CHAT_TYPES.PRIVATE;

  if (isPrivate) {
    const userChats = await getUserChats(kv, userId.toString());

    let text = MESSAGES.STATUS_HEADER;

    if (userChats.length === 0) {
      text += MESSAGES.STATUS_NO_CHATS;
    } else {
      userChats.forEach((chat, index) => {
        text += `${index + 1}. ${MESSAGES.CHAT_PREFIX} ${chat.chatId}\n`;
        text += `   ${MESSAGES.SETTINGS_STATUS} ${
          chat.enabled ? MESSAGES.STATUS_ACTIVE : MESSAGES.STATUS_DISABLED
        }\n`;
        text += `   URL: ${chat.timetableUrl}\n\n`;
      });
    }

    await sendMessage(botToken, chatId, text);
  } else {
    const settings = await getChatSettings(kv, chatId.toString());

    if (!settings) {
      await sendMessage(botToken, chatId, MESSAGES.ERROR_BOT_NOT_CONFIGURED, {
        message_thread_id: message.message_thread_id,
      });
      return;
    }

    const statusGroupDisplay = settings.groupSlug
      ? settings.groupSlug.toUpperCase()
      : MESSAGES.SETTINGS_NOT_SELECTED;

    const text =
      MESSAGES.STATUS_BOT_HEADER +
      `${MESSAGES.SETTINGS_STATUS} ${
        settings.enabled ? MESSAGES.STATUS_ACTIVE : MESSAGES.STATUS_DISABLED
      }\n` +
      `${MESSAGES.SETTINGS_GROUP} ${statusGroupDisplay}\n` +
      `${MESSAGES.SETTINGS_THREAD} ${settings.threadId || MESSAGES.SETTINGS_NOT_SET}\n` +
      `${MESSAGES.STATUS_CREATED} ${new Date(settings.createdAt).toLocaleString('ru-RU')}\n` +
      `${MESSAGES.STATUS_UPDATED} ${new Date(settings.updatedAt).toLocaleString('ru-RU')}`;

    await sendMessage(botToken, chatId, text, {
      message_thread_id: message.message_thread_id,
    });
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
    await sendMessage(botToken, chatId, MESSAGES.ERROR_ADMIN_ONLY_CHANGE, {
      message_thread_id: message.message_thread_id,
    });
    return;
  }

  if (!url || !url.startsWith('http')) {
    await sendMessage(botToken, chatId, MESSAGES.ERROR_INVALID_URL, {
      message_thread_id: message.message_thread_id,
    });
    return;
  }

  const success = await updateChatSetting(
    kv,
    chatId.toString(),
    'timetableUrl',
    url
  );

  if (success) {
    await sendMessage(
      botToken,
      chatId,
      `${MESSAGES.URL_UPDATED}\n${url}`,
      {
        message_thread_id: message.message_thread_id,
      }
    );
  } else {
    await sendMessage(botToken, chatId, MESSAGES.ERROR_URL_UPDATE, {
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
    await sendMessage(botToken, chatId, MESSAGES.ERROR_ADMIN_ONLY_CHANGE, {
      message_thread_id: threadId,
    });
    return;
  }

  if (!threadId) {
    await sendMessage(botToken, chatId, MESSAGES.ERROR_THREAD_COMMAND, {
      message_thread_id: threadId,
    });
    return;
  }

  // Получаем текущие настройки
  const settings = await getChatSettings(kv, chatId.toString());
  if (!settings) {
    await sendMessage(botToken, chatId, MESSAGES.ERROR_NO_SETTINGS, {
      message_thread_id: threadId,
    });
    return;
  }

  // Пытаемся получить название темы из разных источников
  let threadName = null;
  
  // 1. Из сообщения о создании топика
  if (message.forum_topic_created) {
    threadName = message.forum_topic_created.name;
  }
  // 2. Из ответа на сообщение с информацией о топике
  else if (message.reply_to_message?.forum_topic_created) {
    threadName = message.reply_to_message.forum_topic_created.name;
  }
  // 3. Из редактирования топика
  else if (message.forum_topic_edited) {
    threadName = message.forum_topic_edited.name;
  }
  // 4. Из существующего кэша
  else if (settings.forumTopics?.[threadId.toString()]) {
    threadName = settings.forumTopics[threadId.toString()];
  }
  // 5. Если ничего не нашли, используем ID
  else {
    threadName = `${MESSAGES.TOPIC_PREFIX} ${threadId}`;
  }

  // Обновляем настройки
  settings.threadId = threadId.toString();
  settings.threadName = threadName;

  // Добавляем/обновляем тему в кэше доступных топиков
  if (!settings.forumTopics) {
    settings.forumTopics = {};
  }
  settings.forumTopics[threadId.toString()] = threadName;

  const success = await saveChatSettings(kv, chatId.toString(), settings);

  if (success) {
    const displayName = threadName || `ID: ${threadId}`;
    await sendMessage(
      botToken,
      chatId,
      `${MESSAGES.THREAD_CONFIGURED}\n${displayName}`,
      {
        message_thread_id: threadId,
      }
    );
  } else {
    await sendMessage(botToken, chatId, MESSAGES.ERROR_THREAD_SETTING, {
      message_thread_id: threadId,
    });
  }
}

