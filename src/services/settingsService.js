/**
 * Сервис для работы с настройками чатов
 * Использует Cloudflare KV для хранения настроек
 */

import {DEFAULT_CHAT_SETTINGS, DEFAULT_USER_SETTINGS, KV_KEYS} from '../config/constants.js';

/**
 * Структура настроек чата:
 * {
 *   chatId: string,
 *   chatName: string, // Название чата
 *   threadId: string,
 *   threadName: string, // Название темы
 *   timetableUrl: string,
 *   enabled: boolean,
 *   adminIds: string[], // ID администраторов, которые могут управлять ботом
 *   createdBy: string, // ID пользователя, который добавил бота
 *   createdAt: string,
 *   updatedAt: string,
 *   forumTopics: Object // Кэш доступных топиков форума {threadId: threadName}
 * }
 */

/**
 * Структура настроек пользователя (для личных сообщений):
 * {
 *   userId: string,
 *   timetableUrl: string,
 *   groupSlug: string,
 *   facultySlug: string,
 *   enabled: boolean,
 *   sendHour: number,
 *   sendMinute: number,
 *   createdAt: string,
 *   updatedAt: string,
 * }
 */

/**
 * Получает настройки чата из KV хранилища
 * @param {KVNamespace} kv - KV namespace
 * @param {string} chatId - ID чата
 * @returns {Promise<Object|null>} Настройки чата или null
 */
export async function getChatSettings(kv, chatId) {
  try {
    const key = `${KV_KEYS.CHAT_PREFIX}${chatId}`;
    const settings = await kv.get(key, 'json');
    return settings;
  } catch (error) {
    console.error(`Ошибка при получении настроек чата ${chatId}:`, error);
    return null;
  }
}

/**
 * Сохраняет настройки чата в KV хранилище
 * @param {KVNamespace} kv - KV namespace
 * @param {string} chatId - ID чата
 * @param {Object} settings - Настройки чата
 * @returns {Promise<boolean>} Успешность операции
 */
export async function saveChatSettings(kv, chatId, settings) {
  try {
    const key = `${KV_KEYS.CHAT_PREFIX}${chatId}`;
    const settingsWithTimestamp = {
      ...settings,
      chatId,
      updatedAt: new Date().toISOString(),
    };

    if (!settings.createdAt) {
      settingsWithTimestamp.createdAt = new Date().toISOString();
    }

    await kv.put(key, JSON.stringify(settingsWithTimestamp));
    return true;
  } catch (error) {
    console.error(`Ошибка при сохранении настроек чата ${chatId}:`, error);
    return false;
  }
}

/**
 * Удаляет настройки чата из KV хранилища
 * @param {KVNamespace} kv - KV namespace
 * @param {string} chatId - ID чата
 * @returns {Promise<boolean>} Успешность операции
 */
export async function deleteChatSettings(kv, chatId) {
  try {
    const key = `${KV_KEYS.CHAT_PREFIX}${chatId}`;
    await kv.delete(key);
    return true;
  } catch (error) {
    console.error(`Ошибка при удалении настроек чата ${chatId}:`, error);
    return false;
  }
}

/**
 * Получает список всех чатов, в которых пользователь является администратором
 * @param {KVNamespace} kv - KV namespace
 * @param {string} userId - ID пользователя
 * @returns {Promise<Array>} Список настроек чатов
 */
export async function getUserChats(kv, userId) {
  try {
    const list = await kv.list({prefix: KV_KEYS.CHAT_PREFIX});
    const chats = [];

    for (const key of list.keys) {
      const settings = await kv.get(key.name, 'json');
      if (
        settings &&
        (settings.createdBy === userId || settings.adminIds?.includes(userId))
      ) {
        chats.push(settings);
      }
    }

    return chats;
  } catch (error) {
    console.error(
      `Ошибка при получении списка чатов пользователя ${userId}:`,
      error
    );
    return [];
  }
}

/**
 * Получает список всех активных чатов для отправки расписания
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<Array>} Список настроек активных чатов
 */
export async function getAllActiveChats(kv) {
  try {
    const list = await kv.list({prefix: KV_KEYS.CHAT_PREFIX});
    const chats = [];

    for (const key of list.keys) {
      const settings = await kv.get(key.name, 'json');
      if (settings && settings.enabled !== false) {
        chats.push(settings);
      }
    }

    return chats;
  } catch (error) {
    console.error('Ошибка при получении списка активных чатов:', error);
    return [];
  }
}

/**
 * Обновляет конкретное поле в настройках чата
 * @param {KVNamespace} kv - KV namespace
 * @param {string} chatId - ID чата
 * @param {string} field - Название поля
 * @param {any} value - Новое значение
 * @returns {Promise<boolean>} Успешность операции
 */
