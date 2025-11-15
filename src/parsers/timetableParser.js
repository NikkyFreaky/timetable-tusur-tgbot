/**
 * Парсер для получения расписания группы
 */

import {DAYS_SHORT, MONTHS_SHORT, WEEK_TYPES} from '../config/constants.js';

/**
 * Извлекает тип недели из HTML
 * @param {string} html - HTML код страницы
 * @returns {string|null} Тип недели или null
 */
function extractWeekType(html) {
  const patterns = [
    /<li[^>]*current-week[^>]*>([\s\S]*?)<\/li>/i,
    /<li[^>]*current[^>]*>([\s\S]*?)(чётная|нечётная|четная|нечетная)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      const text = match[1] || match[2];
      if (text.includes('чётная') || text.includes('четная'))
        return WEEK_TYPES.EVEN;
      if (text.includes('нечётная') || text.includes('нечетная'))
        return WEEK_TYPES.ODD;
    }
  }

  return null;
}

/**
 * Вычисляет тип недели по дате
 * @param {Date} date - Дата для вычисления
 * @returns {string} Тип недели
 */
function calculateWeekType(date) {
  const year =
    date.getMonth() >= 8 ? date.getFullYear() : date.getFullYear() - 1;
  const startDate = new Date(year, 8, 1);

  const dayOfWeek = startDate.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : (8 - dayOfWeek) % 7;
  const firstMonday = new Date(year, 8, 1 + daysUntilMonday);

  const diffDays = Math.floor((date - firstMonday) / 86400000);
  const weekNumber = Math.floor(diffDays / 7) + 1;

  return weekNumber % 2 === 1 ? WEEK_TYPES.ODD : WEEK_TYPES.EVEN;
}

/**
 * Парсит HTML страницу расписания и извлекает информацию о парах
 * @param {string} html - HTML код страницы расписания
 * @param {Date} date - Дата, для которой нужно получить расписание
 * @returns {Object} Объект с данными расписания
 */
