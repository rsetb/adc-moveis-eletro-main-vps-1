import { getSnapshot } from '@/lib/change-notifier';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let last = JSON.stringify(getSnapshot());

      const send = (data: string) => {
        try {
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // client disconnected
        }
      };

      // Send initial snapshot so client knows current timestamps
      send(last);

      // Poll for changes every second and push only when something changes
      const interval = setInterval(() => {
        const current = JSON.stringify(getSnapshot());
        if (current !== last) {
          last = current;
          send(current);
        }
      }, 1000);

      request.signal.addEventListener('abort', () => {
        clearInterval(interval);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no', // disable nginx buffering
    },
  });
}
