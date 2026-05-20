export interface ParsedMessage {
  timestamp: Date;
  sender: string;
  content: string;
  mediaFilename?: string;
}

// Matches both iOS and Android WhatsApp export formats:
// [DD/MM/YYYY, HH:MM:SS] Sender: Message
// [DD/MM/YYYY HH:MM:SS] Sender: Message
// DD/MM/YYYY HH:MM - Sender: Message
const MSG_START = /^(?:\[(\d{1,2}\/\d{1,2}\/\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\]|(\d{1,2}\/\d{1,2}\/\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)\s*[-–])\s*(.+?):\s*([\s\S]*)$/;

export function parseWhatsAppChat(text: string): ParsedMessage[] {
  const messages: ParsedMessage[] = [];

  // Strip BOM and normalize line endings
  const lines = text
    .replace(/^﻿/, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n');

  let current: ParsedMessage | null = null;

  for (const line of lines) {
    const match = line.match(MSG_START);
    if (match) {
      if (current) messages.push(current);

      const dateStr = match[1] ?? match[3];
      const timeStr = match[2] ?? match[4];
      const sender = match[5].trim();
      const body = match[6];

      // "filename.ext (arquivo anexado)" or "(file attached)"
      const attachMatch = body.match(/^(?:‎)?(.+?)\s+\((?:arquivo anexado|file attached)\)\s*$/);
      // "‎image omitted" / "‎video omitted" etc.
      const omitted = /^(?:‎)?(?:image|video|audio|sticker|document|gif|contact card)\s+omitted\s*$/i.test(body);

      current = {
        timestamp: parseDate(dateStr, timeStr),
        sender,
        content: omitted ? '[Mídia não exportada]' : (attachMatch ? `📎 ${attachMatch[1]}` : body),
        mediaFilename: attachMatch ? attachMatch[1] : undefined,
      };
    } else if (current && line.trim()) {
      current.content += '\n' + line;
    }
  }

  if (current) messages.push(current);
  return messages;
}

function parseDate(dateStr: string, timeStr: string): Date {
  try {
    const [d, m, y] = dateStr.split('/');
    const year = y.length === 2 ? 2000 + parseInt(y) : parseInt(y);
    const clean = timeStr.replace(/\s*[AP]M\s*/i, '').trim();
    const [h, min, sec = '0'] = clean.split(':');
    let hours = parseInt(h);
    if (/PM/i.test(timeStr) && hours !== 12) hours += 12;
    if (/AM/i.test(timeStr) && hours === 12) hours = 0;
    return new Date(year, parseInt(m) - 1, parseInt(d), hours, parseInt(min), parseInt(sec));
  } catch {
    return new Date();
  }
}
