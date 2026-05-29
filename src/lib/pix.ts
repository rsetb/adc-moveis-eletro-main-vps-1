/**
 * Gera o payload para um QR Code PIX estático.
 * Segue o padrão EMV® QRCPS-MPM (BR Code).
 * @see https://www.bcb.gov.br/content/estabilidadefinanceira/pix/Regulamento_Pix/II_ManualdePadroesparaIniciacaodoPix.pdf
 */

// ─── Tipos ───────────────────────────────────────────────────────────────────

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export interface PixKeyValidation {
  valid: boolean;
  type: PixKeyType | null;
  message: string;
}

// ─── Helpers internos ────────────────────────────────────────────────────────

const onlyDigits = (value: string): string => (value || '').replace(/\D/g, '');

function validaCpf(digits: string): boolean {
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const calc = (len: number) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * (len + 1 - i);
    return (sum * 10) % 11 % 10;
  };
  return calc(9) === Number(digits[9]) && calc(10) === Number(digits[10]);
}

function validaCnpj(digits: string): boolean {
  if (digits.length !== 14 || /^(\d)\1{13}$/.test(digits)) return false;
  const calc = (len: number, weights: number[]) => {
    let sum = 0;
    for (let i = 0; i < len; i++) sum += Number(digits[i]) * weights[i];
    const r = sum % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return calc(12, w1) === Number(digits[12]) && calc(13, w2) === Number(digits[13]);
}

// DDDs válidos no Brasil (ANATEL)
const DDD_VALIDOS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19,
  21, 22, 24, 27, 28,
  31, 32, 33, 34, 35, 37, 38,
  41, 42, 43, 44, 45, 46, 47, 48, 49,
  51, 53, 54, 55,
  61, 62, 63, 64, 65, 66, 67, 68, 69,
  71, 73, 74, 75, 77, 79,
  81, 82, 83, 84, 85, 86, 87, 88, 89,
  91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

function validaTelefoneBrasileiro(digits: string): boolean {
  // Aceita com ou sem 55 na frente
  let nums = digits;
  if (nums.startsWith('55') && (nums.length === 12 || nums.length === 13)) {
    nums = nums.slice(2);
  }
  if (nums.length !== 10 && nums.length !== 11) return false;
  const ddd = Number(nums.slice(0, 2));
  if (!DDD_VALIDOS.has(ddd)) return false;
  const numero = nums.slice(2);
  // Celular: 9 dígitos começando com 9; fixo: 8 dígitos começando com 2-5
  if (numero.length === 9) return numero[0] === '9';
  if (numero.length === 8) return /^[2-5]/.test(numero);
  return false;
}

/**
 * Detecta o tipo da chave PIX e retorna null se inválida.
 * Validação local — não consulta o DICT do Banco Central.
 */
export function getPixKeyType(key: string): PixKeyType | null {
  const raw = (key || '').trim();
  if (!raw) return null;

  // E-mail
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(raw.toLowerCase())) return 'email';

  // Chave aleatória (EVP) — UUID v4
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) return 'aleatoria';

  const d = onlyDigits(raw);

  // CPF
  if (d.length === 11 && validaCpf(d)) return 'cpf';

  // CNPJ
  if (d.length === 14 && validaCnpj(d)) return 'cnpj';

  // Telefone com prefixo +
  if (raw.startsWith('+')) {
    const tel = onlyDigits(raw.slice(1));
    if (validaTelefoneBrasileiro(tel)) return 'telefone';
    return null;
  }

  // Telefone sem prefixo
  if (validaTelefoneBrasileiro(d)) return 'telefone';

  return null;
}

/**
 * Valida uma chave PIX retornando resultado detalhado com mensagem de erro.
 * Ideal para uso em formulários.
 */
