/**
 * Модуль для парсинга списка факультетов, курсов и групп с сайта расписания ТУСУР
 */

const BASE_URL = 'https://timetable.tusur.ru';

/**
 * Получает список факультетов
 * @returns {Promise<Array<{name: string, url: string, slug: string}>>} Список факультетов
 */
export async function getFaculties() {
  try {
    const response = await fetch(`${BASE_URL}/faculties`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    return parseFaculties(html);
  } catch (error) {
    console.error('Ошибка при получении списка факультетов:', error);
    throw error;
  }
}

/**
 * Парсит HTML страницу со списком факультетов
 * @param {string} html - HTML код страницы
 * @returns {Array<{name: string, url: string, slug: string}>} Список факультетов
 */
function parseFaculties(html) {
  const faculties = [];
  
  // Ищем список факультетов в HTML
  // Паттерн: <li><a href="/faculties/SLUG">Название факультета</a></li>
  const listMatch = html.match(/<h1[^>]*>Список факультетов<\/h1>([\s\S]*?)<\/ul>/i);
  
  if (!listMatch) {
    console.error('Не удалось найти список факультетов');
    return faculties;
  }
  
  const listHtml = listMatch[1];
  
  // Извлекаем все ссылки на факультеты
  const linkPattern = /<a\s+href="\/faculties\/([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = linkPattern.exec(listHtml)) !== null) {
    const slug = match[1];
    const name = match[2].trim();
    
    faculties.push({
      name: name,
      slug: slug,
      url: `${BASE_URL}/faculties/${slug}`,
    });
  }
  
  return faculties;
}

/**
 * Получает список курсов и групп для факультета
 * @param {string} facultySlug - Slug факультета (например, 'fsu')
 * @returns {Promise<Object>} Объект с курсами и группами
 */
