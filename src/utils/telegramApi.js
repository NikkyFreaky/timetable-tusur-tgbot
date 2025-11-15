/**
 * Утилиты для работы с Telegram Bot API
 */

import {PARSE_MODE, TELEGRAM_API, TELEGRAM_ADMIN_STATUSES} from '../config/constants.js';

/**
 * Отправляет сообщение в чат
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @param {string} text - Текст сообщения
 * @param {Object} options - Дополнительные опции (reply_markup, message_thread_id и т.д.)
 * @returns {Promise<Object>} Ответ от Telegram API
 */
export async function sendMessage(botToken, chatId, text, options = {}) {
  const url = `${TELEGRAM_API.BASE_URL}${botToken}/${TELEGRAM_API.METHODS.SEND_MESSAGE}`;

  const body = {
    chat_id: chatId,
    text: text,
    parse_mode: PARSE_MODE,
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
  const url = `${TELEGRAM_API.BASE_URL}${botToken}/${TELEGRAM_API.METHODS.EDIT_MESSAGE}`;

  const body = {
    chat_id: chatId,
    message_id: messageId,
    text: text,
    parse_mode: PARSE_MODE,
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
  const url = `${TELEGRAM_API.BASE_URL}${botToken}/${TELEGRAM_API.METHODS.ANSWER_CALLBACK}`;

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
 * Проверяет, является ли пользователь администратором чата через Telegram API
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @param {string} userId - ID пользователя
 * @returns {Promise<boolean>} Является ли пользователь администратором
 */
export async function checkTelegramAdmin(botToken, chatId, userId) {
  try {
    const url = `${TELEGRAM_API.BASE_URL}${botToken}/${TELEGRAM_API.METHODS.GET_CHAT_MEMBER}`;
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
    return TELEGRAM_ADMIN_STATUSES.includes(status);
  } catch (error) {
    console.error('Ошибка при проверке прав администратора:', error);
    return false;
  }
}

/**
 * Получает информацию о чате
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @returns {Promise<Object|null>} Информация о чате или null
 */
export async function getChatInfo(botToken, chatId) {
  try {
    const url = `${TELEGRAM_API.BASE_URL}${botToken}/${TELEGRAM_API.METHODS.GET_CHAT}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        chat_id: chatId,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    if (!data.ok) {
      return null;
    }

    return data.result;
  } catch (error) {
    console.error('Ошибка при получении информации о чате:', error);
    return null;
  }
}

/**
 * Отправляет расписание в указанную тему чата
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @param {string} threadId - ID темы
 * @param {string} message - Текст сообщения
 * @returns {Promise<Object>} Результат отправки
 */
export async function sendTelegramMessage(botToken, chatId, threadId, message) {
  const url = `${TELEGRAM_API.BASE_URL}${botToken}/${TELEGRAM_API.METHODS.SEND_MESSAGE}`;

  const body = {
    chat_id: chatId,
    text: message,
    parse_mode: PARSE_MODE,
    message_thread_id: parseInt(threadId),
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Telegram API error: ${error}`);
  }

  return await response.json();
}

