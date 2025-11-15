/**
 * Главный обработчик обновлений от Telegram
 */

import {
  handleHelpCommand,
  handleSetThreadCommand,
  handleSetUrlCommand,
  handleSettingsCommand,
  handleStartCommand,
  handleStatusCommand,
} from './commandHandlers.js';
import {handleCallbackQuery} from './callbackHandlers.js';
import {getChatSettings, saveChatSettings} from '../services/settingsService.js';

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
export async function handleUpdate(update, botToken, kv) {
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

