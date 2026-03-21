import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

const prisma = new PrismaClient();

function formatCustomerCode(value: number): string {
  return String(value).padStart(5, '0');
}

function normalizeCustomerCode(code: unknown): string | null {
  if (code === null || code === undefined) return null;
  const raw = String(code).trim();
  if (!raw) return null;
  const withoutPrefix = raw.replace(/^CLI-/i, '').trim();
  if (!withoutPrefix) return null;
  if (!/^\d+$/.test(withoutPrefix)) return null;
  if (withoutPrefix.length > 5) return null;
  return withoutPrefix.padStart(5, '0');
}

function parseCustomerCodeNumber(code: unknown): number | null {
  const normalized = normalizeCustomerCode(code);
  if (!normalized) return null;
  const n = Number.parseInt(normalized, 10);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const apply = process.argv.includes('--apply');

  const customers = await prisma.customer.findMany({
    select: { id: true, name: true, code: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  let maxCode = 0;
  for (const c of customers) {
    const n = parseCustomerCodeNumber(c.code);
    if (n !== null && n > maxCode) maxCode = n;
  }

  const used = new Set<string>();
  const updates: Array<{ id: string; name: string; oldCode: string | null; newCode: string; reason: 'missing' | 'duplicate' | 'invalid' }> = [];

  let next = maxCode + 1;
  for (const c of customers) {
    const clean = normalizeCustomerCode(c.code);
    if (!clean) {
      const raw = c.code === null || c.code === undefined ? '' : String(c.code).trim();
      updates.push({
        id: c.id,
        name: c.name,
        oldCode: raw ? raw : null,
        newCode: formatCustomerCode(next),
        reason: raw ? 'invalid' : 'missing'
      });
      next++;
      continue;
    }
    if (used.has(clean)) {
      updates.push({ id: c.id, name: c.name, oldCode: clean, newCode: formatCustomerCode(next), reason: 'duplicate' });
      next++;
      continue;
    }
    used.add(clean);
  }

  const lastAllocated = next - 1;
  if (lastAllocated > 99999) {
    throw new Error('Limite de códigos atingido (99999).');
  }

  console.log(`Customers scan: ${customers.length}`);
  console.log(`Max code (numeric) found: ${maxCode}`);
  console.log(`To update: ${updates.length}`);
  console.log(`Mode: ${apply ? 'APPLY' : 'DRY_RUN'} (use --apply to execute)`);

  if (!apply) {
    console.log('Sample updates:');
    updates.slice(0, 25).forEach((u) => {
      console.log(`- ${u.reason} | ${u.name} | ${u.id} | ${u.oldCode ?? '(null)'} -> ${u.newCode}`);
    });
    return;
  }

  const chunkSize = 200;
  for (let i = 0; i < updates.length; i += chunkSize) {
    const chunk = updates.slice(i, i + chunkSize);
    await prisma.$transaction(
      chunk.map((u) =>
        prisma.customer.update({
          where: { id: u.id },
          data: { code: u.newCode },
        })
      )
    );
    console.log(`Updated ${Math.min(i + chunkSize, updates.length)} / ${updates.length}`);
  }

  const currentConfig = await prisma.config.findUnique({ where: { key: 'customerCodeCounter' } });
  const currentLast = Number((currentConfig?.value as any)?.lastNumber || 0);
  const safeCurrentLast = Number.isFinite(currentLast) && currentLast <= 99999 ? currentLast : 0;
  const nextLast = Math.max(safeCurrentLast, lastAllocated);

  await prisma.config.upsert({
    where: { key: 'customerCodeCounter' },
    update: { value: { lastNumber: nextLast } },
    create: { key: 'customerCodeCounter', value: { lastNumber: nextLast } },
  });

  const duplicates = await prisma.$queryRaw<Array<{ code: string; c: bigint | number }>>`
    SELECT code, COUNT(*) as c
    FROM customers
    WHERE code IS NOT NULL AND code <> ''
    GROUP BY code
    HAVING COUNT(*) > 1
    ORDER BY c DESC, code ASC
    LIMIT 20
  `;

  if (duplicates.length > 0) {
    console.log('Remaining duplicates (top 20):');
    duplicates.forEach((d) => console.log(`- ${d.code}: ${String(d.c)}`));
    process.exitCode = 1;
  } else {
    console.log('No duplicate codes found after update.');
  }

  console.log(`Config customerCodeCounter.lastNumber set to: ${nextLast}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
