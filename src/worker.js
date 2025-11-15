/**
 * Cloudflare Worker для бота расписания ТУСУР
 */

import {DEBOUNCE_MS} from './config/constants.js';
import {handleUpdate} from './handlers/updateHandler.js';
import {formatErrorMessage, formatTimetableMessage} from './utils/formatter.js';
import {sendTelegramMessage} from './utils/telegramApi.js';
import {fetchTimetable, parseTimetable} from './parsers/timetableParser.js';
import {getAllActiveChats} from './services/settingsService.js';

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
      console.error('Не удалось отправить сообщение об ошибке');
    }

    return {
      success: false,
      chatId: chatSettings.chatId,
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
 * Проверяет, должно ли расписание быть отправлено в данный момент для конкретного чата
 * @param {Object} chatSettings - Настройки чата
 * @param {Date} now - Текущее время
 * @returns {boolean} Должно ли быть отправлено расписание
 */
function shouldSendTimetable(chatSettings, now) {
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  
  const sendHour = chatSettings.sendHour ?? 7;
  const sendMinute = chatSettings.sendMinute ?? 0;
  
  // Проверяем, совпадает ли текущее время с настроенным временем отправки
  return currentHour === sendHour && currentMinute === sendMinute;
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

    // Получаем все активные чаты
    const activeChats = await getAllActiveChats(env.SETTINGS_KV);

    if (activeChats.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Нет активных чатов',
        }),
        {
          status: 200,
          headers: {'Content-Type': 'application/json'},
        }
      );
    }

    // Фильтруем чаты, для которых настало время отправки
    const chatsToSend = activeChats.filter((chatSettings) =>
      shouldSendTimetable(chatSettings, now)
    );

    if (chatsToSend.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Нет чатов для отправки в текущее время',
          currentTime: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
          totalActiveChats: activeChats.length,
        }),
        {
          status: 200,
          headers: {'Content-Type': 'application/json'},
        }
      );
    }

    // Отправляем расписание в чаты, для которых настало время
    const results = await Promise.all(
      chatsToSend.map((chatSettings) =>
        sendTimetableToChat(env.BOT_TOKEN, chatSettings, now)
      )
    );

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return new Response(
      JSON.stringify({
        success: true,
        totalChats: chatsToSend.length,
        successCount,
        failCount,
        currentTime: `${now.getHours()}:${now.getMinutes().toString().padStart(2, '0')}`,
        results,
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

