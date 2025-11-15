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
import {MESSAGES} from '../config/messages.js';

/**
 * Обновляет кэш топиков форума при получении сообщения
 * @param {Object} message - Объект сообщения от Telegram
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<void>}
 */
async function updateForumTopicsCache(message, kv) {
  try {
    // Проверяем, является ли это сообщением из топика
    if (!message.message_thread_id) {
      return;
    }

    const chatId = message.chat.id.toString();
    const threadId = message.message_thread_id.toString();

    // Получаем настройки чата
    const settings = await getChatSettings(kv, chatId);
    if (!settings) {
      return;
    }

    // Инициализируем объект тем, если его нет
    if (!settings.forumTopics) {
      settings.forumTopics = {};
    }

    // Пытаемся получить название темы из разных источников
    let threadName = null;

    // 1. Если это сообщение о создании топика
    if (message.forum_topic_created) {
      threadName = message.forum_topic_created.name;
    }
    // 2. Если это ответ на сообщение с информацией о топике
    else if (message.reply_to_message?.forum_topic_created) {
      threadName = message.reply_to_message.forum_topic_created.name;
    }
    // 3. Проверяем, есть ли название в самом объекте сообщения
    else if (message.forum_topic_edited) {
      threadName = message.forum_topic_edited.name;
    }
    // 4. Если в сообщении есть информация о чате с is_forum
    else if (message.chat?.is_forum && message.is_topic_message) {
      // Используем существующее название из кэша или создаем временное
      threadName = settings.forumTopics[threadId] || null;
    }

    // Если получили название, обновляем кэш
    if (threadName && threadName !== settings.forumTopics[threadId]) {
      settings.forumTopics[threadId] = threadName;
      await saveChatSettings(kv, chatId, settings);
      console.log(`Обновлено название темы ${threadId}: ${threadName}`);
    }
    // Если название не получили, но темы еще нет в кэше, добавляем с ID
    else if (!settings.forumTopics[threadId]) {
      settings.forumTopics[threadId] = `${MESSAGES.TOPIC_PREFIX} ${threadId}`;
      await saveChatSettings(kv, chatId, settings);
      console.log(`Добавлена тема с ID: ${threadId}`);
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


