/**
 * Парсер для получения списка курсов факультета
 */

import {BASE_URL} from '../config/constants.js';
import {parseGroups} from './groupsParser.js';

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
  const coursePattern =
    /<h2[^>]*>(\d+)\s*курс<\/h2>([\s\S]*?)(?=<h2|<\/div>|$)/gi;
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

