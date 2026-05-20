'use server';

import { db } from '@/lib/db';
import type { PersonFolder, FolderFile } from '@/lib/types';

function mapFolder(f: any, files: any[] = []): PersonFolder {
  return {
    id: f.id,
    name: f.name,
    observations: f.observations ?? undefined,
    createdById: f.createdById ?? undefined,
    createdByName: f.createdByName ?? undefined,
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
    updatedAt: f.updatedAt instanceof Date ? f.updatedAt.toISOString() : String(f.updatedAt),
    files: files.map(mapFile),
  };
}

function mapFile(f: any): FolderFile {
  return {
    id: f.id,
    folderId: f.folderId,
    name: f.name,
    fileType: f.fileType as 'image' | 'document',
    mimeType: f.mimeType ?? undefined,
    size: f.size ?? undefined,
    dataUrl: f.dataUrl,
    observations: f.observations ?? undefined,
    createdAt: f.createdAt instanceof Date ? f.createdAt.toISOString() : String(f.createdAt),
  };
}

export async function getFoldersAction(): Promise<PersonFolder[]> {
  const folders = await db.personFolder.findMany({
    orderBy: { name: 'asc' },
    include: { files: { orderBy: { createdAt: 'asc' } } },
  });
  return folders.map(f => mapFolder(f, f.files));
}

export async function createFolderAction(
  name: string,
  userId?: string,
  userName?: string,
): Promise<{ success: boolean; folder?: PersonFolder; error?: string }> {
  try {
    const folder = await db.personFolder.create({
      data: { name: name.trim(), createdById: userId, createdByName: userName },
      include: { files: true },
    });
    return { success: true, folder: mapFolder(folder, folder.files) };
  } catch {
    return { success: false, error: 'Erro ao criar pasta.' };
  }
}

export async function updateFolderAction(
  id: string,
  data: { name?: string; observations?: string },
): Promise<{ success: boolean; folder?: PersonFolder; error?: string }> {
  try {
    const folder = await db.personFolder.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.observations !== undefined ? { observations: data.observations } : {}),
      },
      include: { files: { orderBy: { createdAt: 'asc' } } },
    });
    return { success: true, folder: mapFolder(folder, folder.files) };
  } catch {
    return { success: false, error: 'Erro ao atualizar pasta.' };
  }
}

export async function deleteFolderAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.personFolder.delete({ where: { id } });
    return { success: true };
  } catch {
    return { success: false, error: 'Erro ao excluir pasta.' };
  }
}

export async function addFileToFolderAction(
  folderId: string,
  file: { name: string; fileType: 'image' | 'document'; mimeType: string; size: number; dataUrl: string },
): Promise<{ success: boolean; file?: FolderFile; error?: string }> {
  try {
    const created = await db.folderFile.create({
      data: {
        folderId,
        name: file.name,
        fileType: file.fileType,
        mimeType: file.mimeType,
        size: file.size,
        dataUrl: file.dataUrl,
      },
    });
    return { success: true, file: mapFile(created) };
  } catch {
    return { success: false, error: 'Erro ao salvar arquivo.' };
  }
}

export async function updateFileObservationsAction(
  fileId: string,
  observations: string,
): Promise<{ success: boolean; file?: FolderFile; error?: string }> {
  try {
    const updated = await db.folderFile.update({
      where: { id: fileId },
      data: { observations },
    });
    return { success: true, file: mapFile(updated) };
  } catch {
    return { success: false, error: 'Erro ao salvar observação.' };
  }
}

export async function deleteFileAction(fileId: string): Promise<{ success: boolean; error?: string }> {
  try {
    await db.folderFile.delete({ where: { id: fileId } });
    return { success: true };
  } catch {
    return { success: false, error: 'Erro ao excluir arquivo.' };
  }
}
