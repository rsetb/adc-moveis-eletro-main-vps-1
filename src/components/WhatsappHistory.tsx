'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { getWhatsappSessionsAction, getWhatsappMessagesAction, deleteWhatsappSessionAction } from '@/app/actions/admin/whatsapp';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { MessageSquare, Upload, Trash2, ArrowLeft, Loader2, Download, Play, FileText, Search, X } from 'lucide-react';
import Image from 'next/image';

interface Session {
  id: string;
  title: string;
  importedAt: string;
  importedBy: string | null;
  messageCount: number;
}

interface Message {
  id: string;
  timestamp: string;
  sender: string;
  content: string;
  mediaData: string | null;
  mediaType: string | null;
  mediaName: string | null;
}

interface Props {
  customerId: string;
  customerName: string;
}

export default function WhatsappHistory({ customerId, customerName }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importTitle, setImportTitle] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    const res = await getWhatsappSessionsAction(customerId);
    if (res.success) setSessions(res.data ?? []);
    setLoadingSessions(false);
  }, [customerId]);

  useEffect(() => {
    setActiveSession(null);
    setMessages([]);
    setSearchQuery('');
    setSearchOpen(false);
  }, [customerId]);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const openSession = async (session: Session) => {
    setActiveSession(session);
    setLoadingMessages(true);
    const res = await getWhatsappMessagesAction(session.id);
    if (res.success) setMessages(res.data ?? []);
    setLoadingMessages(false);
  };

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  }, [messages]);

  // Determine which sender is "right" (business) — second unique sender in the conversation
  const senderSide = useCallback((msgs: Message[]) => {
    const seen: string[] = [];
    for (const m of msgs) {
      if (!seen.includes(m.sender)) seen.push(m.sender);
      if (seen.length >= 2) break;
    }
    // First sender = left (customer), all others = right (business)
    return seen[0] ?? '';
  }, []);

  const handleImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const form = new FormData();
      form.append('customerId', customerId);
      form.append('title', importTitle.trim() || `Conversa – ${new Date().toLocaleDateString('pt-BR')}`);
      form.append('file', importFile);

      const res = await fetch('/api/whatsapp/import', { method: 'POST', body: form });
      const json = await res.json();

      if (json.success) {
        toast({ title: 'Importado com sucesso', description: `${json.messageCount} mensagens salvas.` });
        setImportOpen(false);
        setImportFile(null);
        setImportTitle('');
        await loadSessions();
      } else {
        toast({ title: 'Erro ao importar', description: json.error, variant: 'destructive' });
      }
    } catch (err: any) {
      toast({ title: 'Erro', description: err.message, variant: 'destructive' });
    } finally {
      setImporting(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    const res = await deleteWhatsappSessionAction(sessionId, user);
    if (res.success) {
      toast({ title: 'Conversa excluída' });
      if (activeSession?.id === sessionId) setActiveSession(null);
      await loadSessions();
    } else {
      toast({ title: 'Erro', description: (res as any).error, variant: 'destructive' });
    }
  };

  // ---- Render helpers ----

  const renderMedia = (msg: Message) => {
    if (!msg.mediaData) return null;
    if (msg.mediaType === 'image') {
      return (
        <button
          className="mt-1 block rounded overflow-hidden max-w-[200px] hover:opacity-90 transition-opacity"
          onClick={() => setLightboxSrc(msg.mediaData)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={msg.mediaData} alt={msg.mediaName ?? 'imagem'} className="max-w-full rounded" />
        </button>
      );
    }
    if (msg.mediaType === 'audio') {
      return (
        <audio controls className="mt-1 max-w-[240px]" style={{ height: 32 }}>
          <source src={msg.mediaData} />
        </audio>
      );
    }
    if (msg.mediaType === 'video') {
      return (
        <video controls className="mt-1 rounded max-w-[240px]">
          <source src={msg.mediaData} />
        </video>
      );
    }
    // document / other
    return (
      <a
        href={msg.mediaData}
        download={msg.mediaName ?? 'arquivo'}
        className="mt-1 flex items-center gap-1 text-xs underline"
      >
        <Download className="h-3 w-3" />
        {msg.mediaName ?? 'Download'}
      </a>
    );
  };

  const firstSender = senderSide(messages);

  const filteredMessages = searchQuery.trim()
    ? messages.filter(m => m.content.toLowerCase().includes(searchQuery.toLowerCase()))
    : messages;

  const highlight = (text: string) => {
    if (!searchQuery.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
    return (
      <>
        {parts.map((part, i) =>
          part.toLowerCase() === searchQuery.toLowerCase()
            ? <mark key={i} className="bg-yellow-300 dark:bg-yellow-600 rounded-sm px-0.5">{part}</mark>
            : part
        )}
      </>
    );
  };

  // ---- Sessions list ----
  if (!activeSession) {
    return (
      <div className="mt-8 pt-6 border-t">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[#25D366]" />
            Histórico WhatsApp
          </h3>
          <Button size="sm" variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Importar conversa
          </Button>
        </div>

        {loadingSessions ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : sessions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
            <MessageSquare className="mx-auto h-8 w-8 mb-2 opacity-40" />
            <p className="text-sm">Nenhum histórico importado ainda.</p>
            <p className="text-xs mt-1">Exporte a conversa do WhatsApp como ZIP e importe aqui.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => openSession(s)}
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
                    <MessageSquare className="h-4 w-4 text-[#25D366]" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{s.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.messageCount} mensagens · Importado em {format(new Date(s.importedAt), 'dd/MM/yyyy', { locale: ptBR })}
                      {s.importedBy && ` por ${s.importedBy}`}
                    </p>
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive flex-shrink-0"
                      onClick={e => e.stopPropagation()}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Excluir conversa?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Todas as mensagens e mídias de <strong>{s.title}</strong> serão removidas permanentemente.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(s.id)}>Excluir</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </div>
        )}

        {/* Import Dialog */}
        <Dialog open={importOpen} onOpenChange={open => { setImportOpen(open); if (!open) { setImportFile(null); setImportTitle(''); } }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Importar conversa WhatsApp</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                No WhatsApp, abra a conversa com <strong>{customerName}</strong> → Menu → Mais → Exportar conversa → Com mídia (ZIP).
              </p>
              <div className="space-y-2">
                <Label htmlFor="wt-title">Nome da conversa (opcional)</Label>
                <Input
                  id="wt-title"
                  placeholder={`Conversa – ${new Date().toLocaleDateString('pt-BR')}`}
                  value={importTitle}
                  onChange={e => setImportTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Arquivo ZIP</Label>
                <div
                  className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {importFile ? (
                    <div className="flex items-center justify-center gap-2 text-sm">
                      <FileText className="h-4 w-4 text-[#25D366]" />
                      <span className="font-medium truncate max-w-[200px]">{importFile.name}</span>
                      <Badge variant="secondary">{(importFile.size / 1024 / 1024).toFixed(1)} MB</Badge>
                    </div>
                  ) : (
                    <div className="text-muted-foreground text-sm">
                      <Upload className="mx-auto h-8 w-8 mb-2 opacity-50" />
                      Clique para selecionar o arquivo ZIP
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip"
                  className="hidden"
                  onChange={e => setImportFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setImportOpen(false)} disabled={importing}>Cancelar</Button>
              <Button onClick={handleImport} disabled={!importFile || importing} className="bg-[#25D366] hover:bg-[#1ebe5a] text-white">
                {importing ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Importando...</> : 'Importar'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ---- Chat view ----
  return (
    <div className="mt-8 pt-6 border-t">
      <div className="flex items-center gap-3 mb-2">
        <Button variant="ghost" size="sm" onClick={() => { setActiveSession(null); setMessages([]); setSearchQuery(''); setSearchOpen(false); }} className="p-1 h-7 w-7">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="h-8 w-8 rounded-full bg-[#25D366]/10 flex items-center justify-center flex-shrink-0">
            <MessageSquare className="h-4 w-4 text-[#25D366]" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{activeSession.title}</p>
            <p className="text-xs text-muted-foreground">
              {searchQuery.trim() ? `${filteredMessages.length} resultado(s)` : `${activeSession.messageCount} mensagens`}
            </p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-1 text-muted-foreground"
          onClick={() => {
            setSearchOpen(v => !v);
            setSearchQuery('');
            setTimeout(() => searchInputRef.current?.focus(), 50);
          }}
        >
          {searchOpen ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
        </Button>
      </div>
      {searchOpen && (
        <div className="mb-2">
          <Input
            ref={searchInputRef}
            placeholder="Buscar mensagens..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
      )}

      {loadingMessages ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <ScrollArea className="h-[480px] rounded-lg border bg-[#e5ddd5] dark:bg-[#0d1117] p-3">
          <div className="space-y-1 pb-2">
            {filteredMessages.map((msg, idx) => {
              const prev = filteredMessages[idx - 1];
              const showDate = !prev || !isSameDay(new Date(msg.timestamp), new Date(prev.timestamp));
              const isRight = msg.sender !== firstSender;
              const showSender = !isRight && (!prev || prev.sender !== msg.sender);

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <span className="bg-white/70 dark:bg-white/10 text-xs px-3 py-1 rounded-full text-muted-foreground shadow-sm">
                        {format(new Date(msg.timestamp), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </span>
                    </div>
                  )}
                  <div className={`flex ${isRight ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-1.5 shadow-sm text-sm ${
                        isRight
                          ? 'bg-[#dcf8c6] dark:bg-[#056162] text-gray-800 dark:text-gray-100 rounded-tr-none'
                          : 'bg-white dark:bg-[#1f2937] text-gray-800 dark:text-gray-100 rounded-tl-none'
                      }`}
                    >
                      {showSender && (
                        <p className="text-xs font-semibold text-[#25D366] mb-0.5">{msg.sender}</p>
                      )}
                      {renderMedia(msg)}
                      <p className="whitespace-pre-wrap leading-snug break-words">{highlight(msg.content)}</p>
                      <p className={`text-[10px] mt-0.5 text-right ${isRight ? 'text-green-700 dark:text-green-300' : 'text-muted-foreground'}`}>
                        {format(new Date(msg.timestamp), 'HH:mm')}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>
        </ScrollArea>
      )}

      {/* Image lightbox */}
      {lightboxSrc && (
        <Dialog open onOpenChange={() => setLightboxSrc(null)}>
          <DialogContent className="max-w-3xl p-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={lightboxSrc} alt="Imagem" className="max-h-[80vh] w-full object-contain rounded" />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
