import { NextRequest, NextResponse } from 'next/server';
import AdmZip from 'adm-zip';
import { db } from '@/lib/db';
import { getSession } from '@/lib/session';
import { parseWhatsAppChat } from '@/lib/whatsapp-parser';

export const dynamic = 'force-dynamic';

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB per media file

const MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', webp: 'image/webp',
  mp4: 'video/mp4', '3gp': 'video/3gpp',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', opus: 'audio/ogg',
  m4a: 'audio/mp4', aac: 'audio/aac',
  pdf: 'application/pdf',
};

function mimeOf(filename: string): string | null {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  return MIME[ext] ?? null;
}

function mediaCategory(mime: string): string {
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  return 'document';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ success: false, error: 'Não autorizado.' }, { status: 401 });
    }
    if (session.role !== 'admin' && session.role !== 'gerente') {
      return NextResponse.json({ success: false, error: 'Permissão negada.' }, { status: 403 });
    }

    const form = await request.formData();
    const customerId = form.get('customerId') as string | null;
    const title = (form.get('title') as string | null) || `Conversa – ${new Date().toLocaleDateString('pt-BR')}`;
    const file = form.get('file') as File | null;

    if (!customerId || !file) {
      return NextResponse.json({ success: false, error: 'customerId e file são obrigatórios.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const zip = new AdmZip(buffer);
    const entries = zip.getEntries();

    // Find the chat text file
    const chatEntry = entries.find(e => !e.isDirectory && e.name.endsWith('.txt'));
    if (!chatEntry) {
      return NextResponse.json({ success: false, error: 'Arquivo de chat (.txt) não encontrado no ZIP.' }, { status: 400 });
    }

    const chatText = chatEntry.getData().toString('utf8');
    const parsed = parseWhatsAppChat(chatText);

    if (parsed.length === 0) {
      return NextResponse.json({ success: false, error: 'Nenhuma mensagem encontrada no arquivo.' }, { status: 400 });
    }

    // Build media map: filename → base64 data URL
    const mediaMap = new Map<string, { dataUrl: string; mime: string }>();
    for (const entry of entries) {
      if (entry.isDirectory || entry.name.endsWith('.txt')) continue;
      if (entry.header.size > MAX_FILE_BYTES) continue;
      const mime = mimeOf(entry.name);
      if (!mime) continue;
      const dataUrl = `data:${mime};base64,${entry.getData().toString('base64')}`;
      mediaMap.set(entry.name, { dataUrl, mime });
    }

    // Persist session
    const newSession = await (db as any).whatsappSession.create({
      data: { customerId, title, importedBy: session.name, messageCount: parsed.length },
    });

    // Persist messages in batches of 200
    const BATCH = 200;
    for (let i = 0; i < parsed.length; i += BATCH) {
      const slice = parsed.slice(i, i + BATCH);
      await (db as any).whatsappMessage.createMany({
        data: slice.map(msg => {
          const media = msg.mediaFilename ? mediaMap.get(msg.mediaFilename) : null;
          return {
            sessionId: newSession.id,
            timestamp: msg.timestamp,
            sender: msg.sender,
            content: msg.content,
            mediaData: media?.dataUrl ?? null,
            mediaType: media ? mediaCategory(media.mime) : null,
            mediaName: msg.mediaFilename ?? null,
          };
        }),
      });
    }

    return NextResponse.json({ success: true, sessionId: newSession.id, messageCount: parsed.length });
  } catch (err: any) {
    console.error('[whatsapp/import]', err);
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
