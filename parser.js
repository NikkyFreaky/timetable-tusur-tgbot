/**
 * Простой HTML парсер для расписания ТУСУР без использования jsdom
 */

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
      if (text.includes('чётная') || text.includes('четная')) return 'чётная';
      if (text.includes('нечётная') || text.includes('нечетная'))
        return 'нечётная';
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

  return weekNumber % 2 === 1 ? 'нечётная' : 'чётная';
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

  // Ищем таблицу с расписанием на нужную дату
  const allTablesRegex =
    /<table[^>]*visible-xs[^>]*visible-sm[^>]*table-lessons[^>]*>[\s\S]*?<\/table>/gi;
  const allTables = html.match(allTablesRegex);

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
  const datePatterns = [
    `${dayOfWeek},\\s*${dayOfMonth}\\s*${month}\\.`,
    `${dayOfWeek},\\s*${dayOfMonth}\\s*${month}`,
    `${dayOfWeek}[,\\s]+${dayOfMonth}[\\s]+${month}`,
  ];

  let tableHtml = null;
  for (const table of allTables) {
    if (datePatterns.some((p) => new RegExp(p, 'i').test(table))) {
      tableHtml = table;
      break;
    }
  }

  if (!tableHtml) {
    return {
      weekType,
      date: dateString,
      dayOfWeek: days[date.getDay()],
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
 * @param {string} url - URL страницы расписания
 * @returns {Promise<string>} HTML код страницы
 */
export async function fetchTimetable(url) {
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
