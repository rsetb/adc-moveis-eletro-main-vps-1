const UFS = new Set([
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA',
  'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
]);

const LOWER_WORDS = new Set(['de', 'da', 'do', 'das', 'dos', 'e', 'em', 'na', 'no', 'nas', 'nos', 'a', 'o', 'as', 'os', 'para', 'pra', 'por', 'com', 'uma', 'um', 'ao']);

const capitalize = (w: string) => (w ? w.charAt(0).toLocaleUpperCase('pt-BR') + w.slice(1) : w);

/**
 * Deixa textos digitados em CAIXA ALTA legíveis para exibição.
 * "SAPIRANGA FORTALEZA-CE" -> "Sapiranga Fortaleza-CE"
 * Textos que já têm letras minúsculas são mantidos como estão.
 */
export function displayText(input?: string | null): string {
  const s = (input ?? '').trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const hasLower = /\p{Ll}/u.test(s);
  const hasUpper = /\p{Lu}/u.test(s);
  if (hasLower || !hasUpper) return s;

  const words = s.toLocaleLowerCase('pt-BR').split(' ');
  const last = words.length - 1;

  // Frases (mais de 4 palavras): só a primeira letra maiúscula
  if (words.length > 4) {
    const sentence = capitalize(words.join(' '));
    return sentence.replace(/-(\p{L}{2})\b/gu, (m, uf: string) => (UFS.has(uf.toUpperCase()) ? `-${uf.toUpperCase()}` : m));
  }

  return words
    .map((word, i) =>
      word
        .split(/([-/])/)
        .map((part, j) => {
          if (part === '-' || part === '/') return part;
          const upper = part.toLocaleUpperCase('pt-BR');
          // Sigla de estado após hífen/barra ("Fortaleza-CE") ou como última palavra ("Fortaleza CE")
          if (UFS.has(upper) && (j > 0 || (i > 0 && i === last))) return upper;
          if (i > 0 && j === 0 && LOWER_WORDS.has(part)) return part;
          return capitalize(part);
        })
        .join('')
    )
    .join(' ');
}

/** Nome de zona de entrega para exibição (sem ":" sobrando no final). */
export function displayZoneName(name?: string | null): string {
  return displayText(name).replace(/[\s:–-]+$/, '');
}
