import { db } from './db';

export function formatCustomerCode(value: number): string {
  return String(value).padStart(5, '0');
}

export function normalizeCustomerCodeInput(code: unknown): string | null {
  if (code === null || code === undefined) return null;
  const raw = String(code).trim();
  if (!raw) return null;
  const withoutPrefix = raw.replace(/^CLI-/i, '').trim();
  if (!withoutPrefix) return null;
  if (!/^\d+$/.test(withoutPrefix)) return null;
  if (withoutPrefix.length > 5) return null;
  return withoutPrefix.padStart(5, '0');
}

export function parseCustomerCodeNumber(code: unknown): number | null {
  const normalized = normalizeCustomerCodeInput(code);
  if (!normalized) return null;
  const n = Number.parseInt(normalized, 10);
  return Number.isFinite(n) ? n : null;
}

export async function getMaxCustomerCodeNumberFromDb(): Promise<number> {
  const rows = await db.$queryRaw<{ maxCode: bigint | number | null }[]>`
    SELECT MAX(CAST(code AS UNSIGNED)) AS maxCode
    FROM customers
    WHERE code REGEXP '^[0-9]{5}$'
  `;
  const raw = rows?.[0]?.maxCode ?? 0;
  const maxCode = typeof raw === 'bigint' ? Number(raw) : Number(raw);
  return Number.isFinite(maxCode) ? maxCode : 0;
}

export async function allocateNextCustomerCode(): Promise<string> {
  try {
    const { endNumber } = await reserveCustomerCodes(1);
    return formatCustomerCode(endNumber);
  } catch (error) {
    console.error("Error allocating customer code:", error);
    throw new Error("Falha ao gerar código sequencial do cliente. Tente novamente.");
  }
}

export async function reserveCustomerCodes(
  count: number,
  minLastNumber: number = 0
): Promise<{ startNumber: number; endNumber: number }> {
  if (count <= 0) {
    return { startNumber: 0, endNumber: 0 };
  }

  try {
    const existingMax = await getMaxCustomerCodeNumberFromDb();
    const data = await db.config.findUnique({
      where: { key: 'customerCodeCounter' }
    });

    const lastNumberRaw = (data?.value as any)?.lastNumber || 0;
    const lastNumberParsed = Number(lastNumberRaw);
    const lastNumber = Number.isFinite(lastNumberParsed) ? lastNumberParsed : 0;
    const minParsed = Number(minLastNumber);
    const safeMin = Number.isFinite(minParsed) ? minParsed : 0;
    const safeLast = lastNumber > 99999 ? existingMax : lastNumber;
    const base = Math.max(safeLast, safeMin, existingMax);
    const startNumber = base + 1;
    const endNumber = base + count;

    if (endNumber > 99999) {
      throw new Error('Limite de códigos atingido (99999).');
    }

    await db.config.upsert({
      where: { key: 'customerCodeCounter' },
      update: { value: { lastNumber: endNumber } },
      create: { key: 'customerCodeCounter', value: { lastNumber: endNumber } }
    });

    return { startNumber, endNumber };
  } catch (error) {
    console.error("Error reserving customer codes:", error);
    throw new Error("Falha ao reservar códigos sequenciais do cliente. Tente novamente.");
  }
}
