export const normalizeSearchText = (text: string) => {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

export const normalizeDigits = (text: string) => {
  return (text || '').replace(/\D/g, '');
};

export type CustomerSearchFilters = {
  q?: string;
  address?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zip?: string;
  cpfOrPhone?: string;
  code?: string;
  seller?: string;
  observations?: string;
};

export const splitTokens = (text: string, maxTokens: number = 12) => {
  const normalized = normalizeSearchText(text);
  if (!normalized) return [];
  return normalized.split(' ').filter(Boolean).slice(0, maxTokens);
};

export const matchesAllTokens = (haystackNormalized: string, tokens: string[]) => {
  if (!tokens || tokens.length === 0) return true;
  if (!haystackNormalized) return false;
  return tokens.every((t) => haystackNormalized.includes(t));
};

export const compactSearchFilters = (filters: CustomerSearchFilters): CustomerSearchFilters => {
  const q = String(filters?.q || '').trim();
  const address = String(filters?.address || '').trim();
  const number = normalizeDigits(String(filters?.number || ''));
  const neighborhood = String(filters?.neighborhood || '').trim();
  const city = String(filters?.city || '').trim();
  const state = String(filters?.state || '').trim();
  const zip = normalizeDigits(String(filters?.zip || ''));
  const cpfOrPhone = normalizeDigits(String(filters?.cpfOrPhone || ''));
  const code = String(filters?.code || '').trim();
  const seller = String(filters?.seller || '').trim();
  const observations = String(filters?.observations || '').trim();

  const next: CustomerSearchFilters = {};

  if (normalizeSearchText(q).length >= 2 || normalizeDigits(q).length >= 3) next.q = q;
  if (normalizeSearchText(address).length >= 2) next.address = address;
  if (number.length >= 1) next.number = number;
  if (normalizeSearchText(neighborhood).length >= 2) next.neighborhood = neighborhood;
  if (normalizeSearchText(city).length >= 2) next.city = city;
  if (normalizeSearchText(state).length >= 2) next.state = state;
  if (zip.length >= 3) next.zip = zip;
  if (cpfOrPhone.length >= 3) next.cpfOrPhone = cpfOrPhone;
  if (normalizeSearchText(code).length >= 2) next.code = code;
  if (normalizeSearchText(seller).length >= 2) next.seller = seller;
  if (normalizeSearchText(observations).length >= 2) next.observations = observations;

  return next;
};

export const parseUnifiedSearchFilters = (input: string): CustomerSearchFilters => {
  const raw = String(input || '').trim();
  if (!raw) return {};

  const keyToField: Record<string, keyof CustomerSearchFilters> = {
    q: 'q',
    busca: 'q',
    end: 'address',
    endereco: 'address',
    rua: 'address',
    num: 'number',
    numero: 'number',
    cep: 'zip',
    bairro: 'neighborhood',
    cidade: 'city',
    estado: 'state',
    uf: 'state',
    cpf: 'cpfOrPhone',
    tel: 'cpfOrPhone',
    fone: 'cpfOrPhone',
    telefone: 'cpfOrPhone',
    cod: 'code',
    codigo: 'code',
    cli: 'code',
    vend: 'seller',
    vendedor: 'seller',
    obs: 'observations',
    observacao: 'observations',
    observacoes: 'observations',
  };

  const parts = raw.split(/\s+/g).filter(Boolean);
  const collected: Partial<Record<keyof CustomerSearchFilters, string[]>> = {};

  let currentField: keyof CustomerSearchFilters | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (!currentField) return;
    if (!buffer.length) return;
    if (!collected[currentField]) collected[currentField] = [];
    collected[currentField]!.push(buffer.join(' '));
    buffer = [];
  };

  for (const token of parts) {
    const idx = token.indexOf(':');
    if (idx > 0) {
      const key = normalizeSearchText(token.slice(0, idx));
      const field = keyToField[key];
      if (field) {
        flush();
        currentField = field;
        const rest = token.slice(idx + 1);
        if (rest) buffer.push(rest);
        continue;
      }
    }
    if (!currentField) currentField = 'q';
    buffer.push(token);
  }
  flush();

  const filters: CustomerSearchFilters = {};
  for (const [field, values] of Object.entries(collected) as Array<[keyof CustomerSearchFilters, string[]]>) {
    filters[field] = values.join(' ');
  }

  return compactSearchFilters(filters);
};
