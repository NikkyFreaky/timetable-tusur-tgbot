/**
 * Модуль для работы с Telegram Bot API
 */

import {parseTimetable, fetchTimetable} from './parser.js';
import {formatTimetableMessage, formatErrorMessage} from './formatter.js';

/**
 * Отправляет сообщение через Telegram Bot API
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @param {string} threadId - ID темы (топика)
 * @param {string} message - Текст сообщения
 * @returns {Promise<Object>} Ответ от Telegram API
 */
export async function sendTelegramMessage(botToken, chatId, threadId, message) {
  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const body = {
    chat_id: chatId,
    text: message,
    parse_mode: 'HTML',
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

/**
 * Отправляет расписание в указанную тему чата
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @param {string} threadId - ID темы
 * @param {string} timetableUrl - URL страницы расписания
 * @param {Date} date - Дата для получения расписания
 * @returns {Promise<Object>} Результат отправки
 */
export async function sendTimetableToThread(
  botToken,
  chatId,
  threadId,
  timetableUrl,
  date = new Date()
) {
  try {
    const html = await fetchTimetable(timetableUrl);
    const timetableData = parseTimetable(html, date);
    const message = formatTimetableMessage(timetableData);

    await sendTelegramMessage(botToken, chatId, threadId, message);

    return {
      success: true,
      data: timetableData,
    };
  } catch (error) {
    console.error('Ошибка при отправке расписания:', error.message);

    try {
      const errorMessage = formatErrorMessage();
      await sendTelegramMessage(botToken, chatId, threadId, errorMessage);
    } catch (sendError) {
      console.error('Не удалось отправить сообщение об ошибке');
    }

    return {
      success: false,
      error: error.message,
    };
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
    const url = `https://api.telegram.org/bot${botToken}/getChat`;
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
 * Получает список тем (форум топиков) в чате
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @returns {Promise<Array>} Список тем или пустой массив
 */
export async function getForumTopics(botToken, chatId) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/getForumTopicIconStickers`;
    
    // Сначала проверим, является ли чат форумом
    const chatInfo = await getChatInfo(botToken, chatId);
    if (!chatInfo || !chatInfo.is_forum) {
      return [];
    }

    // Получаем список топиков через метод getForumTopicIconStickers не работает
    // Используем альтернативный подход - сохраняем топики при получении сообщений
    return [];
  } catch (error) {
    console.error('Ошибка при получении списка тем:', error);
    return [];
  }
}

/**
 * Получает информацию о теме форума
 * @param {string} botToken - Токен бота
 * @param {string} chatId - ID чата
 * @param {string} threadId - ID темы
 * @returns {Promise<Object|null>} Информация о теме или null
 */
export async function getForumTopicInfo(botToken, chatId, threadId) {
  try {
    // К сожалению, Telegram Bot API не предоставляет прямого метода для получения информации о топике
    // Информацию можно получить только из сообщений в этом топике
    // Возвращаем null, информация будет сохраняться при получении сообщений
    return null;
  } catch (error) {
    console.error('Ошибка при получении информации о теме:', error);
    return null;
  }
}

/**
 * Валидирует конфигурацию бота
 * @param {Object} env - Объект с переменными окружения
 * @throws {Error} Если конфигурация невалидна
 */
export function validateConfig(env) {
  if (!env?.BOT_TOKEN) {
    throw new Error('BOT_TOKEN не установлен в переменных окружения');
  }
  if (!env?.CHAT_ID) {
    throw new Error('CHAT_ID не установлен в переменных окружения');
  }
  if (!env?.THREAD_ID) {
    throw new Error('THREAD_ID не установлен в переменных окружения');
  }
}

/**
 * Получает конфигурацию из переменных окружения
 * @param {Object} env - Объект с переменными окружения
 * @returns {Object} Объект с конфигурацией
 */
export function getConfig(env) {
  validateConfig(env);

  return {
    botToken: env.BOT_TOKEN,
    chatId: env.CHAT_ID,
    threadId: env.THREAD_ID,
    timetableUrl:
      env.TIMETABLE_URL ||
      'https://timetable.tusur.ru/faculties/fsu/groups/425-m',
  };
}

