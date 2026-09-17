#!/usr/bin/env node
/**
 * Recasa o snapshot `orders.customer` (JSON gravado dentro do pedido) com o
 * cadastro atual em `customers`.
 *
 * Por que isso existe: pedido não tem FK com cliente. O vínculo na tela de
 * Clientes é reconstruído comparando id / CPF / código do snapshot com o
 * cadastro. Importação de clientes gera id novo (`CUST-<random>`) e realoca
 * código; planilha come zero a esquerda de CPF/código; venda antiga pode ter
 * ficado sem CPF. Quando os três divergem, o pedido fica órfão: a tela mostra
 * "Nenhum pedido encontrado" e o Saldo Devedor aparece R$ 0,00.
 *
 * O que o script altera: SOMENTE customer.id, customer.cpf e customer.code do
 * snapshot. Nome, telefone, endereço e todo o resto do pedido ficam intactos
 * (são histórico da venda).
 *
 * Uso:
 *   node scripts/backfill-order-customers.mjs                  # dry-run (não grava nada)
 *   node scripts/backfill-order-customers.mjs --limit 200      # amostra
 *   node scripts/backfill-order-customers.mjs --out rel.csv    # dry-run + CSV detalhado
 *   node scripts/backfill-order-customers.mjs --apply          # grava as correções
 *
 * Requer DATABASE_URL no ambiente. Faça backup antes de usar --apply.
 */

import { PrismaClient } from '@prisma/client';
import { writeFileSync } from 'node:fs';

// --- normalizações (espelham src/lib/customer-match.ts) ---------------------
const digits = (v) => String(v ?? '').replace(/\D/g, '');

const matchCpf = (v) => {
    const d = digits(v);
    if (d.length < 9 || d.length > 11) return '';
    return d.padStart(11, '0');
};

const matchCode = (v) => {
    const d = digits(v);
    if (!d || d.length > 5) return '';
    return d.padStart(5, '0');
};

const matchName = (v) =>
    String(v ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

const matchPhoneTail = (v) => {
    const d = digits(v);
    return d.length >= 8 ? d.slice(-8) : '';
};

// --- args ------------------------------------------------------------------
const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const limitIdx = argv.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? Number(argv[limitIdx + 1]) : 0;
const outIdx = argv.indexOf('--out');
const OUT = outIdx >= 0 ? argv[outIdx + 1] : null;

if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL não definida. Exporte a variável antes de rodar.');
    process.exit(1);
}

const db = new PrismaClient();

const parseSnapshot = (raw) => {
    if (!raw) return null;
    if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return null; }
    }
    return raw;
};

// --- indices do cadastro ---------------------------------------------------
const pushIndex = (map, key, value) => {
    if (!key) return;
    const list = map.get(key);
    if (list) list.push(value);
    else map.set(key, [value]);
};

const pickUnique = (map, key) => {
    if (!key) return { hit: null, ambiguous: false };
    const list = map.get(key);
    if (!list || !list.length) return { hit: null, ambiguous: false };
    if (list.length > 1) return { hit: null, ambiguous: true };
    return { hit: list[0], ambiguous: false };
};

