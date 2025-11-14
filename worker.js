// ==================== FORMATTER ====================
/**
 * Форматирует данные расписания в красивое сообщение для Telegram
 */
function formatTimetableMessage(timetableData) {
  const {weekType, date, dayOfWeek, lessons, message} = timetableData;

  let formattedMessage = `📅 <b>Расписание на ${date}</b>\n`;
  formattedMessage += `📆 <b>Неделя:</b> ${weekType}\n\n`;

  if (message) {
    formattedMessage += `ℹ️ ${message}`;
    return formattedMessage;
  }

  if (lessons && lessons.length > 0) {
    formattedMessage += `📚 <b>Пары на сегодня:</b>\n\n`;

    lessons.forEach((lesson, index) => {
      formattedMessage += `<b>${index + 1}. ${lesson.discipline}</b>\n`;
      formattedMessage += `   ⏰ Время: ${lesson.time}\n`;
      formattedMessage += `   📝 Тип: ${lesson.kind}\n`;

      if (lesson.auditorium) {
        formattedMessage += `   🏫 Аудитория: ${lesson.auditorium}\n`;
      }

      if (lesson.teacher) {
        formattedMessage += `   👨‍🏫 Преподаватель: ${lesson.teacher}\n`;
      }

      formattedMessage += '\n';
    });

    formattedMessage += `━━━━━━━━━━━━━━━\n`;
    formattedMessage += `📊 Всего пар: ${lessons.length}`;
  }

  return formattedMessage;
}

// ==================== PARSER ====================
/**
 * Простой HTML парсер без использования jsdom
 */