export function validatePixKey(key: string): PixKeyValidation {
  const raw = (key || '').trim();

  if (!raw) return { valid: false, type: null, message: 'Informe a chave PIX.' };

  const type = getPixKeyType(raw);
  if (type) return { valid: true, type, message: '' };

  // Mensagens de erro específicas por formato aproximado
  const d = onlyDigits(raw);

  if (d.length === 11) return { valid: false, type: null, message: 'CPF inválido (dígitos verificadores incorretos).' };
  if (d.length === 14) return { valid: false, type: null, message: 'CNPJ inválido (dígitos verificadores incorretos).' };
  if (/^[^\s@]+@[^\s@]+/.test(raw)) return { valid: false, type: null, message: 'E-mail inválido.' };
  if (raw.startsWith('+') || d.length === 10 || d.length === 11 || d.length === 12 || d.length === 13) {
    return { valid: false, type: null, message: 'Telefone inválido. Use o formato +55DDD9XXXXXXXX ou (DDD) 9XXXX-XXXX.' };
  }
  if (/^[0-9a-f-]{36}$/i.test(raw)) return { valid: false, type: null, message: 'Chave aleatória inválida. Deve ser um UUID v4.' };

  return { valid: false, type: null, message: 'Chave PIX não reconhecida. Use CPF, CNPJ, e-mail, telefone ou chave aleatória (UUID).' };
}

/**
 * Calcula o CRC16-CCITT para o payload PIX.
 * @param data O payload a ser calculado.
 * @returns A string do checksum CRC16 com 4 caracteres.
 */
function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return ('0000' + (crc & 0xffff).toString(16).toUpperCase()).slice(-4);
}

/**
 * Formata um campo do payload PIX (ID, Tamanho, Valor).
 * @param id O ID do campo.
 * @param value O valor do campo.
 * @returns A string formatada.
 */
const formatValue = (id: string, value: string): string => {
  const len = value.length.toString().padStart(2, '0');
  return `${id}${len}${value}`;
};

export const isValidPixKey = (key: string): boolean => getPixKeyType(key) !== null;

const normalizePixKeyForPayload = (key: string): string => {
  const raw = (key || '').trim();
  if (!raw) return '';

  const type = getPixKeyType(raw);
  if (!type) return '';

  if (type === 'email') return raw.toLowerCase();
  if (type === 'aleatoria') return raw.toLowerCase();

  const digits = onlyDigits(raw.startsWith('+') ? raw.slice(1) : raw);

  if (type === 'cpf') return onlyDigits(raw);
  if (type === 'cnpj') return onlyDigits(raw);

  // telefone — garante formato +55DDDNÚMERO
  if (type === 'telefone') {
    if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) return `+${digits}`;
    return `+55${digits}`;
  }

  return raw;
};

/**
 * Gera a string completa do payload PIX "Copia e Cola".
 * @param key Chave PIX (CPF, CNPJ, Email, Telefone ou Chave Aleatória).
 * @param merchantName Nome do recebedor (loja).
 * @param merchantCity Cidade do recebedor.
 * @param txid ID da transação (deve ser único, alfanumérico).
 * @param amount Valor da transação.
 * @returns O payload PIX completo.
 */
export const generatePixPayload = (
  key: string,
  merchantName: string,
  merchantCity: string,
  txid: string,
  amount: number
): string => {
  const safeAmount = Number(amount);
  if (!Number.isFinite(safeAmount) || safeAmount <= 0) return '';

  const normalizedKey = normalizePixKeyForPayload(key);
  if (!normalizedKey || !isValidPixKey(normalizedKey)) return '';

  // Normaliza e trunca os campos para estarem de acordo com as regras do PIX.
  const normalizedMerchantName = merchantName
    .substring(0, 25)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  const normalizedMerchantCity = merchantCity
    .substring(0, 15)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();

  if (!normalizedMerchantName || !normalizedMerchantCity) return '';

  const normalizedTxid = txid.replace(/[^a-zA-Z0-9]/g, '').substring(0, 25) || '***';

  const payload = [
    formatValue('00', '01'), // Payload Format Indicator
    formatValue(
      '26', // Merchant Account Information
      formatValue('00', 'br.gov.bcb.pix') + formatValue('01', normalizedKey)
    ),
    formatValue('52', '0000'), // Merchant Category Code
    formatValue('53', '986'), // Transaction Currency (BRL)
    formatValue('54', safeAmount.toFixed(2)), // Transaction Amount
    formatValue('58', 'BR'), // Country Code
    formatValue('59', normalizedMerchantName), // Merchant Name
    formatValue('60', normalizedMerchantCity), // Merchant City
    formatValue('62', formatValue('05', normalizedTxid)), // Additional Data Field (txid)
  ].join('');

  const payloadWithCrcPrefix = `${payload}6304`;
  const crc = crc16(payloadWithCrcPrefix);

  return `${payloadWithCrcPrefix}${crc}`;
};
