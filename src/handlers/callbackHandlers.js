/**
 * Обработчик callback query от inline кнопок
 */

import {BASE_URL} from '../config/constants.js';
import {MESSAGES} from '../config/messages.js';
import {
  getFacultiesWithCache,
  getFacultyCoursesWithCache,
} from '../services/cacheService.js';
import {
  getChatSettings,
  isUserAdmin,
  saveChatSettings,
} from '../services/settingsService.js';
import {
  answerCallbackQuery,
  checkTelegramAdmin,
  editMessage,
} from '../utils/telegramApi.js';
import {
  createCourseSelectionKeyboard,
  createFacultySelectionKeyboard,
  createGroupSelectionKeyboard,
  createSettingsKeyboard,
  createThreadSelectionKeyboard,
} from '../utils/keyboards.js';

/**
 * Форматирует текст настроек чата
 * @param {Object} settings - Настройки чата
 * @returns {string} Отформатированный текст
 */
function formatSettingsText(settings) {
  const threadDisplay = settings.threadName
    ? `${settings.threadName} (ID: ${settings.threadId})`
    : settings.threadId
    ? `ID: ${settings.threadId}`
    : MESSAGES.SETTINGS_NOT_SET;

  const groupDisplay = settings.groupSlug
    ? settings.groupSlug.toUpperCase()
    : MESSAGES.SETTINGS_NOT_SELECTED;

  return (
    MESSAGES.SETTINGS_HEADER +
    `${MESSAGES.SETTINGS_CHAT_NAME} ${
      settings.chatName || `ID: ${settings.chatId}`
    }\n` +
    `${MESSAGES.SETTINGS_STATUS} ${
      settings.enabled ? MESSAGES.STATUS_ENABLED : MESSAGES.STATUS_DISABLED
    }\n` +
    `${MESSAGES.SETTINGS_GROUP} ${groupDisplay}\n` +
    `${MESSAGES.SETTINGS_THREAD} ${threadDisplay}\n\n` +
    MESSAGES.SETTINGS_SELECT_PARAMETER
  );
}

/**
 * Обрабатывает callback query от inline кнопок
 * @param {Object} callbackQuery - Объект callback query от Telegram
 * @param {string} botToken - Токен бота
 * @param {KVNamespace} kv - KV namespace
 * @returns {Promise<void>}
 */
