/**
 * Утилиты для работы с HTML
 */

/**
 * Декодирует HTML-сущности в строке
 * @param {string} text - Текст с HTML-сущностями
 * @returns {string} Декодированный текст
 */
export function decodeHtmlEntities(text) {
  if (!text) return text;

  // Заменяем все известные HTML-сущности
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#38;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&#60;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#62;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#160;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&laquo;/g, '«')
    .replace(/&#171;/g, '«')
    .replace(/&raquo;/g, '»')
    .replace(/&#187;/g, '»')
    .replace(/&mdash;/g, '—')
    .replace(/&#8212;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&#8211;/g, '–');
}

