/**
 * Парсер для получения списка групп
 */

import {BASE_URL} from '../config/constants.js';
import {decodeHtmlEntities} from '../utils/htmlUtils.js';

/**
 * Парсит HTML блок с группами
 * @param {string} html - HTML код блока с группами
 * @param {string} facultySlug - Slug факультета
 * @returns {Array<{name: string, url: string, slug: string}>} Список групп
 */
export function parseGroups(html, facultySlug) {
  const groups = [];

  // Паттерн для ссылок на группы: <a href="/faculties/SLUG/groups/GROUP">GROUP</a>
  const groupPattern =
    /<a\s+href="\/faculties\/[^\/]+\/groups\/([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let match;

  while ((match = groupPattern.exec(html)) !== null) {
    const groupSlug = match[1];
    const groupName = decodeHtmlEntities(match[2].trim());

    groups.push({
      name: groupName,
      slug: groupSlug,
      url: `${BASE_URL}/faculties/${facultySlug}/groups/${groupSlug}`,
    });
  }

  return groups;
}

