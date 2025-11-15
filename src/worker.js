/**
 * Cloudflare Worker для бота расписания ТУСУР
 */

import {DEBOUNCE_MS} from './config/constants.js';
import {handleUpdate} from './handlers/updateHandler.js';
import {formatErrorMessage, formatTimetableMessage} from './utils/formatter.js';
import {sendMessage, sendTelegramMessage} from './utils/telegramApi.js';
import {fetchTimetable, parseTimetable} from './parsers/timetableParser.js';
import {getAllActiveChats, getAllActiveUsers} from './services/settingsService.js';

/**
 * Отправляет расписание в конкретный чат
 * @param {string} botToken - Токен бота
 * @param {Object} chatSettings - Настройки чата
 * @param {Date} date - Дата для получения расписания
 * @returns {Promise<Object>} Результат отправки
 */
async function sendTimetableToChat(botToken, chatSettings, date = new Date()) {
  try {
    const html = await fetchTimetable(chatSettings.timetableUrl);
    const timetableData = parseTimetable(html, date);
    const message = formatTimetableMessage(timetableData);

    await sendTelegramMessage(
      botToken,
      chatSettings.chatId,
      chatSettings.threadId,
      message
    );

    return {
      success: true,
      chatId: chatSettings.chatId,
      data: timetableData,
    };
  } catch (error) {
    console.error(
      `Ошибка при отправке расписания в чат ${chatSettings.chatId}:`,
      error.message
    );

    try {
      const errorMessage = formatErrorMessage();
      await sendTelegramMessage(
        botToken,
        chatSettings.chatId,
        chatSettings.threadId,
        errorMessage
      );
    } catch (sendError) {
      // Игнорируем ошибки отправки сообщения об ошибке
    }

    return {
      success: false,
      chatId: chatSettings.chatId,
      error: error.message,
    };
  }
}

/**
 * Отправляет расписание конкретному пользователю в личные сообщения
 * @param {string} botToken - Токен бота
 * @param {Object} userSettings - Настройки пользователя
 * @param {Date} date - Дата для получения расписания
 * @returns {Promise<Object>} Результат отправки
 */
async function sendTimetableToUser(botToken, userSettings, date = new Date()) {
  try {
    const html = await fetchTimetable(userSettings.timetableUrl);
    const timetableData = parseTimetable(html, date);
    const message = formatTimetableMessage(timetableData);

    await sendMessage(botToken, userSettings.userId, message);

    return {
      success: true,
      userId: userSettings.userId,
      data: timetableData,
    };
  } catch (error) {
    console.error(
      `Ошибка при отправке расписания пользователю ${userSettings.userId}:`,
      error.message
    );

    try {
      const errorMessage = formatErrorMessage();
      await sendMessage(botToken, userSettings.userId, errorMessage);
    } catch (sendError) {
      // Игнорируем ошибки отправки сообщения об ошибке
    }

    return {
      success: false,
      userId: userSettings.userId,
      error: error.message,
    };
  }
}

/**
 * Обработка webhook от Telegram
 * @param {Request} request - HTTP запрос
 * @param {Object} env - Переменные окружения
 * @returns {Promise<Response>} HTTP ответ
 */
