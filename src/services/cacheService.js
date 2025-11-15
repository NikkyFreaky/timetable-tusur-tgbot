/**
 * Сервис для кэширования данных парсеров
 */

import {CACHE_TTL, KV_KEYS} from '../config/constants.js';
import {getFaculties} from '../parsers/facultiesParser.js';
import {getFacultyCourses} from '../parsers/coursesParser.js';

/**
 * Кэширует список факультетов в KV
 * @param {KVNamespace} kv - KV namespace
 * @param {Array} faculties - Список факультетов
 * @param {number} ttl - Время жизни кэша в секундах
 * @returns {Promise<void>}
 */
export async function cacheFaculties(kv, faculties, ttl = CACHE_TTL.FACULTIES) {
  try {
    await kv.put(KV_KEYS.FACULTIES_CACHE, JSON.stringify(faculties), {
      expirationTtl: ttl,
    });
  } catch (error) {
    // Игнорируем ошибки кэширования
  }
}

/**
 * Получает список факультетов из кэша
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<Array|null>} Список факультетов или null
 */
export async function getCachedFaculties(kv) {
  try {
    const cached = await kv.get(KV_KEYS.FACULTIES_CACHE, 'json');
    return cached;
  } catch (error) {
    return null;
  }
}

/**
 * Кэширует курсы факультета в KV
 * @param {KVNamespace} kv - KV namespace
 * @param {string} facultySlug - Slug факультета
 * @param {Object} courses - Объект с курсами
 * @param {number} ttl - Время жизни кэша в секундах
 * @returns {Promise<void>}
 */
export async function cacheFacultyCourses(
  kv,
  facultySlug,
  courses,
  ttl = CACHE_TTL.COURSES
) {
  try {
    await kv.put(
      `${KV_KEYS.FACULTY_COURSES_PREFIX}${facultySlug}`,
      JSON.stringify(courses),
      {
        expirationTtl: ttl,
      }
    );
  } catch (error) {
    // Игнорируем ошибки кэширования
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
    const cached = await kv.get(
      `${KV_KEYS.FACULTY_COURSES_PREFIX}${facultySlug}`,
      'json'
    );
    return cached;
  } catch (error) {
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
    // Кэшируем
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
    // Кэшируем
    await cacheFacultyCourses(kv, facultySlug, courses);
  }

  return courses;
}

