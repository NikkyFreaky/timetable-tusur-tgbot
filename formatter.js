/**
 * Форматирование сообщений для Telegram
 */

/**
 * Форматирует данные расписания в красивое сообщение для Telegram
 * @param {Object} timetableData - Данные расписания
 * @param {string} timetableData.weekType - Тип недели (чётная/нечётная)
 * @param {string} timetableData.date - Дата
 * @param {string} timetableData.dayOfWeek - День недели
 * @param {Array|null} timetableData.lessons - Массив пар или null
 * @param {string|null} timetableData.message - Сообщение (если нет пар)
 * @returns {string} Отформатированное сообщение в формате HTML
 */
export function formatTimetableMessage(timetableData) {
  const {weekType, date, dayOfWeek, lessons, message} = timetableData;

  let formattedMessage = `<b>Расписание на ${date}</b>\n`;
  formattedMessage += `<b>Неделя:</b> ${weekType}\n\n`;

  if (message) {
    formattedMessage += `${message}`;
    return formattedMessage;
  }

  if (lessons && lessons.length > 0) {
    formattedMessage += `<b>Пары на сегодня:</b>\n\n`;

    lessons.forEach((lesson, index) => {
      formattedMessage += `<b>${index + 1}. ${lesson.discipline}</b>\n`;
      formattedMessage += `Время: ${lesson.time}\n`;
      formattedMessage += `Тип: ${lesson.kind}\n`;

      if (lesson.auditorium) {
        formattedMessage += `Аудитория: ${lesson.auditorium}\n`;
      }

      if (lesson.teacher) {
        formattedMessage += `Преподаватель: ${lesson.teacher}\n`;
      }

      formattedMessage += '\n';
    });

    formattedMessage += `——————\n`;
    formattedMessage += `Всего пар: ${lessons.length}`;
  }

  return formattedMessage;
}

/**
 * Форматирует сообщение об ошибке
 * @param {string} [details] - Детали ошибки (опционально)
 * @returns {string} Отформатированное сообщение об ошибке
 */
export function formatErrorMessage(details = null) {
  let errorMessage = '<b>Произошла ошибка при получении расписания</b>\n\n';

  if (details) {
    errorMessage += `<i>Детали: ${details}</i>\n\n`;
  }

  errorMessage += 'Пожалуйста, попробуйте позже или проверьте настройки бота.';

  return errorMessage;
}