export function parseTimetable(html, date = new Date()) {
  // Определяем тип недели
  let weekType = extractWeekType(html);
  if (!weekType) {
    weekType = calculateWeekType(date);
  }

  // Форматируем дату для поиска
  const dayOfWeek = DAYS_SHORT[date.getDay()];
  const dayOfMonth = date.getDate();
  const month = MONTHS_SHORT[date.getMonth()];

  const dateString = `${dayOfWeek}, ${dayOfMonth} ${month}.`;

  // Ищем таблицу с расписанием на нужную дату
  const allTablesRegex =
    /<table[^>]*visible-xs[^>]*visible-sm[^>]*table-lessons[^>]*>[\s\S]*?<\/table>/gi;
  const allTables = html.match(allTablesRegex);

  if (!allTables) {
    return {
      weekType,
      date: dateString,
      dayOfWeek: DAYS_SHORT[date.getDay()],
      lessons: null,
      message: 'На текущий день нет расписания',
    };
  }

  // Ищем таблицу с нужной датой
  const datePatterns = [
    `${dayOfWeek},\\s*${dayOfMonth}\\s*${month}\\.`,
    `${dayOfWeek},\\s*${dayOfMonth}\\s*${month}`,
    `${dayOfWeek}[,\\s]+${dayOfMonth}[\\s]+${month}`,
    // Добавляем более гибкие паттерны
    `${dayOfWeek}.*?${dayOfMonth}.*?${month}`,
  ];

  let tableHtml = null;
  for (const table of allTables) {
    // Проверяем каждый паттерн
    for (const pattern of datePatterns) {
      if (new RegExp(pattern, 'i').test(table)) {
        tableHtml = table;
        break;
      }
    }
    if (tableHtml) break;
  }

  if (!tableHtml) {
    // Если не нашли точное совпадение, пробуем найти по дню недели
    // (полезно для расписания на текущую неделю)
    const dayOfWeekFullPattern = new RegExp(
      `<th[^>]*>\\s*${dayOfWeek}[^<]*</th>`,
      'i'
    );
    
    for (const table of allTables) {
      if (dayOfWeekFullPattern.test(table)) {
        // Дополнительно проверяем, что это нужная дата
        const dateInTableRegex = new RegExp(
          `${dayOfMonth}\\s*${month}`,
          'i'
        );
        if (dateInTableRegex.test(table)) {
          tableHtml = table;
          break;
        }
      }
    }
  }

  if (!tableHtml) {
    return {
      weekType,
      date: dateString,
      dayOfWeek: DAYS_SHORT[date.getDay()],
      lessons: null,
      message: 'На текущий день нет расписания',
    };
  }

  const lessons = [];

  // Парсим пары из таблицы
  const rowRegex =
    /<tr[^>]*class=['"][^'"]*lesson[^'"]*['"][^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch;

  while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
    const rowHtml = rowMatch[1];

    // Извлекаем время
    const timeRegex =
      /<t[hd][^>]*class=['"]time['"][^>]*>[\s\S]*?(\d{1,2}:\d{2})[\s\S]*?(\d{1,2}:\d{2})/;
    const timeMatch = rowHtml.match(timeRegex);

    if (!timeMatch) continue;

    const time = `${timeMatch[1].trim()} - ${timeMatch[2].trim()}`;

    // Ищем ячейку с информацией о паре
    const allCellsRegex = /<td[^>]*>([\s\S]*?)<\/td>/g;
    const allCells = [];
    let cellMatch;

    while ((cellMatch = allCellsRegex.exec(rowHtml)) !== null) {
      allCells.push(cellMatch[1]);
    }

    if (allCells.length === 0) continue;

    // Находим ячейку с парой (не ячейка времени)
    let lessonHtml = null;
    for (const cell of allCells) {
      if (!/^\s*[\d:\s]+\s*$/.test(cell)) {
        lessonHtml = cell;
        break;
      }
    }

    if (!lessonHtml) continue;

    // Проверяем, что пара не пустая
    const trimmedLesson = lessonHtml.trim();
    if (
      trimmedLesson.length < 5 ||
      trimmedLesson.includes('—') ||
      trimmedLesson.includes('&mdash;') ||
      trimmedLesson === '&nbsp;'
    ) {
      continue;
    }

    // Извлекаем предмет
    const disciplineRegex =
      /<span[^>]*class=['"][^'"]*discipline[^'"]*['"][^>]*>([\s\S]*?)<\/span>/i;
    const disciplineMatch = lessonHtml.match(disciplineRegex);

    let discipline = '';
    if (disciplineMatch) {
      const rawDiscipline = disciplineMatch[1].replace(/\s+/g, ' ').trim();
      const abbrMatch = rawDiscipline.match(/<abbr[^>]*>([^<]+)<\/abbr>/i);
      discipline = abbrMatch
        ? abbrMatch[1].trim()
        : rawDiscipline.replace(/<[^>]*>/g, '').trim();
    }

    if (!discipline || discipline.length < 3) continue;

    // Извлекаем тип занятия
    const kindRegex = /<span[^>]*class=['"]kind['"][^>]*>([^<]+)<\/span>/;
    const kindMatch = lessonHtml.match(kindRegex);
    const kind = kindMatch ? kindMatch[1].trim() : '';

    // Извлекаем аудиторию
    const auditoriumRegex =
      /<span[^>]*class=['"]auditoriums?['"][^>]*>([\s\S]*?)<\/span>/i;
    const auditoriumMatch = lessonHtml.match(auditoriumRegex);
    const auditorium = auditoriumMatch
      ? auditoriumMatch[1]
          .replace(/<[^>]*>/g, '')
          .replace(/\s+/g, ' ')
          .trim()
      : '';

    // Извлекаем преподавателя
    const teacherRegex1 =
      /<span[^>]*class=['"]group['"][^>]*>[\s\S]*?<a[^>]*>([^<]+)<\/a>/;
    const teacherRegex2 =
      /<a[^>]*href=['"][^'"]*teacher[^'"]*['"][^>]*>([^<]+)<\/a>/;
    const teacherMatch1 = lessonHtml.match(teacherRegex1);
    const teacherMatch2 = lessonHtml.match(teacherRegex2);
    const teacher = teacherMatch1
      ? teacherMatch1[1].trim()
      : teacherMatch2
      ? teacherMatch2[1].trim()
      : '';

    lessons.push({time, discipline, kind, auditorium, teacher});
  }

  if (lessons.length === 0) {
    return {
      weekType,
      date: dateString,
      dayOfWeek: DAYS_SHORT[date.getDay()],
      lessons: [],
      message: 'Сегодня нет пар',
    };
  }

  return {
    weekType,
    date: dateString,
    dayOfWeek: DAYS_SHORT[date.getDay()],
    lessons,
    message: null,
  };
}

/**
 * Извлекает текущий week_id из HTML страницы
 * @param {string} html - HTML код страницы
 * @returns {number|null} Текущий week_id или null
 */
function extractCurrentWeekId(html) {
  // Ищем элемент с классом "current-week" или активную неделю
  const patterns = [
    // Ищем по классу current-week
    /<li[^>]*class="[^"]*current-week[^"]*"[^>]*>\s*<a[^>]*href="[^"]*week_id=(\d+)[^"]*"/i,
    /<li[^>]*class="[^"]*current[^"]*"[^>]*>\s*<a[^>]*href="[^"]*week_id=(\d+)[^"]*"/i,
    /<a[^>]*class="[^"]*current[^"]*"[^>]*href="[^"]*week_id=(\d+)[^"]*"/i,
    // Ищем по тексту "Текущая неделя"
    /<li[^>]*>[^<]*Текущая неделя[^<]*<\/li>[^<]*<li[^>]*>[^<]*<a[^>]*href="[^"]*week_id=(\d+)[^"]*"/i,
    // Ищем номер недели после текста "Текущая неделя"
    /Текущая неделя[\s\S]{0,200}?week_id=(\d+)/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) {
      return parseInt(match[1]);
    }
  }

  // Если не нашли по паттернам, пробуем найти список недель и взять ту, что помечена как текущая
  // Ищем все ссылки с week_id
  const allWeeksRegex = /<li[^>]*>\s*(?:<a[^>]*href="[^"]*week_id=(\d+)[^"]*"[^>]*>)?[^<]*(\d+)\s+(чётная|нечётная|четная|нечетная)/gi;
  let match;
  const weeks = [];
  
  while ((match = allWeeksRegex.exec(html)) !== null) {
    weeks.push({
      weekId: match[1] ? parseInt(match[1]) : null,
      weekNumber: parseInt(match[2]),
      text: match[0],
    });
  }

  // Если нашли недели, берем первую с week_id (обычно это текущая неделя)
  if (weeks.length > 0) {
    const currentWeek = weeks.find(w => w.weekId !== null);
    if (currentWeek) {
      return currentWeek.weekId;
    }
  }

  return null;
}

/**
 * Вычисляет начало недели (понедельник) для заданной даты
 * @param {Date} date - Дата
 * @returns {Date} Дата понедельника этой недели
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Корректируем на понедельник
  return new Date(d.setDate(diff));
}

/**
 * Получает HTML страницы расписания
 * @param {string} url - URL страницы расписания
 * @param {Date} date - Дата для получения расписания (опционально)
 * @returns {Promise<string>} HTML код страницы
 */
export async function fetchTimetable(url, date = null) {
  try {
    // Если дата не указана, просто загружаем страницу
    if (!date) {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return await response.text();
    }

    // Загружаем текущую страницу, чтобы получить текущий week_id
    const baseUrl = url.replace(/[?&]week_id=\d+/, '');
    const currentResponse = await fetch(baseUrl);
    if (!currentResponse.ok) {
      throw new Error(`HTTP error! status: ${currentResponse.status}`);
    }
    const currentHtml = await currentResponse.text();

    // Извлекаем текущий week_id
    let currentWeekId = extractCurrentWeekId(currentHtml);
    
    // Если не удалось извлечь, пробуем из URL
    if (!currentWeekId) {
      const urlMatch = url.match(/week_id=(\d+)/);
      if (urlMatch) {
        currentWeekId = parseInt(urlMatch[1]);
      }
    }

    // Если все еще не нашли week_id, возвращаем текущую страницу
    if (!currentWeekId) {
      return currentHtml;
    }

    // Вычисляем разницу в неделях между текущей датой и запрашиваемой
    const now = new Date();
    const currentWeekStart = getWeekStart(now);
    const targetWeekStart = getWeekStart(date);
    const weeksDiff = Math.round((targetWeekStart - currentWeekStart) / (7 * 24 * 60 * 60 * 1000));

    // Если запрашиваем текущую неделю, возвращаем уже загруженный HTML
    if (weeksDiff === 0) {
      return currentHtml;
    }

    // Вычисляем целевой week_id
    const targetWeekId = currentWeekId + weeksDiff;

    // Формируем URL с нужным week_id
    const separator = baseUrl.includes('?') ? '&' : '?';
    const finalUrl = `${baseUrl}${separator}week_id=${targetWeekId}`;

    // Загружаем страницу с нужной неделей
    const response = await fetch(finalUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    throw error;
  }
}

