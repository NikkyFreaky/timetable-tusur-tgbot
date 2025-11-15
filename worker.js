// ==================== IMPORTS ====================
import {getConfig, sendTimetableToThread} from './telegram.js';

// ==================== MAIN HANDLER ====================
/**
 * Основная функция обработки запроса на отправку расписания
 */
async function handleRequest(request, env) {
  try {
    const config = getConfig(env);
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

    const result = await sendTimetableToThread(
      config.botToken,
      config.chatId,
      config.threadId,
      config.timetableUrl,
      now
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
  } catch (error) {
    console.error('Ошибка в handleRequest:', error.message);

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

// ==================== CLOUDFLARE WORKERS EXPORT ====================
/**
 * Экспорт для Cloudflare Workers
 */

let lastRequestTime = 0;
const DEBOUNCE_MS = 1000;

export default {
  async fetch(request, env, ctx) {
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

    return handleRequest(request, env);
  },

  async scheduled(event, env, ctx) {
    const now = Date.now();
    if (now - lastRequestTime < DEBOUNCE_MS) {
      return {success: true, skipped: true, reason: 'Duplicate request'};
    }
    lastRequestTime = now;

    const dummyRequest = new Request('https://worker.local/scheduled');
    const response = await handleRequest(dummyRequest, env);
    return await response.json();
  },
};
