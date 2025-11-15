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
  getUserChats,
  getUserSettings,
  isUserAdmin,
  saveChatSettings,
  saveUserSettings,
} from '../services/settingsService.js';
import {
  answerCallbackQuery,
  checkTelegramAdmin,
  editMessage,
} from '../utils/telegramApi.js';
import {
  createChatsListKeyboard,
  createCourseSelectionKeyboard,
  createFacultySelectionKeyboard,
  createGroupSelectionKeyboard,
  createMainMenuKeyboard,
  createSettingsKeyboard,
  createThreadSelectionKeyboard,
  createUserSettingsKeyboard,
  createHourSelectionKeyboard,
  createMinuteSelectionKeyboard,
} from '../utils/keyboards.js';

/**
 * Форматирует текст настроек чата
 * @param {Object} settings - Настройки чата
 * @returns {string} Отформатированный текст
 */
function formatSettingsText(settings) {
  const threadDisplay = settings.threadName
    ? settings.threadName
    : settings.threadId
    ? `ID: ${settings.threadId}`
    : MESSAGES.SETTINGS_NOT_SET;

  const groupDisplay = settings.groupSlug
    ? settings.groupSlug.toUpperCase()
    : MESSAGES.SETTINGS_NOT_SELECTED;

  const sendHour = settings.sendHour ?? 7;
  const sendMinute = settings.sendMinute ?? 0;
  const timeDisplay = `${sendHour.toString().padStart(2, '0')}:${sendMinute.toString().padStart(2, '0')}`;

  return (
    MESSAGES.SETTINGS_HEADER +
    `${MESSAGES.SETTINGS_CHAT_NAME} ${
      settings.chatName || `ID: ${settings.chatId}`
    }\n` +
    `${MESSAGES.SETTINGS_STATUS} ${
      settings.enabled ? MESSAGES.STATUS_ENABLED : MESSAGES.STATUS_DISABLED
    }\n` +
    `${MESSAGES.SETTINGS_GROUP} ${groupDisplay}\n` +
    `${MESSAGES.SETTINGS_THREAD} ${threadDisplay}\n` +
    `${MESSAGES.SETTINGS_SEND_TIME} ${timeDisplay}\n\n` +
    MESSAGES.SETTINGS_SELECT_PARAMETER
  );
}

/**
 * Форматирует текст настроек пользователя
 * @param {Object} settings - Настройки пользователя
 * @returns {string} Отформатированный текст
 */