export async function handleCallbackQuery(callbackQuery, botToken, kv) {
  const data = callbackQuery.data;
  const userId = callbackQuery.from.id;
  const message = callbackQuery.message;
  const chatId = message.chat.id;
  const messageId = message.message_id;

  const parts = data.split(':');
  const action = parts[0];
  const targetChatId = parts[1];

  // Проверяем права администратора
  const isAdmin = await checkTelegramAdmin(botToken, targetChatId, userId);
  const isAdminInKV = await isUserAdmin(kv, targetChatId, userId.toString());

  if (!isAdmin && !isAdminInKV) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      MESSAGES.ERROR_NO_RIGHTS,
      true
    );
    return;
  }

  const settings = await getChatSettings(kv, targetChatId);

  if (!settings) {
    await answerCallbackQuery(
      botToken,
      callbackQuery.id,
      MESSAGES.ERROR_SETTINGS_NOT_FOUND,
      true
    );
    return;
  }

  switch (action) {
    case 'toggle_enabled':
      settings.enabled = !settings.enabled;
      await saveChatSettings(kv, targetChatId, settings);

      await editMessage(botToken, chatId, messageId, formatSettingsText(settings), {
        reply_markup: createSettingsKeyboard(targetChatId, settings),
      });

      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        settings.enabled ? MESSAGES.STATUS_BOT_ENABLED : MESSAGES.STATUS_BOT_DISABLED
      );
      break;

    case 'change_url':
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        MESSAGES.URL_CHANGE_INSTRUCTION
      );
      break;

    case 'change_group':
      // Показываем список факультетов
      try {
        const faculties = await getFacultiesWithCache(kv);
        const facultiesText = MESSAGES.GROUP_SELECTION_STEP1;

        await editMessage(botToken, chatId, messageId, facultiesText, {
          reply_markup: createFacultySelectionKeyboard(targetChatId, faculties),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при получении списка факультетов:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING_FACULTIES,
          true
        );
      }
      break;

    case 'change_thread':
      // Показываем список доступных тем
      const threadsText = MESSAGES.THREAD_SELECTION;

      await editMessage(botToken, chatId, messageId, threadsText, {
        reply_markup: createThreadSelectionKeyboard(
          targetChatId,
          settings.forumTopics || {}
        ),
      });

      await answerCallbackQuery(botToken, callbackQuery.id);
      break;

    case 'select_chat':
      await editMessage(botToken, chatId, messageId, formatSettingsText(settings), {
        reply_markup: createSettingsKeyboard(targetChatId, settings),
      });

      await answerCallbackQuery(botToken, callbackQuery.id);
      break;

    case 'select_thread':
      // Выбор конкретной темы
      const selectedThreadId = parts[2];
      const selectedThreadName =
        settings.forumTopics?.[selectedThreadId] ||
        `${MESSAGES.TOPIC_PREFIX} ${selectedThreadId}`;

      settings.threadId = selectedThreadId;
      settings.threadName = selectedThreadName;
      await saveChatSettings(kv, targetChatId, settings);

      await editMessage(botToken, chatId, messageId, formatSettingsText(settings), {
        reply_markup: createSettingsKeyboard(targetChatId, settings),
      });

      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `${MESSAGES.THREAD_SET_SUCCESS} ${selectedThreadName}`
      );
      break;

    case 'back_to_settings':
      // Возврат к настройкам
      await editMessage(botToken, chatId, messageId, formatSettingsText(settings), {
        reply_markup: createSettingsKeyboard(targetChatId, settings),
      });

      await answerCallbackQuery(botToken, callbackQuery.id);
      break;

    case 'no_threads':
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        MESSAGES.THREAD_SET_COMMAND,
        true
      );
      break;

    case 'select_faculty':
      // Выбор факультета - показываем курсы
      try {
        const facultySlug = parts[2];
        const courses = await getFacultyCoursesWithCache(kv, facultySlug);

        if (!courses || Object.keys(courses).length === 0) {
          await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            MESSAGES.ERROR_NO_COURSES,
            true
          );
          break;
        }

        const coursesText = MESSAGES.GROUP_SELECTION_STEP2;

        await editMessage(botToken, chatId, messageId, coursesText, {
          reply_markup: createCourseSelectionKeyboard(
            targetChatId,
            facultySlug,
            courses
          ),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при получении списка курсов:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING_COURSES,
          true
        );
      }
      break;

    case 'select_course':
      // Выбор курса - показываем группы
      try {
        const courseFacultySlug = parts[2];
        const courseNumber = parts[3];
        const coursesData = await getFacultyCoursesWithCache(
          kv,
          courseFacultySlug
        );

        if (!coursesData || !coursesData[courseNumber]) {
          await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            MESSAGES.ERROR_COURSE_NOT_FOUND,
            true
          );
          break;
        }

        const groups = coursesData[courseNumber].groups;

        if (!groups || groups.length === 0) {
          await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            MESSAGES.ERROR_NO_GROUPS,
            true
          );
          break;
        }

        const groupsText = MESSAGES.GROUP_SELECTION_STEP3;

        await editMessage(botToken, chatId, messageId, groupsText, {
          reply_markup: createGroupSelectionKeyboard(
            targetChatId,
            courseFacultySlug,
            courseNumber,
            groups
          ),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при получении списка групп:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING_GROUPS,
          true
        );
      }
      break;

    case 'select_group':
      // Выбор группы - сохраняем в настройки
      try {
        const groupFacultySlug = parts[2];
        const groupSlug = parts[3];
        const groupUrl = `${BASE_URL}/faculties/${groupFacultySlug}/groups/${groupSlug}`;

        settings.timetableUrl = groupUrl;
        settings.groupSlug = groupSlug;
        settings.facultySlug = groupFacultySlug;
        await saveChatSettings(kv, targetChatId, settings);

        const groupThreadDisplay = settings.threadName
          ? `${settings.threadName} (ID: ${settings.threadId})`
          : settings.threadId
          ? `ID: ${settings.threadId}`
          : MESSAGES.SETTINGS_NOT_SET;

        const groupSuccessText =
          MESSAGES.SETTINGS_HEADER +
          `${MESSAGES.SETTINGS_CHAT_NAME} ${
            settings.chatName || `ID: ${settings.chatId}`
          }\n` +
          `${MESSAGES.SETTINGS_STATUS} ${
            settings.enabled ? MESSAGES.STATUS_ENABLED : MESSAGES.STATUS_DISABLED
          }\n` +
          `${MESSAGES.SETTINGS_GROUP} ${groupSlug.toUpperCase()}\n` +
          `${MESSAGES.SETTINGS_URL} ${settings.timetableUrl}\n` +
          `${MESSAGES.SETTINGS_THREAD} ${groupThreadDisplay}\n\n` +
          MESSAGES.SETTINGS_SELECT_PARAMETER;

        await editMessage(botToken, chatId, messageId, groupSuccessText, {
          reply_markup: createSettingsKeyboard(targetChatId, settings),
        });

        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          `${MESSAGES.GROUP_SELECTED} ${groupSlug.toUpperCase()} ${MESSAGES.GROUP_SELECTED_SUFFIX}`
        );
      } catch (error) {
        console.error('Ошибка при сохранении группы:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_SAVING_GROUP,
          true
        );
      }
      break;

    case 'back_to_faculties':
      // Возврат к списку факультетов
      try {
        const backFaculties = await getFacultiesWithCache(kv);
        const backFacultiesText = MESSAGES.GROUP_SELECTION_STEP1;

        await editMessage(botToken, chatId, messageId, backFacultiesText, {
          reply_markup: createFacultySelectionKeyboard(
            targetChatId,
            backFaculties
          ),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при возврате к факультетам:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
      break;

    case 'back_to_courses':
      // Возврат к списку курсов
      try {
        const backFacultySlug = parts[2];
        const backCourses = await getFacultyCoursesWithCache(
          kv,
          backFacultySlug
        );

        const backCoursesText = MESSAGES.GROUP_SELECTION_STEP2;

        await editMessage(botToken, chatId, messageId, backCoursesText, {
          reply_markup: createCourseSelectionKeyboard(
            targetChatId,
            backFacultySlug,
            backCourses
          ),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при возврате к курсам:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
      break;

    default:
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        MESSAGES.UNKNOWN_COMMAND
      );
  }
}