async function main() {
    console.log(APPLY ? '>> MODO APLICAR: as correções serão gravadas.' : '>> DRY-RUN: nada será gravado.');

    const customers = await db.customer.findMany({
        select: { id: true, code: true, cpf: true, name: true, phone: true },
    });
    console.log(`Cadastro: ${customers.length} clientes.`);

    const byId = new Map();
    const byCpf = new Map();
    const byCode = new Map();
    const byNamePhone = new Map();

    for (const c of customers) {
        byId.set(String(c.id), c);
        pushIndex(byCpf, matchCpf(c.cpf), c);
        pushIndex(byCode, matchCode(c.code), c);
        const np = `${matchName(c.name)}|${matchPhoneTail(c.phone)}`;
        if (matchName(c.name) && matchPhoneTail(c.phone)) pushIndex(byNamePhone, np, c);
    }

    const orders = await db.order.findMany({
        select: { id: true, customer: true, status: true, total: true, date: true },
        orderBy: { createdAt: 'desc' },
        ...(LIMIT > 0 ? { take: LIMIT } : {}),
    });
    console.log(`Pedidos analisados: ${orders.length}\n`);

    const stats = { ok: 0, byCpf: 0, byIdAsCpf: 0, byCode: 0, byNamePhone: 0, ambiguous: 0, orphan: 0, unreadable: 0 };
    const plan = [];
    const rows = [];

    for (const order of orders) {
        const snap = parseSnapshot(order.customer);
        if (!snap || typeof snap !== 'object') {
            stats.unreadable++;
            rows.push([order.id, order.status, '', '', 'snapshot ilegível', '']);
            continue;
        }

        const snapId = String(snap.id ?? '').trim();
        if (snapId && byId.has(snapId)) {
            stats.ok++;
            continue; // já casa por id — a tela encontra o pedido
        }

        let hit = null;
        let via = '';
        let ambiguous = false;

        const cpfKey = matchCpf(snap.cpf);
        let r = pickUnique(byCpf, cpfKey);
        if (r.hit) { hit = r.hit; via = 'cpf'; }
        else if (r.ambiguous) ambiguous = true;

        if (!hit && !ambiguous) {
            // pedidos importados de sistema antigo guardam o CPF no campo `id`
            const idAsCpf = /^[0-9]{9,11}$/.test(snapId) ? matchCpf(snapId) : '';
            r = pickUnique(byCpf, idAsCpf);
            if (r.hit) { hit = r.hit; via = 'id-como-cpf'; }
            else if (r.ambiguous) ambiguous = true;
        }

        if (!hit && !ambiguous) {
            // Código sozinho não basta: a importação de clientes realoca códigos, então um
            // código antigo no snapshot pode hoje pertencer a outro cliente. Exige nome ou
            // telefone conferindo antes de reescrever o vínculo.
            r = pickUnique(byCode, matchCode(snap.code));
            if (r.hit) {
                const sameName = matchName(snap.name) && matchName(snap.name) === matchName(r.hit.name);
                const samePhone = matchPhoneTail(snap.phone) && matchPhoneTail(snap.phone) === matchPhoneTail(r.hit.phone);
                if (sameName || samePhone) { hit = r.hit; via = 'codigo'; }
            } else if (r.ambiguous) ambiguous = true;
        }

        if (!hit && !ambiguous) {
            const key = `${matchName(snap.name)}|${matchPhoneTail(snap.phone)}`;
            if (matchName(snap.name) && matchPhoneTail(snap.phone)) {
                r = pickUnique(byNamePhone, key);
                if (r.hit) { hit = r.hit; via = 'nome+telefone'; }
                else if (r.ambiguous) ambiguous = true;
            }
        }

        if (ambiguous) {
            stats.ambiguous++;
            rows.push([order.id, order.status, snap.name ?? '', snap.cpf ?? '', 'ambíguo (mais de um cliente casa)', '']);
            continue;
        }

        if (!hit) {
            stats.orphan++;
            rows.push([order.id, order.status, snap.name ?? '', snap.cpf ?? '', 'sem cliente correspondente', '']);
            continue;
        }

        if (via === 'cpf') stats.byCpf++;
        else if (via === 'id-como-cpf') stats.byIdAsCpf++;
        else if (via === 'codigo') stats.byCode++;
        else stats.byNamePhone++;

        const nextCustomer = {
            ...snap,
            id: hit.id,
            cpf: hit.cpf ?? snap.cpf ?? null,
            code: hit.code ?? snap.code ?? null,
        };

        plan.push({ orderId: order.id, customer: nextCustomer });
        rows.push([order.id, order.status, snap.name ?? '', snap.cpf ?? '', `corrigir via ${via}`, `${hit.id} / ${hit.code ?? '-'} / ${hit.cpf ?? '-'}`]);
    }

    console.log('--- Resumo ---');
    console.log(`já vinculados por id .......... ${stats.ok}`);
    console.log(`corrigir via CPF .............. ${stats.byCpf}`);
    console.log(`corrigir via id-como-CPF ...... ${stats.byIdAsCpf}`);
    console.log(`corrigir via código ........... ${stats.byCode}`);
    console.log(`corrigir via nome+telefone .... ${stats.byNamePhone}`);
    console.log(`ambíguos (revisar à mão) ...... ${stats.ambiguous}`);
    console.log(`órfãos (cliente inexistente) .. ${stats.orphan}`);
    console.log(`snapshot ilegível ............. ${stats.unreadable}`);
    console.log(`total a corrigir .............. ${plan.length}\n`);

    if (OUT) {
        const csv = ['pedido;status;nome_snapshot;cpf_snapshot;acao;cliente_cadastro']
            .concat(rows.map((r) => r.map((v) => String(v).replace(/;/g, ',')).join(';')))
            .join('\n');
        writeFileSync(OUT, '\uFEFF' + csv, 'utf8');
        console.log(`CSV detalhado: ${OUT}\n`);
    }

    if (!APPLY) {
        console.log('Dry-run concluído. Revise o CSV e rode de novo com --apply para gravar.');
        return;
    }

    let done = 0;
    for (const item of plan) {
        await db.order.update({ where: { id: item.orderId }, data: { customer: item.customer } });
        done++;
        if (done % 100 === 0) console.log(`  ${done}/${plan.length} pedidos atualizados...`);
    }
    console.log(`Concluído: ${done} pedidos atualizados.`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => db.$disconnect());
