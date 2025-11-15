/**
 * Форматирование сообщений для Telegram
 */

import {MESSAGES} from '../config/messages.js';

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

  let formattedMessage = `${MESSAGES.TIMETABLE_HEADER} <b>${date}</b>\n`;
  formattedMessage += `${MESSAGES.TIMETABLE_WEEK} <b>${weekType}</b>\n\n`;

  if (message) {
    formattedMessage += `${message}`;
    return formattedMessage;
  }

  if (lessons && lessons.length > 0) {
    lessons.forEach((lesson) => {
      formattedMessage += `${MESSAGES.TIMETABLE_LESSON} <b>${lesson.discipline}</b>\n`;
      formattedMessage += `${MESSAGES.TIMETABLE_TIME} <b>${lesson.time}</b>\n`;
      formattedMessage += `${MESSAGES.TIMETABLE_TYPE} <b>${lesson.kind}</b>\n`;

      if (lesson.auditorium) {
        formattedMessage += `${MESSAGES.TIMETABLE_AUDITORIUM} <b>${lesson.auditorium}</b>\n`;
      }

      if (lesson.teacher) {
        formattedMessage += `${MESSAGES.TIMETABLE_TEACHER} <b>${lesson.teacher}</b>\n`;
      }

      formattedMessage += '\n';
    });

    formattedMessage += `${MESSAGES.TIMETABLE_TOTAL} ${lessons.length}`;
  }

  return formattedMessage;
}

/**
 * Форматирует сообщение об ошибке
 * @param {string} [details] - Детали ошибки (опционально)
 * @returns {string} Отформатированное сообщение об ошибке
 */
export function formatErrorMessage(details = null) {
  let errorMessage = MESSAGES.ERROR_TIMETABLE + '\n\n';

  if (details) {
    errorMessage += `<i>Детали: ${details}</i>\n\n`;
  }

  return errorMessage;
}

