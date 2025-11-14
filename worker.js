// ==================== IMPORTS ====================
import {getConfig, sendTimetableToThread} from './telegram.js';

// ==================== MAIN HANDLER ====================
/**
 * Основная функция обработки запроса на отправку расписания
 */
async function handleRequest(request, env) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${new Date().toISOString()}] Запуск функции handleRequest`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const config = getConfig(env);

    console.log(`[${new Date().toISOString()}] Конфигурация загружена:`);
    console.log(`  - CHAT_ID: ${config.chatId}`);
    console.log(`  - THREAD_ID: ${config.threadId}`);
    console.log(`  - TIMETABLE_URL: ${config.timetableUrl}`);
    console.log();

    const now = new Date();
    const dayOfWeek = now.getDay();

    console.log(
      `[${new Date().toISOString()}] Проверка дня недели: ${dayOfWeek} (0 = воскресенье)`
    );

    if (dayOfWeek === 0) {
      console.log(
        `[${new Date().toISOString()}] Сегодня воскресенье, расписание не отправляется`
      );

      const result = {
        success: true,
        skipped: true,
        reason: 'Воскресенье - выходной день',
      };

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: {'Content-Type': 'application/json'},
      });
    }

    console.log(
      `[${new Date().toISOString()}] Начинаем отправку расписания...`
    );

    const result = await sendTimetableToThread(
      config.botToken,
      config.chatId,
      config.threadId,
      config.timetableUrl,
      now
    );

    console.log(`\n${'='.repeat(60)}`);
    console.log(
      `[${new Date().toISOString()}] handleRequest завершена успешно`
    );
    console.log(`${'='.repeat(60)}\n`);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {'Content-Type': 'application/json'},
    });
  } catch (error) {
    console.error(`\n${'='.repeat(60)}`);
    console.error(
      `[${new Date().toISOString()}] Ошибка в handleRequest:`,
      error
    );
    console.error(`${'='.repeat(60)}\n`);

    const errorResult = {
      success: false,
      error: error.message,
    };

    return new Response(JSON.stringify(errorResult), {
      status: 500,
      headers: {'Content-Type': 'application/json'},
    });
  }
}

// ==================== CLOUDFLARE WORKERS EXPORT ====================
/**
 * Экспорт для Cloudflare Workers
 */

// Простая защита от дублирования запросов
let lastRequestTime = 0;
const REQUEST_DEBOUNCE_MS = 1000; // 1 секунда

export default {
  async fetch(request, env, ctx) {
    // Проверяем, не был ли недавно обработан такой же запрос
    const now = Date.now();
    if (now - lastRequestTime < REQUEST_DEBOUNCE_MS) {
      console.log('[DEBUG] Запрос проигнорирован (дублирование)');
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          reason: 'Duplicate request within debounce period',
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
    // Проверяем дублирование для cron
    const now = Date.now();
    if (now - lastRequestTime < REQUEST_DEBOUNCE_MS) {
      console.log('[DEBUG] Cron запрос проигнорирован (дублирование)');
      return {
        success: true,
        skipped: true,
        reason: 'Duplicate cron request within debounce period',
      };
    }
    lastRequestTime = now;

    console.log(`\n${'*'.repeat(60)}`);
    console.log(`[${new Date().toISOString()}] Запуск по Cron Trigger`);
    console.log(
      `Scheduled time: ${new Date(event.scheduledTime).toISOString()}`
    );
    console.log(`${'*'.repeat(60)}\n`);

    const dummyRequest = new Request('https://worker.local/scheduled');

    try {
      const response = await handleRequest(dummyRequest, env);
      const result = await response.json();

      console.log('\n📊 Результат выполнения Cron Trigger:');
      console.log(JSON.stringify(result, null, 2));

      return result;
    } catch (error) {
      console.error('❌ Ошибка в Cron Trigger:', error);
      throw error;
    }
  },
};
