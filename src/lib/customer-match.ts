/**
 * Normalizações usadas para casar o snapshot `orders.customer` (JSON gravado
 * dentro do pedido) com o cadastro atual em `customers`.
 *
 * O pedido não tem FK com o cliente: o vínculo é reconstruído por comparação.
 * Divergências comuns que estas funções absorvem:
 *   - CPF/código que perderam o zero a esquerda (planilha tratou como número);
 *   - CPF gravado mascarado ("039.471.073-82") em registros antigos;
 *   - código com prefixo ("CLI-05581") ou sem padding ("5581");
 *   - nome com acento/caixa/espaços diferentes;
 *   - telefone com ou sem DDD e com ou sem o 9o dígito.
 *
 * IMPORTANTE: manter em sincronia com scripts/backfill-order-customers.mjs,
 * que replica estas regras em JS puro.
 */

export function matchDigits(value: unknown): string {
    return String(value ?? '').replace(/\D/g, '');
}

/** CPF comparável: 11 dígitos, com zeros à esquerda restaurados. '' quando não dá pra confiar. */
export function matchCpf(value: unknown): string {
    const digits = matchDigits(value);
    if (digits.length < 9 || digits.length > 11) return '';
    return digits.padStart(11, '0');
}

/** Código comparável: 5 dígitos ('5581' -> '05581'). '' quando não é um código de cliente. */
export function matchCode(value: unknown): string {
    const digits = matchDigits(value);
    if (!digits || digits.length > 5) return '';
    return digits.padStart(5, '0');
}

/** Nome comparável: minúsculo, sem acento, espaços colapsados. */
export function matchName(value: unknown): string {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

/** Telefone comparável: últimos 8 dígitos (imune a DDD e ao 9o dígito). */
export function matchPhoneTail(value: unknown): string {
    const digits = matchDigits(value);
    return digits.length >= 8 ? digits.slice(-8) : '';
}