export async function getFacultyCourses(facultySlug) {
  try {
    const response = await fetch(`${BASE_URL}/faculties/${facultySlug}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    return parseFacultyCourses(html, facultySlug);
  } catch (error) {
    console.error(`Ошибка при получении курсов факультета ${facultySlug}:`, error);
    throw error;
  }
}

/**
 * Парсит HTML страницу факультета и извлекает курсы и группы
 * @param {string} html - HTML код страницы
 * @param {string} facultySlug - Slug факультета
 * @returns {Object} Объект с курсами и группами
 */
function parseFacultyCourses(html, facultySlug) {
  const courses = {};
  
  // Ищем заголовки курсов: <h2>1 курс</h2>, <h2>2 курс</h2> и т.д.
  const coursePattern = /<h2[^>]*>(\d+)\s*курс<\/h2>([\s\S]*?)(?=<h2|<\/div>|$)/gi;
  let match;
  
  while ((match = coursePattern.exec(html)) !== null) {
    const courseNumber = match[1];
    const courseHtml = match[2];
    
    // Извлекаем группы для этого курса
    const groups = parseGroups(courseHtml, facultySlug);
    
    if (groups.length > 0) {
      courses[courseNumber] = {
        number: courseNumber,
        name: `${courseNumber} курс`,
        groups: groups,
      };
    }
  }
  
  return courses;
}

/**
 * Парсит HTML блок с группами
 * @param {string} html - HTML код блока с группами
 * @param {string} facultySlug - Slug факультета
 * @returns {Array<{name: string, url: string}>} Список групп
 */
function parseGroups(html, facultySlug) {
  const groups = [];
  
  // Паттерн для ссылок на группы: <a href="/faculties/SLUG/groups/GROUP">GROUP</a>
  const groupPattern = /<a\s+href="\/faculties\/[^\/]+\/groups\/([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;
  
  while ((match = groupPattern.exec(html)) !== null) {
    const groupSlug = match[1];
    const groupName = match[2].trim();
    
    groups.push({
      name: groupName,
      slug: groupSlug,
      url: `${BASE_URL}/faculties/${facultySlug}/groups/${groupSlug}`,
    });
  }
  
  return groups;
}

/**
 * Получает полную структуру: факультеты → курсы → группы
 * @returns {Promise<Array>} Массив факультетов с курсами и группами
 */
export async function getFullStructure() {
  try {
    const faculties = await getFaculties();
    const result = [];
    
    for (const faculty of faculties) {
      try {
        const courses = await getFacultyCourses(faculty.slug);
        result.push({
          ...faculty,
          courses: courses,
        });
      } catch (error) {
        console.error(`Ошибка при обработке факультета ${faculty.name}:`, error);
        // Продолжаем обработку остальных факультетов
      }
    }
    
    return result;
  } catch (error) {
    console.error('Ошибка при получении полной структуры:', error);
    throw error;
  }
}

/**
 * Кэширует список факультетов в KV
 * @param {KVNamespace} kv - KV namespace
 * @param {Array} faculties - Список факультетов
 * @param {number} ttl - Время жизни кэша в секундах (по умолчанию 24 часа)
 * @returns {Promise<void>}
 */
export async function cacheFaculties(kv, faculties, ttl = 86400) {
  try {
    await kv.put('faculties_cache', JSON.stringify(faculties), {
      expirationTtl: ttl,
    });
  } catch (error) {
    console.error('Ошибка при кэшировании факультетов:', error);
  }
}

/**
 * Получает список факультетов из кэша
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<Array|null>} Список факультетов или null
 */
export async function getCachedFaculties(kv) {
  try {
    const cached = await kv.get('faculties_cache', 'json');
    return cached;
  } catch (error) {
    console.error('Ошибка при получении факультетов из кэша:', error);
    return null;
  }
}

/**
 * Кэширует курсы факультета в KV
 * @param {KVNamespace} kv - KV namespace
 * @param {string} facultySlug - Slug факультета
 * @param {Object} courses - Объект с курсами
 * @param {number} ttl - Время жизни кэша в секундах (по умолчанию 24 часа)
 * @returns {Promise<void>}
 */
export async function cacheFacultyCourses(kv, facultySlug, courses, ttl = 86400) {
  try {
    await kv.put(`faculty_courses:${facultySlug}`, JSON.stringify(courses), {
      expirationTtl: ttl,
    });
  } catch (error) {
    console.error(`Ошибка при кэшировании курсов факультета ${facultySlug}:`, error);
  }
}

/**
 * Получает курсы факультета из кэша
 * @param {KVNamespace} kv - KV namespace
 * @param {string} facultySlug - Slug факультета
 * @returns {Promise<Object|null>} Объект с курсами или null
 */
export async function getCachedFacultyCourses(kv, facultySlug) {
  try {
    const cached = await kv.get(`faculty_courses:${facultySlug}`, 'json');
    return cached;
  } catch (error) {
    console.error(`Ошибка при получении курсов факультета ${facultySlug} из кэша:`, error);
    return null;
  }
}

/**
 * Получает список факультетов с кэшированием
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<Array>} Список факультетов
 */
export async function getFacultiesWithCache(kv) {
  // Сначала пытаемся получить из кэша
  let faculties = await getCachedFaculties(kv);
  
  if (!faculties) {
    // Если в кэше нет, получаем с сайта
    faculties = await getFaculties();
    // Кэшируем на 24 часа
    await cacheFaculties(kv, faculties);
  }
  
  return faculties;
}

/**
 * Получает курсы факультета с кэшированием
 * @param {KVNamespace} kv - KV namespace
 * @param {string} facultySlug - Slug факультета
 * @returns {Promise<Object>} Объект с курсами
 */
export async function getFacultyCoursesWithCache(kv, facultySlug) {
  // Сначала пытаемся получить из кэша
  let courses = await getCachedFacultyCourses(kv, facultySlug);
  
  if (!courses) {
    // Если в кэше нет, получаем с сайта
    courses = await getFacultyCourses(facultySlug);
    // Кэшируем на 24 часа
    await cacheFacultyCourses(kv, facultySlug, courses);
  }
  
  return courses;
}

