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

  let formattedMessage = `Расписание на <b>${date}</b>\n`;
  formattedMessage += `Неделя: <b>${weekType}</b>\n\n`;

  if (message) {
    formattedMessage += `${message}`;
    return formattedMessage;
  }

  if (lessons && lessons.length > 0) {
    lessons.forEach((lesson) => {
      formattedMessage += `Пара: <b>${lesson.discipline}</b>\n`;
      formattedMessage += `Время: <b>${lesson.time}</b>\n`;
      formattedMessage += `Тип: <b>${lesson.kind}</b>\n`;

      if (lesson.auditorium) {
        formattedMessage += `Аудитория: <b>${lesson.auditorium}</b>\n`;
      }

      if (lesson.teacher) {
        formattedMessage += `Преподаватель: <b>${lesson.teacher}</b>\n`;
      }

      formattedMessage += '\n';
    });

    formattedMessage += `<b>Всего пар:</b> ${lessons.length}`;
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