export async function updateChatSetting(kv, chatId, field, value) {
  try {
    const settings = await getChatSettings(kv, chatId);
    if (!settings) {
      return false;
    }

    settings[field] = value;
    return await saveChatSettings(kv, chatId, settings);
  } catch (error) {
    console.error(
      `Ошибка при обновлении поля ${field} чата ${chatId}:`,
      error
    );
    return false;
  }
}

/**
 * Проверяет, является ли пользователь администратором чата
 * @param {KVNamespace} kv - KV namespace
 * @param {string} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @returns {Promise<boolean>} Является ли пользователь администратором
 */
export async function isUserAdmin(kv, chatId, userId) {
  try {
    const settings = await getChatSettings(kv, chatId);
    if (!settings) {
      return false;
    }

    return (
      settings.createdBy === userId || settings.adminIds?.includes(userId)
    );
  } catch (error) {
    console.error(
      `Ошибка при проверке прав администратора для пользователя ${userId} в чате ${chatId}:`,
      error
    );
    return false;
  }
}

/**
 * Инициализирует настройки для нового чата
 * @param {KVNamespace} kv - KV namespace
 * @param {string} chatId - ID чата
 * @param {string} userId - ID пользователя, который добавил бота
 * @param {Object} initialSettings - Начальные настройки (опционально)
 * @returns {Promise<Object|null>} Созданные настройки или null
 */
export async function initializeChatSettings(
  kv,
  chatId,
  userId,
  initialSettings = {}
) {
  try {
    const existingSettings = await getChatSettings(kv, chatId);
    if (existingSettings) {
      return existingSettings;
    }

    const defaultSettings = {
      chatId,
      ...DEFAULT_CHAT_SETTINGS,
      createdBy: userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...initialSettings,
    };

    const success = await saveChatSettings(kv, chatId, defaultSettings);
    return success ? defaultSettings : null;
  } catch (error) {
    console.error(`Ошибка при инициализации настроек чата ${chatId}:`, error);
    return null;
  }
}

/**
 * Получает настройки пользователя из KV хранилища
 * @param {KVNamespace} kv - KV namespace
 * @param {string} userId - ID пользователя
 * @returns {Promise<Object|null>} Настройки пользователя или null
 */
export async function getUserSettings(kv, userId) {
  try {
    const key = `${KV_KEYS.USER_PREFIX}${userId}`;
    const settings = await kv.get(key, 'json');
    return settings;
  } catch (error) {
    console.error(`Ошибка при получении настроек пользователя ${userId}:`, error);
    return null;
  }
}

/**
 * Сохраняет настройки пользователя в KV хранилище
 * @param {KVNamespace} kv - KV namespace
 * @param {string} userId - ID пользователя
 * @param {Object} settings - Настройки пользователя
 * @returns {Promise<boolean>} Успешность операции
 */
export async function saveUserSettings(kv, userId, settings) {
  try {
    const key = `${KV_KEYS.USER_PREFIX}${userId}`;
    const settingsWithTimestamp = {
      ...settings,
      userId,
      updatedAt: new Date().toISOString(),
    };

    if (!settings.createdAt) {
      settingsWithTimestamp.createdAt = new Date().toISOString();
    }

    await kv.put(key, JSON.stringify(settingsWithTimestamp));
    return true;
  } catch (error) {
    console.error(`Ошибка при сохранении настроек пользователя ${userId}:`, error);
    return false;
  }
}

/**
 * Инициализирует настройки для пользователя
 * @param {KVNamespace} kv - KV namespace
 * @param {string} userId - ID пользователя
 * @param {Object} initialSettings - Начальные настройки (опционально)
 * @returns {Promise<Object|null>} Созданные настройки или null
 */
export async function initializeUserSettings(kv, userId, initialSettings = {}) {
  try {
    const existingSettings = await getUserSettings(kv, userId);
    if (existingSettings) {
      return existingSettings;
    }

    const defaultSettings = {
      userId,
      ...DEFAULT_USER_SETTINGS,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...initialSettings,
    };

    const success = await saveUserSettings(kv, userId, defaultSettings);
    return success ? defaultSettings : null;
  } catch (error) {
    console.error(`Ошибка при инициализации настроек пользователя ${userId}:`, error);
    return null;
  }
}

/**
 * Получает список всех активных пользователей для отправки расписания
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<Array>} Список настроек активных пользователей
 */
export async function getAllActiveUsers(kv) {
  try {
    const list = await kv.list({prefix: KV_KEYS.USER_PREFIX});
    const users = [];

    for (const key of list.keys) {
      const settings = await kv.get(key.name, 'json');
      if (settings && settings.enabled === true) {
        users.push(settings);
      }
    }

    return users;
  } catch (error) {
    console.error('Ошибка при получении списка активных пользователей:', error);
    return [];
  }
}

