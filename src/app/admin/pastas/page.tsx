'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  getFoldersAction,
  createFolderAction,
  updateFolderAction,
  deleteFolderAction,
  addFileToFolderAction,
  updateFileObservationsAction,
  deleteFileAction,
} from '@/app/actions/admin/folders';
import type { PersonFolder, FolderFile } from '@/lib/types';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FolderOpen,
  FolderPlus,
  Folder,
  Upload,
  Trash2,
  FileText,
  FileSpreadsheet,
  ImageIcon,
  Save,
  ArrowLeft,
  Pencil,
  X,
  Files,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const MAX_FILE_MB = 10;

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function formatBytes(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getDocumentInfo(mimeType?: string): { Icon: React.ElementType; color: string; label: string } {
  const m = mimeType ?? '';
  if (m === 'application/pdf') return { Icon: FileText, color: 'text-red-500', label: 'PDF' };
  if (m.includes('word') || m.includes('doc')) return { Icon: FileText, color: 'text-blue-500', label: 'DOC' };
  if (m.includes('sheet') || m.includes('excel') || m.includes('xls')) return { Icon: FileSpreadsheet, color: 'text-green-600', label: 'XLS' };
  if (m.includes('text')) return { Icon: FileText, color: 'text-gray-500', label: 'TXT' };
  return { Icon: FileText, color: 'text-muted-foreground', label: 'DOC' };
}

export default function PastasPage() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [folders, setFolders] = useState<PersonFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedFolder, setSelectedFolder] = useState<PersonFolder | null>(null);

  const [newFolderName, setNewFolderName] = useState('');
  const [creatingFolder, setCreatingFolder] = useState(false);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameName, setRenameName] = useState('');

  const [observations, setObservations] = useState('');
  const [savingObs, setSavingObs] = useState(false);
  const [obsChanged, setObsChanged] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const [search, setSearch] = useState('');

  useEffect(() => {
    getFoldersAction().then(data => {
      setFolders(data);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedFolder) return;
    const updated = folders.find(f => f.id === selectedFolder.id);
    if (updated) {
      setSelectedFolder(updated);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [folders]);

  const filteredFolders = folders.filter(f =>
    f.name.toLowerCase().includes(search.toLowerCase()),
  );

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    setCreatingFolder(true);
    const res = await createFolderAction(newFolderName, user?.id, user?.name);
    if (res.success && res.folder) {
      setFolders(prev => [...prev, res.folder!].sort((a, b) => a.name.localeCompare(b.name)));
      setNewFolderName('');
      toast({ title: 'Pasta criada com sucesso.' });
    } else {
      toast({ title: 'Erro ao criar pasta.', variant: 'destructive' });
    }
    setCreatingFolder(false);
  }

  function openFolder(folder: PersonFolder) {
    setSelectedFolder(folder);
    setObservations(folder.observations ?? '');
    setObsChanged(false);
  }

  async function handleSaveObservations() {
    if (!selectedFolder) return;
    setSavingObs(true);
    const res = await updateFolderAction(selectedFolder.id, { observations });
    if (res.success && res.folder) {
      setFolders(prev => prev.map(f => (f.id === res.folder!.id ? res.folder! : f)));
      setObsChanged(false);
      toast({ title: 'Observações salvas.' });
    } else {
      toast({ title: 'Erro ao salvar observações.', variant: 'destructive' });
    }
    setSavingObs(false);
  }

  async function handleRename() {
    if (!selectedFolder || !renameName.trim()) return;
    const res = await updateFolderAction(selectedFolder.id, { name: renameName });
    if (res.success && res.folder) {
      setFolders(prev =>
        prev.map(f => (f.id === res.folder!.id ? res.folder! : f)).sort((a, b) => a.name.localeCompare(b.name)),
      );
      setRenameDialogOpen(false);
      toast({ title: 'Pasta renomeada.' });
    } else {
      toast({ title: 'Erro ao renomear pasta.', variant: 'destructive' });
    }
  }

  async function handleDeleteFolder(folderId: string) {
    const res = await deleteFolderAction(folderId);
    if (res.success) {
      setFolders(prev => prev.filter(f => f.id !== folderId));
      if (selectedFolder?.id === folderId) setSelectedFolder(null);
      toast({ title: 'Pasta excluída.' });
    } else {
      toast({ title: 'Erro ao excluir pasta.', variant: 'destructive' });
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedFolder || !e.target.files?.length) return;
    const files = Array.from(e.target.files);
    const oversized = files.filter(f => f.size > MAX_FILE_MB * 1024 * 1024);
    if (oversized.length) {
      toast({ title: `Limite: ${MAX_FILE_MB} MB por arquivo.`, variant: 'destructive' });
      e.target.value = '';
      return;
    }
    setUploading(true);
    for (const file of files) {
      const dataUrl = await fileToDataUrl(file);
      const isImage = file.type.startsWith('image/');
      const res = await addFileToFolderAction(selectedFolder.id, {
        name: file.name,
        fileType: isImage ? 'image' : 'document',
        mimeType: file.type,
        size: file.size,
        dataUrl,
      });
      if (res.success && res.file) {
        setFolders(prev =>
          prev.map(f =>
            f.id === selectedFolder.id ? { ...f, files: [...f.files, res.file!] } : f,
          ),
        );
      } else {
        toast({ title: `Erro ao enviar "${file.name}".`, variant: 'destructive' });
      }
    }
    setUploading(false);
    e.target.value = '';
    toast({ title: 'Arquivo(s) enviado(s).' });
  }

  async function handleDeleteFile(fileId: string) {
    if (!selectedFolder) return;
    const res = await deleteFileAction(fileId);
    if (res.success) {
      setFolders(prev =>
        prev.map(f =>
          f.id === selectedFolder.id ? { ...f, files: f.files.filter(fl => fl.id !== fileId) } : f,
        ),
      );
      toast({ title: 'Arquivo excluído.' });
    } else {
      toast({ title: 'Erro ao excluir arquivo.', variant: 'destructive' });
    }
  }

  async function handleUpdateFileObs(fileId: string, observations: string) {
    if (!selectedFolder) return;
    const res = await updateFileObservationsAction(fileId, observations);
    if (res.success && res.file) {
      setFolders(prev =>
        prev.map(f =>
          f.id === selectedFolder.id
            ? { ...f, files: f.files.map(fl => (fl.id === fileId ? { ...fl, observations } : fl)) }
            : f,
        ),
      );
    } else {
      toast({ title: 'Erro ao salvar observação.', variant: 'destructive' });
    }
  }

  // ─── TELA DE DETALHE DA PASTA ───────────────────────────────────────────────
  if (selectedFolder) {
    const current = folders.find(f => f.id === selectedFolder.id) ?? selectedFolder;

    return (
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setSelectedFolder(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <FolderOpen className="h-6 w-6 text-yellow-500 shrink-0" />
          <h2 className="text-xl font-semibold flex-1 truncate">{current.name}</h2>
          <Button
            variant="outline"
            size="sm"
            onClick={() => { setRenameName(current.name); setRenameDialogOpen(true); }}
          >
            <Pencil className="h-4 w-4 mr-1" />
            Renomear
          </Button>
        </div>

        {/* ── 1. ARQUIVOS ── */}
        <div className="rounded-xl border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-base flex items-center gap-2">
              <Files className="h-4 w-4 text-muted-foreground" />
              Arquivos e Documentos
              <Badge variant="secondary">{current.files.length}</Badge>
            </h3>
            <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <Upload className="h-4 w-4 mr-2" />
              {uploading ? 'Enviando...' : 'Enviar Arquivo'}
            </Button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
            className="hidden"
            onChange={handleUpload}
          />

          {current.files.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-12 text-muted-foreground cursor-pointer hover:border-primary/40 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-8 w-8" />
              <p className="text-sm font-medium">Clique para enviar arquivos</p>
              <p className="text-xs">Imagens, PDF, Word, Excel — máx. {MAX_FILE_MB} MB</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {current.files.map(file => (
                <FileCard key={file.id} file={file} onDelete={handleDeleteFile} onUpdateObs={handleUpdateFileObs} />
              ))}
              <div
                className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-muted-foreground cursor-pointer hover:border-primary/40 transition-colors min-h-[120px]"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-5 w-5" />
                <p className="text-xs text-center">Adicionar mais</p>
              </div>
            </div>
          )}
        </div>

        {/* ── 2. OBSERVAÇÕES ── */}
        <div className="rounded-xl border bg-card p-5 space-y-3">
          <h3 className="font-semibold text-base">Observações</h3>
          <Textarea
            rows={5}
            placeholder="Adicione observações sobre esta pessoa..."
            value={observations}
            onChange={e => {
              setObservations(e.target.value);
              setObsChanged(e.target.value !== (current.observations ?? ''));
            }}
          />
          <div className="flex justify-end">
            <Button disabled={!obsChanged || savingObs} onClick={handleSaveObservations}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Observações
            </Button>
          </div>
        </div>

        {/* Dialog renomear */}
        <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader><DialogTitle>Renomear Pasta</DialogTitle></DialogHeader>
            <Input
              value={renameName}
              onChange={e => setRenameName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRename()}
              placeholder="Novo nome"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleRename} disabled={!renameName.trim()}>Salvar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  // ─── TELA DE LISTA (KANBAN) ─────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <FolderOpen className="h-7 w-7" />
        <div>
          <h1 className="text-2xl font-bold">Pastas</h1>
          <p className="text-sm text-muted-foreground">Organize documentos e imagens por pessoa</p>
        </div>
      </div>

      {/* Criar nova pasta */}
      <div className="flex gap-2 max-w-md">
        <Input
          placeholder="Nome da pasta (pessoa)"
          value={newFolderName}
          onChange={e => setNewFolderName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleCreateFolder()}
          disabled={creatingFolder}
        />
        <Button onClick={handleCreateFolder} disabled={creatingFolder || !newFolderName.trim()}>
          <FolderPlus className="h-4 w-4 mr-2" />
          Nova Pasta
        </Button>
      </div>

      {/* Busca */}
      {folders.length > 0 && (
        <Input
          className="max-w-sm"
          placeholder="Buscar pasta..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      )}

      {/* Kanban grid */}
      {loading ? (
        <p className="text-sm text-muted-foreground py-12 text-center">Carregando...</p>
      ) : filteredFolders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-20 text-muted-foreground">
          <Folder className="h-12 w-12" />
          <p className="text-sm font-medium">
            {search ? 'Nenhuma pasta encontrada.' : 'Nenhuma pasta criada ainda.'}
          </p>
          {!search && (
            <p className="text-xs">Digite um nome acima e clique em "Nova Pasta"</p>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filteredFolders.map(folder => (
            <KanbanCard
              key={folder.id}
              folder={folder}
              onClick={() => openFolder(folder)}
              onDelete={() => handleDeleteFolder(folder.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Card Kanban de pasta ────────────────────────────────────────────────────
function KanbanCard({
  folder,
  onClick,
  onDelete,
}: {
  folder: PersonFolder;
  onClick: () => void;
  onDelete: () => void;
}) {
  const images = folder.files.filter(f => f.fileType === 'image');
  const docs = folder.files.filter(f => f.fileType === 'document');
  const thumb = images[0]?.dataUrl;

  return (
    <div
      className="group relative flex flex-col rounded-xl border bg-card hover:shadow-md hover:border-primary/40 transition-all cursor-pointer overflow-hidden"
      onClick={onClick}
    >
      {/* Thumbnail ou ícone */}
      <div className="h-28 bg-muted flex items-center justify-center overflow-hidden">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt={folder.name} className="h-full w-full object-cover" />
        ) : (
          <Folder className="h-12 w-12 text-yellow-400" />
        )}
      </div>

      {/* Info */}
      <div className="p-3 flex-1 space-y-1">
        <p className="font-semibold text-sm leading-tight truncate" title={folder.name}>
          {folder.name}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          {images.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <ImageIcon className="h-3 w-3" /> {images.length}
            </span>
          )}
          {docs.length > 0 && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <FileText className="h-3 w-3" /> {docs.length}
            </span>
          )}
          {folder.files.length === 0 && (
            <span className="text-[11px] text-muted-foreground">Vazia</span>
          )}
        </div>
        {folder.observations && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">
            {folder.observations}
          </p>
        )}
      </div>

      {/* Botão excluir — aparece no hover */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
            onClick={e => e.stopPropagation()}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir pasta "{folder.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os arquivos e observações serão excluídos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={onDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ─── Card de arquivo ─────────────────────────────────────────────────────────
function FileCard({
  file,
  onDelete,
  onUpdateObs,
}: {
  file: FolderFile;
  onDelete: (id: string) => void;
  onUpdateObs: (id: string, obs: string) => Promise<void>;
}) {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [obs, setObs] = useState(file.observations ?? '');
  const [saving, setSaving] = useState(false);
  const isImage = file.fileType === 'image';
  const docInfo = getDocumentInfo(file.mimeType);

  // sincroniza se o pai atualizar
  useEffect(() => { setObs(file.observations ?? ''); }, [file.observations]);

  async function handleSaveObs() {
    setSaving(true);
    await onUpdateObs(file.id, obs);
    setSaving(false);
    toast({ title: 'Observação salva.' });
  }

  return (
    <>
      <div
        className="group relative flex flex-col rounded-xl border bg-card overflow-hidden hover:shadow-md transition-all cursor-pointer"
        onClick={() => setDialogOpen(true)}
      >
        {/* Thumbnail */}
        <div className="h-28 flex items-center justify-center bg-muted overflow-hidden">
          {isImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={file.dataUrl} alt={file.name} className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-1">
              <docInfo.Icon className={`h-10 w-10 ${docInfo.color}`} />
              <span className={`text-[10px] font-bold ${docInfo.color}`}>{docInfo.label}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="p-2 space-y-1">
          <p className="text-xs font-medium truncate leading-tight" title={file.name}>
            {file.name}
          </p>
          <div className="flex items-center gap-1.5">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
              {isImage ? 'Imagem' : 'Documento'}
            </Badge>
            {file.size && (
              <span className="text-[10px] text-muted-foreground">{formatBytes(file.size)}</span>
            )}
          </div>
          {file.observations ? (
            <p className="text-[11px] text-muted-foreground line-clamp-2 italic">
              {file.observations}
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground/50 italic">Sem observação</p>
          )}
          <p className="text-[10px] text-muted-foreground">
            {format(new Date(file.createdAt), 'dd/MM/yy HH:mm', { locale: ptBR })}
          </p>
        </div>

        {/* Excluir */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-1 right-1 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-destructive hover:text-destructive-foreground"
              onClick={e => e.stopPropagation()}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir arquivo?</AlertDialogTitle>
              <AlertDialogDescription>"{file.name}" será excluído permanentemente.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction onClick={() => onDelete(file.id)}>Excluir</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Dialog de detalhe + observação */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-2xl flex flex-col p-0 gap-0 overflow-hidden" style={{ maxHeight: '90vh' }}>
          {/* Cabeçalho fixo */}
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle className="truncate pr-6">{file.name}</DialogTitle>
          </DialogHeader>

          {/* Conteúdo rolável */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Preview */}
            {isImage ? (
              <div className="rounded-lg overflow-hidden bg-muted flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={file.dataUrl} alt={file.name} className="max-h-80 w-full object-contain" />
              </div>
            ) : (
              <div className="rounded-lg bg-muted flex flex-col items-center gap-3 py-8">
                <docInfo.Icon className={`h-16 w-16 ${docInfo.color}`} />
                <div className="text-center px-4">
                  <p className="text-sm font-semibold truncate max-w-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                </div>
                <a
                  href={file.dataUrl}
                  download={file.name}
                  className="text-sm font-medium underline text-primary"
                  onClick={e => e.stopPropagation()}
                >
                  Baixar arquivo
                </a>
              </div>
            )}

            {/* Observação */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Observação</p>
              <Textarea
                rows={3}
                placeholder="Adicione uma observação sobre este arquivo..."
                value={obs}
                onChange={e => setObs(e.target.value)}
              />
            </div>
          </div>

          {/* Rodapé fixo */}
          <div className="px-6 py-4 border-t shrink-0 flex justify-end gap-2">
            {isImage && (
              <a href={file.dataUrl} download={file.name}>
                <Button variant="outline" size="sm">
                  Baixar
                </Button>
              </a>
            )}
            <Button onClick={handleSaveObs} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              Salvar Observação
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