function parseTimetable(html, date = new Date()) {
  // Получаем информацию о текущей неделе
  const weekMatch = html.match(
    /class=['"]tile[^'"]*current[^'"]*current-week['"][^>]*>([\s\S]*?)<\/li>/
  );
  let weekType = 'неизвестно';

  if (weekMatch) {
    const weekText = weekMatch[1];
    if (weekText.includes('чётная')) {
      weekType = 'чётная';
    } else if (weekText.includes('нечётная')) {
      weekType = 'нечётная';
    }
  }

  // Форматируем дату для поиска
  const days = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
  const months = [
    'янв',
    'фев',
    'мар',
    'апр',
    'май',
    'июн',
    'июл',
    'авг',
    'сен',
    'окт',
    'нояб',
    'дек',
  ];

  const dayOfWeek = days[date.getDay()];
  const dayOfMonth = date.getDate();
  const month = months[date.getMonth()];

  const dateString = `${dayOfWeek}, ${dayOfMonth} ${month}.`;

  // Ищем все таблицы для мобильной версии
  const allTablesRegex =
    /<table[^>]*visible-xs[^>]*visible-sm[^>]*table-lessons[^>]*>[\s\S]*?<\/table>/gi;
  const allTables = html.match(allTablesRegex);

  console.log(`[DEBUG] Найдено таблиц: ${allTables ? allTables.length : 0}`);
  console.log(`[DEBUG] Ищем дату: ${dateString}`);

  if (!allTables) {
    return {
      weekType,
      date: dateString,
      dayOfWeek: days[date.getDay()],
      lessons: null,
      message: 'На текущий день нет расписания',
    };
  }

  // Ищем таблицу с нужной датой
  let tableHtml = null;

  for (let i = 0; i < allTables.length; i++) {
    const table = allTables[i];

    // Извлекаем дату из заголовка таблицы для отладки
    const headerMatch = table.match(
      /<th[^>]*>[\s\S]*?([а-я]{2},?\s*\d+\s*[а-я]+)/i
    );
    if (headerMatch) {
      console.log(`[DEBUG] Таблица ${i + 1}: ${headerMatch[1]}`);
    }

    // Проверяем разные варианты формата даты
    const patterns = [
      `${dayOfWeek},\\s*${dayOfMonth}\\s*${month}\\.`, // "пт, 14 нояб."
      `${dayOfWeek},\\s*${dayOfMonth}\\s*${month}`, // "пт, 14 нояб"
      `${dayOfWeek}[,\\s]+${dayOfMonth}[\\s]+${month}`, // более гибкий вариант
    ];

    for (const pattern of patterns) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(table)) {
        console.log(`[DEBUG] Найдена таблица! Паттерн: ${pattern}`);
        tableHtml = table;
        break;
      }
    }

    if (tableHtml) break;
  }

  if (!tableHtml) {
    console.log(`[DEBUG] Таблица с датой ${dateString} не найдена`);
    return {
      weekType,
      date: dateString,
      dayOfWeek: days[date.getDay()],
      lessons: null,
      message: 'На текущий день нет расписания',
    };
  }

  const lessons = [];

  // Парсим пары из таблицы (для мобильной версии)
  const rowRegex =
    /<tr[^>]*class=['"][^'"]*lesson[^'"]*['"][^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;
  let rowCount = 0;

  console.log('[DEBUG] Начинаем парсинг строк таблицы');

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    rowCount++;
    const rowHtml = rowMatch[1];

    console.log(`[DEBUG] Обработка строки ${rowCount}`);
    console.log(
      `[DEBUG] HTML строки (первые 300 символов): ${rowHtml.substring(0, 300)}`
    );

    // Извлекаем время - может быть в <th> или <td>
    const timeRegex =
      /<t[hd][^>]*class=['"]time['"][^>]*>[\s\S]*?(\d{1,2}:\d{2})[\s\S]*?(\d{1,2}:\d{2})/;
    const timeMatch = rowHtml.match(timeRegex);

    if (!timeMatch) {
      console.log(`[DEBUG] Время не найдено в строке ${rowCount}`);
      continue;
    }

    const startTime = timeMatch[1].trim();
    const endTime = timeMatch[2].trim();
    const time = `${startTime} - ${endTime}`;
    console.log(`[DEBUG] Найдено время: ${time}`);

    // Ищем все ячейки <td>
    const allCellsRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const allCells = [];
    let cellMatch;

    while ((cellMatch = allCellsRegex.exec(rowHtml)) !== null) {
      allCells.push(cellMatch[1]);
    }

    console.log(`[DEBUG] Найдено ячеек td: ${allCells.length}`);

    // Обычно первая ячейка - время, вторая - пара
    // Но мы уже извлекли время, так что берем вторую ячейку (индекс 0 после времени)
    if (allCells.length === 0) {
      console.log(`[DEBUG] Ячеек td не найдено в строке ${rowCount}`);
      continue;
    }

    // Ищем ячейку с парой (не ячейка времени)
    let lessonHtml = null;
    for (let i = 0; i < allCells.length; i++) {
      const cell = allCells[i];
      // Пропускаем ячейки времени (они содержат только числа, двоеточия и пробелы)
      if (!/^\s*[\d:\s]+\s*$/.test(cell)) {
        lessonHtml = cell;
        console.log(
          `[DEBUG] Содержимое ячейки ${i} (первые 300 символов): ${cell.substring(
            0,
            300
          )}`
        );
        break;
      }
    }

    if (!lessonHtml) {
      console.log(`[DEBUG] Ячейка с парой не найдена в строке ${rowCount}`);
      continue;
    }

    // Проверяем, есть ли вообще пара (не пустая ячейка)
    const trimmedLesson = lessonHtml.trim();
    if (
      trimmedLesson.length < 5 ||
      trimmedLesson.includes('—') ||
      trimmedLesson.includes('&mdash;') ||
      trimmedLesson === '&nbsp;'
    ) {
      console.log(`[DEBUG] Пустая пара в строке ${rowCount}`);
      continue;
    }

    // Извлекаем предмет - ищем span с классом discipline
    let discipline = '';

    // Ищем span с классом discipline (может быть многострочным!)
    const disciplineRegex =
      /<span[^>]*class=['"][^'"]*discipline[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i;
    const disciplineMatch = lessonHtml.match(disciplineRegex);

    if (disciplineMatch) {
      // Убираем лишние пробелы и переносы строк
      let rawDiscipline = disciplineMatch[1].replace(/\s+/g, ' ').trim();

      // Извлекаем текст из тега abbr, если он есть
      const abbrMatch = rawDiscipline.match(/<abbr[^>]*>([^<]+)<\/abbr>/i);
      if (abbrMatch) {
        discipline = abbrMatch[1].trim();
        console.log(`[DEBUG] Предмет найден в abbr: ${discipline}`);
      } else {
        // Удаляем все HTML теги
        discipline = rawDiscipline.replace(/<[^>]*>/g, '').trim();
        console.log(`[DEBUG] Предмет найден в span.discipline: ${discipline}`);
      }
    } else {
      console.log(
        `[DEBUG] Предмет не найден в строке ${rowCount}, ищем в полном HTML (первые 500 символов): ${lessonHtml.substring(
          0,
          500
        )}`
      );
    }

    if (!discipline || discipline.length < 3) {
      console.log(
        `[DEBUG] Предмет пустой или слишком короткий в строке ${rowCount}`
      );
      continue;
    }

    console.log(`[DEBUG] Найден предмет: ${discipline}`);

    // Извлекаем тип занятия
    const kindRegex = /<span[^>]*class=['"]kind['"][^>]*>([^<]+)<\/span>/;
    const kindMatch = lessonHtml.match(kindRegex);
    const kind = kindMatch ? kindMatch[1].trim() : '';
    console.log(`[DEBUG] Тип занятия: ${kind || 'не указан'}`);

    // Извлекаем аудиторию
    let auditorium = '';
    const auditoriumRegex =
      /<span[^>]*class=['"]auditoriums?['"][^>]*>([\s\S]*?)<\/span>/i;
    const auditoriumMatch = lessonHtml.match(auditoriumRegex);

    if (auditoriumMatch) {
      // Извлекаем текст, удаляя HTML теги
      const rawAuditorium = auditoriumMatch[1]
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      auditorium = rawAuditorium;
      console.log(`[DEBUG] Аудитория найдена: ${auditorium}`);
    } else {
      console.log(`[DEBUG] Аудитория не найдена`);
    }

    // Извлекаем преподавателя - может быть в span с классом group или teacher
    let teacher = '';
    const teacherRegex1 =
      /<span[^>]*class=['"]group['"][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/;
    const teacherRegex2 =
      /<a[^>]*href=['"][^'"]*teacher[^'"]*['"][^>]*>([^<]+)<\/a>/;
    const teacherMatch1 = lessonHtml.match(teacherRegex1);
    const teacherMatch2 = lessonHtml.match(teacherRegex2);

    if (teacherMatch1) {
      teacher = teacherMatch1[1].trim();
    } else if (teacherMatch2) {
      teacher = teacherMatch2[1].trim();
    }
    console.log(`[DEBUG] Преподаватель: ${teacher || 'не указан'}`);

    lessons.push({
      time,
      discipline,
      kind,
      auditorium,
      teacher,
    });

    console.log(`[DEBUG] Пара добавлена: ${discipline} (${time})`);
  }

  console.log(
    `[DEBUG] Обработано строк: ${rowCount}, найдено пар: ${lessons.length}`
  );

  if (lessons.length === 0) {
    return {
      weekType,
      date: dateString,
      dayOfWeek: days[date.getDay()],
      lessons: [],
      message: 'Сегодня нет пар',
    };
  }

  return {
    weekType,
    date: dateString,
    dayOfWeek: days[date.getDay()],
    lessons,
    message: null,
  };
}

/**
 * Получает HTML страницы расписания
 */
async function fetchTimetable(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    console.error('Ошибка при получении расписания:', error);
    throw error;
  }
}

// ==================== TELEGRAM BOT ====================
/**
 * Отправляет сообщение через Telegram Bot API
 */
async function sendTelegramMessage(botToken, chatId, threadId, message) {
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
 */
async function sendTimetableToThread(
  botToken,
  chatId,
  threadId,
  timetableUrl,
  date = new Date()
) {
  try {
    console.log(
      `[${new Date().toISOString()}] Начинаем получение расписания...`
    );

    const html = await fetchTimetable(timetableUrl);
    console.log(
      `[${new Date().toISOString()}] HTML получен, начинаем парсинг...`
    );

    const timetableData = parseTimetable(html, date);
    console.log(`[${new Date().toISOString()}] Парсинг завершен:`, {
      weekType: timetableData.weekType,
      date: timetableData.date,
      lessonsCount: timetableData.lessons?.length || 0,
    });

    const message = formatTimetableMessage(timetableData);

    await sendTelegramMessage(botToken, chatId, threadId, message);
    console.log(
      `[${new Date().toISOString()}] Сообщение успешно отправлено в тему ${threadId}`
    );

    return {
      success: true,
      data: timetableData,
    };
  } catch (error) {
    console.error(
      `[${new Date().toISOString()}] Ошибка при отправке расписания:`,
      error
    );

    try {
      const errorMessage =
        '❌ <b>Произошла ошибка при получении расписания</b>\n\n' +
        'Пожалуйста, попробуйте позже или проверьте настройки бота.';

      await sendTelegramMessage(botToken, chatId, threadId, errorMessage);
    } catch (sendError) {
      console.error(
        `[${new Date().toISOString()}] Не удалось отправить сообщение об ошибке:`,
        sendError
      );
    }

    return {
      success: false,
      error: error.message,
    };
  }
}

// ==================== MAIN HANDLER ====================
/**
 * Основная функция обработки запроса на отправку расписания
 */
async function handleRequest(request, env) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[${new Date().toISOString()}] Запуск функции handleRequest`);
  console.log(`${'='.repeat(60)}\n`);

  try {
    const BOT_TOKEN = env?.BOT_TOKEN;
    const CHAT_ID = env?.CHAT_ID;
    const THREAD_ID = env?.THREAD_ID;
    const TIMETABLE_URL =
      env?.TIMETABLE_URL ||
      'https://timetable.tusur.ru/faculties/fsu/groups/425-m';

    if (!BOT_TOKEN) {
      throw new Error('BOT_TOKEN не установлен в переменных окружения');
    }
    if (!CHAT_ID) {
      throw new Error('CHAT_ID не установлен в переменных окружения');
    }
    if (!THREAD_ID) {
      throw new Error('THREAD_ID не установлен в переменных окружения');
    }

    console.log(`[${new Date().toISOString()}] Конфигурация загружена:`);
    console.log(`  - CHAT_ID: ${CHAT_ID}`);
    console.log(`  - THREAD_ID: ${THREAD_ID}`);
    console.log(`  - TIMETABLE_URL: ${TIMETABLE_URL}`);
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
      BOT_TOKEN,
      CHAT_ID,
      THREAD_ID,
      TIMETABLE_URL,
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
