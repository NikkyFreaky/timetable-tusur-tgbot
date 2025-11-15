/**
 * Парсер для получения списка факультетов
 */

import {BASE_URL} from '../config/constants.js';
import {decodeHtmlEntities} from '../utils/htmlUtils.js';

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
  const listMatch = html.match(
    /<h1[^>]*>Список факультетов<\/h1>([\s\S]*?)<\/ul>/i
  );

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
    const name = decodeHtmlEntities(match[2].trim());

    faculties.push({
      name: name,
      slug: slug,
      url: `${BASE_URL}/faculties/${slug}`,
    });
  }

  return faculties;
}