function formatUserSettingsText(settings) {
  const groupDisplay = settings.groupSlug
    ? settings.groupSlug.toUpperCase()
    : MESSAGES.SETTINGS_NOT_SELECTED;

  const sendHour = settings.sendHour ?? 7;
  const sendMinute = settings.sendMinute ?? 0;
  const timeDisplay = `${sendHour.toString().padStart(2, '0')}:${sendMinute.toString().padStart(2, '0')}`;

  return (
    MESSAGES.SETTINGS_HEADER_PERSONAL +
    `${MESSAGES.SETTINGS_STATUS} ${
      settings.enabled ? MESSAGES.STATUS_ENABLED : MESSAGES.STATUS_DISABLED
    }\n` +
    `${MESSAGES.SETTINGS_GROUP} ${groupDisplay}\n` +
    `${MESSAGES.SETTINGS_SEND_TIME} ${timeDisplay}\n\n` +
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
  const isPrivateChat = message.chat.type === 'private';

  const parts = data.split(':');
  const action = parts[0];
  const targetChatId = parts[1];

  // Действия, которые не требуют проверки прав и настроек
  const actionsWithoutSettingsCheck = [
    'my_settings',
    'group_chats',
    'back_to_main',
    'back_to_chats',
    'back_to_settings',
    'select_chat',
    'toggle_user_enabled',
    'change_user_group',
    'change_user_time',
  ];

  // Если это действие без проверки настроек, обрабатываем его отдельно
  if (actionsWithoutSettingsCheck.includes(action)) {
    // Эти действия обрабатываются в switch ниже без предварительных проверок
  } else {
    // Определяем, работаем ли мы с личными настройками пользователя
    const isUserSettings = targetChatId && targetChatId.startsWith('user');
    const actualUserId = isUserSettings ? targetChatId.replace('user:', '') : null;

    // Для личных настроек не проверяем права администратора
    if (!isUserSettings) {
      // Проверяем права администратора для групповых чатов
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
    } else {
      // Проверяем, что пользователь работает со своими настройками
      if (actualUserId !== userId.toString()) {
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_NO_RIGHTS,
          true
        );
        return;
      }
    }

    // Получаем настройки (чата или пользователя)
    const settings = isUserSettings
      ? await getUserSettings(kv, actualUserId)
      : await getChatSettings(kv, targetChatId);

    if (!settings) {
      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        MESSAGES.ERROR_SETTINGS_NOT_FOUND,
        true
      );
      return;
    }
  }

  // Определяем параметры для использования в switch
  const isUserSettings = targetChatId && targetChatId.startsWith('user');
  const actualUserId = isUserSettings ? targetChatId.replace('user:', '') : null;
  
  // Получаем настройки для использования в switch (если они нужны)
  let settings = null;
  if (!actionsWithoutSettingsCheck.includes(action)) {
    settings = isUserSettings
      ? await getUserSettings(kv, actualUserId)
      : await getChatSettings(kv, targetChatId);
  }

  switch (action) {
    case 'toggle_enabled':
      settings.enabled = !settings.enabled;
      await saveChatSettings(kv, targetChatId, settings);

      await editMessage(botToken, chatId, messageId, formatSettingsText(settings), {
        reply_markup: createSettingsKeyboard(targetChatId, settings, isPrivateChat),
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
      // Показываем настройки выбранного чата с кнопкой "Назад" (так как это личные сообщения)
      try {
        const chatSettings = await getChatSettings(kv, targetChatId);
        
        if (!chatSettings) {
          await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            MESSAGES.ERROR_SETTINGS_NOT_FOUND,
            true
          );
          break;
        }

        await editMessage(botToken, chatId, messageId, formatSettingsText(chatSettings), {
          reply_markup: createSettingsKeyboard(targetChatId, chatSettings, true),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при открытии настроек чата:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
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
        reply_markup: createSettingsKeyboard(targetChatId, settings, isPrivateChat),
      });

      await answerCallbackQuery(
        botToken,
        callbackQuery.id,
        `${MESSAGES.THREAD_SET_SUCCESS} ${selectedThreadName}`
      );
      break;

    case 'back_to_settings':
      // Возврат к настройкам (с кнопкой "Назад" если это личные сообщения)
      try {
        // Определяем тип настроек
        const isUserSettingsBack = targetChatId && targetChatId.startsWith('user');
        const actualUserIdBack = isUserSettingsBack ? targetChatId.replace('user:', '') : null;
        
        const settingsBack = isUserSettingsBack
          ? await getUserSettings(kv, actualUserIdBack)
          : await getChatSettings(kv, targetChatId);

        if (!settingsBack) {
          await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            MESSAGES.ERROR_SETTINGS_NOT_FOUND,
            true
          );
          break;
        }

        const textBack = isUserSettingsBack
          ? formatUserSettingsText(settingsBack)
          : formatSettingsText(settingsBack);
        
        const keyboardBack = isUserSettingsBack
          ? createUserSettingsKeyboard(actualUserIdBack, settingsBack)
          : createSettingsKeyboard(targetChatId, settingsBack, true);

        await editMessage(botToken, chatId, messageId, textBack, {
          reply_markup: keyboardBack,
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при возврате к настройкам:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
      break;

    case 'back_to_chats':
      // Возврат к списку чатов
      try {
        const userChats = await getUserChats(kv, userId.toString());

        if (userChats.length === 0) {
          await editMessage(botToken, chatId, messageId, MESSAGES.ERROR_NO_CHATS);
        } else {
          await editMessage(
            botToken,
            chatId,
            messageId,
            MESSAGES.WELCOME_SELECT_CHAT,
            {
              reply_markup: createChatsListKeyboard(userChats),
            }
          );
        }

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при возврате к списку чатов:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
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
        
        if (isUserSettings) {
          await saveUserSettings(kv, actualUserId, settings);
        } else {
          await saveChatSettings(kv, targetChatId, settings);
        }

        // Формируем текст и клавиатуру в зависимости от типа настроек
        let groupSuccessText;
        let keyboard;
        
        if (isUserSettings) {
          groupSuccessText = formatUserSettingsText(settings);
          keyboard = createUserSettingsKeyboard(actualUserId, settings);
        } else {
          const groupThreadDisplay = settings.threadName
            ? settings.threadName
            : settings.threadId
            ? `ID: ${settings.threadId}`
            : MESSAGES.SETTINGS_NOT_SET;

          groupSuccessText =
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

          keyboard = createSettingsKeyboard(targetChatId, settings, isPrivateChat);
        }

        await editMessage(botToken, chatId, messageId, groupSuccessText, {
          reply_markup: keyboard,
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

    case 'change_time':
      // Показываем выбор часа
      try {
        const currentHour = settings.sendHour ?? 7;
        const currentMinute = settings.sendMinute ?? 0;
        const timeText =
          MESSAGES.TIME_SELECTION_HEADER +
          `${MESSAGES.TIME_CURRENT} ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}\n\n` +
          MESSAGES.TIME_SELECTION_HOUR;

        await editMessage(botToken, chatId, messageId, timeText, {
          reply_markup: createHourSelectionKeyboard(targetChatId, currentHour),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при открытии выбора времени:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
      break;

    case 'select_hour':
      // Выбор часа - показываем выбор минут
      try {
        const selectedHour = parseInt(parts[2]);
        settings.sendHour = selectedHour;
        
        if (isUserSettings) {
          await saveUserSettings(kv, actualUserId, settings);
        } else {
          await saveChatSettings(kv, targetChatId, settings);
        }

        const currentMinute = settings.sendMinute ?? 0;
        const minuteText =
          MESSAGES.TIME_SELECTION_HEADER +
          `${MESSAGES.TIME_CURRENT} ${selectedHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}\n\n` +
          MESSAGES.TIME_SELECTION_MINUTE;

        await editMessage(botToken, chatId, messageId, minuteText, {
          reply_markup: createMinuteSelectionKeyboard(targetChatId, currentMinute),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при выборе часа:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
      break;

    case 'select_minute':
      // Выбор минуты - сохраняем и возвращаемся к настройкам
      try {
        const selectedMinute = parseInt(parts[2]);
        settings.sendMinute = selectedMinute;
        
        if (isUserSettings) {
          await saveUserSettings(kv, actualUserId, settings);
          
          await editMessage(botToken, chatId, messageId, formatUserSettingsText(settings), {
            reply_markup: createUserSettingsKeyboard(actualUserId, settings),
          });
        } else {
          await saveChatSettings(kv, targetChatId, settings);
          
          await editMessage(botToken, chatId, messageId, formatSettingsText(settings), {
            reply_markup: createSettingsKeyboard(targetChatId, settings, isPrivateChat),
          });
        }

        const timeStr = `${settings.sendHour.toString().padStart(2, '0')}:${settings.sendMinute.toString().padStart(2, '0')}`;
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          `${MESSAGES.TIME_SET_SUCCESS} ${timeStr}`
        );
      } catch (error) {
        console.error('Ошибка при выборе минуты:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
      break;

    case 'my_settings':
      // Показываем личные настройки пользователя
      try {
        const userSettings = await getUserSettings(kv, userId.toString());
        
        if (!userSettings) {
          await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            MESSAGES.ERROR_SETTINGS_NOT_FOUND,
            true
          );
          break;
        }

        await editMessage(botToken, chatId, messageId, formatUserSettingsText(userSettings), {
          reply_markup: createUserSettingsKeyboard(userId.toString(), userSettings),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при открытии личных настроек:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
      break;

    case 'group_chats':
      // Показываем список групповых чатов
      try {
        const userChats = await getUserChats(kv, userId.toString());

        if (userChats.length === 0) {
          await editMessage(
            botToken,
            chatId,
            messageId,
            MESSAGES.WELCOME_PRIVATE + MESSAGES.WELCOME_NO_CHATS,
            {
              reply_markup: createMainMenuKeyboard(userId.toString()),
            }
          );
        } else {
          await editMessage(
            botToken,
            chatId,
            messageId,
            MESSAGES.SETTINGS_SELECT_CHAT,
            {
              reply_markup: createChatsListKeyboard(userChats),
            }
          );
        }

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при загрузке списка чатов:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
      break;

    case 'back_to_main':
      // Возврат в главное меню
      try {
        const mainMenuText = MESSAGES.WELCOME_PRIVATE + MESSAGES.WELCOME_PERSONAL;
        
        await editMessage(botToken, chatId, messageId, mainMenuText, {
          reply_markup: createMainMenuKeyboard(userId.toString()),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при возврате в главное меню:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
      break;

    case 'toggle_user_enabled':
      // Переключение статуса для личных настроек
      try {
        const userSettings = await getUserSettings(kv, userId.toString());
        
        if (!userSettings) {
          await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            MESSAGES.ERROR_SETTINGS_NOT_FOUND,
            true
          );
          break;
        }

        userSettings.enabled = !userSettings.enabled;
        await saveUserSettings(kv, userId.toString(), userSettings);

        await editMessage(botToken, chatId, messageId, formatUserSettingsText(userSettings), {
          reply_markup: createUserSettingsKeyboard(userId.toString(), userSettings),
        });

        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          userSettings.enabled ? MESSAGES.STATUS_BOT_ENABLED : MESSAGES.STATUS_BOT_DISABLED
        );
      } catch (error) {
        console.error('Ошибка при переключении статуса:', error);
        await answerCallbackQuery(
          botToken,
          callbackQuery.id,
          MESSAGES.ERROR_LOADING,
          true
        );
      }
      break;

    case 'change_user_group':
      // Изменение группы для личных настроек
      try {
        const faculties = await getFacultiesWithCache(kv);
        const facultiesText = MESSAGES.GROUP_SELECTION_STEP1;

        await editMessage(botToken, chatId, messageId, facultiesText, {
          reply_markup: createFacultySelectionKeyboard(`user:${userId}`, faculties),
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

    case 'change_user_time':
      // Изменение времени для личных настроек
      try {
        const userSettings = await getUserSettings(kv, userId.toString());
        
        if (!userSettings) {
          await answerCallbackQuery(
            botToken,
            callbackQuery.id,
            MESSAGES.ERROR_SETTINGS_NOT_FOUND,
            true
          );
          break;
        }

        const currentHour = userSettings.sendHour ?? 7;
        const currentMinute = userSettings.sendMinute ?? 0;
        const timeText =
          MESSAGES.TIME_SELECTION_HEADER +
          `${MESSAGES.TIME_CURRENT} ${currentHour.toString().padStart(2, '0')}:${currentMinute.toString().padStart(2, '0')}\n\n` +
          MESSAGES.TIME_SELECTION_HOUR;

        await editMessage(botToken, chatId, messageId, timeText, {
          reply_markup: createHourSelectionKeyboard(`user:${userId}`, currentHour),
        });

        await answerCallbackQuery(botToken, callbackQuery.id);
      } catch (error) {
        console.error('Ошибка при открытии выбора времени:', error);
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

