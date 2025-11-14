/**
 * Простой HTML парсер для расписания ТУСУР без использования jsdom
 */

/**
 * Парсит HTML страницу расписания и извлекает информацию о парах
 * @param {string} html - HTML код страницы расписания
 * @param {Date} date - Дата, для которой нужно получить расписание
 * @returns {Object} Объект с данными расписания
 */
export function parseTimetable(html, date = new Date()) {
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