async function handleWebhook(request, env) {
  try {
    const update = await request.json();

    if (!env.BOT_TOKEN) {
      throw new Error('BOT_TOKEN не установлен');
    }

    if (!env.SETTINGS_KV) {
      throw new Error('SETTINGS_KV не настроен');
    }

    await handleUpdate(update, env.BOT_TOKEN, env.SETTINGS_KV);

    return new Response(JSON.stringify({ok: true}), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
  } catch (error) {
    console.error('Ошибка при обработке webhook:', error.message);

    return new Response(
      JSON.stringify({
        ok: false,
        error: error.message,
      }),
      {
        status: 200, // Telegram требует 200 даже при ошибке
        headers: {'Content-Type': 'application/json'},
      }
    );
  }
}

/**
 * Получает текущее время в томском часовом поясе (UTC+7)
 * @param {Date} now - Текущее время в UTC
 * @returns {Object} Объект с часом и минутой в томском времени
 */
function getTomskTime(now) {
  // Томск находится в часовом поясе UTC+7
  const TOMSK_OFFSET = 7 * 60; // 7 часов в минутах
  
  // Получаем время в минутах с начала дня в UTC
  const utcMinutes = now.getUTCHours() * 60 + now.getUTCMinutes();
  
  // Добавляем смещение для Томска
  const tomskMinutes = (utcMinutes + TOMSK_OFFSET) % (24 * 60);
  
  return {
    hour: Math.floor(tomskMinutes / 60),
    minute: tomskMinutes % 60,
  };
}

/**
 * Проверяет, должно ли расписание быть отправлено в данный момент для конкретного чата или пользователя
 * @param {Object} settings - Настройки чата или пользователя
 * @param {Date} now - Текущее время в UTC
 * @returns {boolean} Должно ли быть отправлено расписание
 */
function shouldSendTimetable(settings, now) {
  // Получаем текущее время в томском часовом поясе
  const tomskTime = getTomskTime(now);
  
  const sendHour = settings.sendHour ?? 7;
  const sendMinute = settings.sendMinute ?? 0;
  
  // Проверяем, совпадает ли текущее время с настроенным временем отправки
  return tomskTime.hour === sendHour && tomskTime.minute === sendMinute;
}

/**
 * Основная функция обработки запроса на отправку расписания по расписанию
 * @param {Request} request - HTTP запрос
 * @param {Object} env - Переменные окружения
 * @returns {Promise<Response>} HTTP ответ
 */
async function handleScheduledTimetable(request, env) {
  try {
    if (!env.BOT_TOKEN) {
      throw new Error('BOT_TOKEN не установлен');
    }

    if (!env.SETTINGS_KV) {
      throw new Error('SETTINGS_KV не настроен');
    }

    const now = new Date();

    // Пропускаем воскресенье
    if (now.getDay() === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Воскресенье - выходной день',
        }),
        {
          status: 200,
          headers: {'Content-Type': 'application/json'},
        }
      );
    }

    // Получаем все активные чаты и пользователей
    const activeChats = await getAllActiveChats(env.SETTINGS_KV);
    const activeUsers = await getAllActiveUsers(env.SETTINGS_KV);

    if (activeChats.length === 0 && activeUsers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Нет активных чатов и пользователей',
        }),
        {
          status: 200,
          headers: {'Content-Type': 'application/json'},
        }
      );
    }

    // Фильтруем чаты и пользователей, для которых настало время отправки
    const chatsToSend = activeChats.filter((chatSettings) =>
      shouldSendTimetable(chatSettings, now)
    );
    
    const usersToSend = activeUsers.filter((userSettings) =>
      shouldSendTimetable(userSettings, now)
    );

    if (chatsToSend.length === 0 && usersToSend.length === 0) {
      const tomskTime = getTomskTime(now);
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Нет чатов и пользователей для отправки в текущее время',
          currentTime: `${tomskTime.hour.toString().padStart(2, '0')}:${tomskTime.minute.toString().padStart(2, '0')} (Томск, UTC+7)`,
          currentTimeUTC: `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')} (UTC)`,
          totalActiveChats: activeChats.length,
          totalActiveUsers: activeUsers.length,
        }),
        {
          status: 200,
          headers: {'Content-Type': 'application/json'},
        }
      );
    }

    // Отправляем расписание в чаты и пользователям, для которых настало время
    const chatResults = await Promise.all(
      chatsToSend.map((chatSettings) =>
        sendTimetableToChat(env.BOT_TOKEN, chatSettings, now)
      )
    );
    
    const userResults = await Promise.all(
      usersToSend.map((userSettings) =>
        sendTimetableToUser(env.BOT_TOKEN, userSettings, now)
      )
    );

    const allResults = [...chatResults, ...userResults];
    const successCount = allResults.filter((r) => r.success).length;
    const failCount = allResults.filter((r) => !r.success).length;
    const tomskTime = getTomskTime(now);

    return new Response(
      JSON.stringify({
        success: true,
        totalChats: chatsToSend.length,
        totalUsers: usersToSend.length,
        successCount,
        failCount,
        currentTime: `${tomskTime.hour.toString().padStart(2, '0')}:${tomskTime.minute.toString().padStart(2, '0')} (Томск, UTC+7)`,
        currentTimeUTC: `${now.getUTCHours().toString().padStart(2, '0')}:${now.getUTCMinutes().toString().padStart(2, '0')} (UTC)`,
        results: allResults,
      }),
      {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }
    );
  } catch (error) {
    console.error('Ошибка в handleScheduledTimetable:', error.message);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 500,
        headers: {'Content-Type': 'application/json'},
      }
    );
  }
}

// Переменные для дебаунса
let lastRequestTime = 0;

/**
 * Экспорт для Cloudflare Workers
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Обработка webhook от Telegram
    if (request.method === 'POST' && url.pathname === '/webhook') {
      return handleWebhook(request, env);
    }

    // Ручной запуск отправки расписания
    if (url.pathname === '/send-timetable' || url.pathname === '/') {
      const now = Date.now();
      if (now - lastRequestTime < DEBOUNCE_MS) {
        return new Response(
          JSON.stringify({
            success: true,
            skipped: true,
            reason: 'Duplicate request',
          }),
          {
            status: 200,
            headers: {'Content-Type': 'application/json'},
          }
        );
      }
      lastRequestTime = now;

      return handleScheduledTimetable(request, env);
    }

    // Информационная страница
    return new Response(
      JSON.stringify({
        name: 'TUSUR Timetable Bot',
        version: '2.0.0',
        endpoints: {
          '/webhook': 'POST - Telegram webhook endpoint',
          '/send-timetable': 'GET/POST - Manually trigger timetable sending',
        },
      }),
      {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      }
    );
  },

  async scheduled(event, env, ctx) {
    const now = Date.now();
    if (now - lastRequestTime < DEBOUNCE_MS) {
      return {success: true, skipped: true, reason: 'Duplicate request'};
    }
    lastRequestTime = now;

    const dummyRequest = new Request('https://worker.local/scheduled');
    const response = await handleScheduledTimetable(dummyRequest, env);
    return await response.json();
  },
};

