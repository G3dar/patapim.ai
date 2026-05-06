/**
 * Telegram Bot API helpers.
 *
 * The relay uses these to send messages back to Telegram on behalf of a
 * PATAPIM install, and to answer /start pairing flows.
 */

const BASE = 'https://api.telegram.org';

export interface TelegramSendMessageParams {
  chat_id: number | string;
  text: string;
  parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown';
  reply_to_message_id?: number;
  disable_notification?: boolean;
  disable_web_page_preview?: boolean;
  reply_markup?: unknown;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export async function callBotApi<T = unknown>(
  token: string,
  method: string,
  params: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`${BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const json = await res.json() as { ok: boolean; result?: T; description?: string };
  if (!json.ok) {
    throw new Error(`Telegram API ${method}: ${json.description || 'unknown error'}`);
  }
  return json.result as T;
}

export function sendMessage(token: string, params: TelegramSendMessageParams) {
  return callBotApi<{ message_id: number; chat: { id: number }; text?: string }>(
    token,
    'sendMessage',
    { disable_web_page_preview: true, ...params },
  );
}

export function getFile(token: string, file_id: string) {
  return callBotApi<TelegramFile>(token, 'getFile', { file_id });
}

export function buildFileUrl(token: string, file_path: string) {
  return `${BASE}/file/bot${token}/${file_path}`;
}

export function answerCallbackQuery(
  token: string,
  callback_query_id: string,
  text?: string,
  show_alert?: boolean,
) {
  return callBotApi(token, 'answerCallbackQuery', {
    callback_query_id,
    text: text || '',
    show_alert: !!show_alert,
  });
}

export interface EditMessageTextParams {
  chat_id: number | string;
  message_id: number;
  text: string;
  parse_mode?: 'HTML' | 'MarkdownV2' | 'Markdown';
  reply_markup?: unknown;
}

export function editMessageText(token: string, params: EditMessageTextParams) {
  return callBotApi(token, 'editMessageText', {
    disable_web_page_preview: true,
    ...params,
  });
}

export interface EditMessageReplyMarkupParams {
  chat_id: number | string;
  message_id: number;
  reply_markup: unknown;
}

export function editMessageReplyMarkup(token: string, params: EditMessageReplyMarkupParams) {
  return callBotApi(token, 'editMessageReplyMarkup', { ...params });
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from: { id: number; username?: string; first_name?: string; language_code?: string };
    chat: { id: number; type: string; username?: string; first_name?: string };
    date: number;
    text?: string;
    caption?: string;
    voice?: { file_id: string; duration: number; mime_type?: string };
    audio?: { file_id: string };
    photo?: Array<{ file_id: string; width: number; height: number; file_size?: number }>;
    document?: { file_id: string; file_name?: string; mime_type?: string };
    reply_to_message?: { message_id: number; text?: string };
  };
  callback_query?: {
    id: string;
    from: { id: number };
    data?: string;
    message?: { message_id: number; chat: { id: number } };
  };
}
