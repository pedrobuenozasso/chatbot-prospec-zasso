import { normalizeLanguage } from './i18n.mjs';

const NUMBER_PATTERN = String.raw`\d(?:[\d.,\s]*\d)?`;
const AREA_UNITS = Object.freeze([
  {
    kind: 'km2',
    factor: 100,
    pattern: String.raw`(?:km\s*(?:2|²)|quilometros?\s+quadrados?|kilometers?\s+squared?|square\s+kilometers?|kilometres?\s+carres?|quadratkilometer|kilometros?\s+cuadrados?)`,
  },
  {
    kind: 'm2',
    factor: 1 / 10_000,
    pattern: String.raw`(?:m\s*(?:2|²)|metros?\s+quadrados?|square\s+meters?|square\s+metres?|metres?\s+carres?|quadratmeter|metros?\s+cuadrados?)`,
  },
  {
    kind: 'hectare',
    factor: 1,
    // "hc" e "hectaria" aparecem com frequência em mensagens digitadas no
    // celular. São aceitos como variações inequívocas de hectare.
    pattern: String.raw`(?:ha|hc|hectares?|hectareas?|hectarias?|hektar(?:e|en)?)`,
  },
  {
    kind: 'are',
    factor: 0.01,
    pattern: String.raw`(?:areas?|ares?)`,
  },
  {
    kind: 'acre',
    factor: 0.40468564224,
    pattern: String.raw`(?:acres?)`,
  },
]);

function normalizedText(value) {
  return String(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[\u00a0\u202f]/gu, ' ')
    .trim();
}

function localizedNumber(rawValue, language) {
  const locale = normalizeLanguage(language);
  const compact = String(rawValue).replace(/\s+/g, '');
  if (!/^\d+(?:[.,]\d+)*$/.test(compact)) return null;

  let canonical = compact;
  if (compact.includes(',') && compact.includes('.')) {
    const decimalSeparator = compact.lastIndexOf(',') > compact.lastIndexOf('.') ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    canonical = compact.replaceAll(thousandsSeparator, '').replace(decimalSeparator, '.');
  } else {
    const separator = compact.includes(',') ? ',' : compact.includes('.') ? '.' : null;
    if (separator) {
      const pieces = compact.split(separator);
      const groupedThousands = pieces.length > 2
        ? pieces.slice(1).every((piece) => piece.length === 3)
        : pieces[1].length === 3 && ((locale === 'en-US' && separator === ',') || (locale !== 'en-US' && separator === '.'));
      canonical = groupedThousands ? pieces.join('') : pieces.join('.');
    }
  }

  const parsed = Number(canonical);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function isRateContext(text, unitEnd) {
  const suffix = text.slice(unitEnd, unitEnd + 45);
  return /^\s*(?:por|per|pro|par|cada)\s+(?:hora|hour|stunde|heure|heure|día|dia|day)\b/u.test(suffix);
}

export function parseAreaAnswer(answer, language = 'pt-BR') {
  const text = normalizedText(answer);
  if (!text) return null;

  for (const unit of AREA_UNITS) {
    const expression = new RegExp(`(${NUMBER_PATTERN})\\s*(${unit.pattern})(?![\\p{L}\\p{N}])`, 'giu');
    for (const match of text.matchAll(expression)) {
      if (isRateContext(text, match.index + match[0].length)) continue;
      const value = localizedNumber(match[1], language);
      const areaHectares = value === null ? null : value * unit.factor;
      // Valores acima de 100 mil hectares são possíveis no mundo real, mas
      // são suficientemente excepcionais para exigir confirmação humana. O
      // bot nunca deve transformar um possível valor em m² em 420.000 ha.
      if (areaHectares && areaHectares <= 100_000) {
        return { areaHectares, sourceUnit: unit.kind, confidence: 'high' };
      }
    }
  }

  // Quando a pergunta atual já pede hectares, uma resposta composta apenas
  // pelo número continua sendo interpretada como hectares.
  if (/^\d[\d.,\s]*\d$|^\d$/u.test(text)) {
    const areaHectares = localizedNumber(text, language);
    // Número isolado é aceito como hectare porque essa é a unidade solicitada
    // pela pergunta atual. Acima deste limite, a unidade precisa ser
    // confirmada explicitamente para impedir encaminhamentos absurdos.
    if (areaHectares && areaHectares <= 100_000) {
      return { areaHectares, sourceUnit: 'implicit_hectare', confidence: 'high' };
    }
  }

  return null;
}

export function formatAreaHectares(areaHectares, language = 'pt-BR') {
  const locale = normalizeLanguage(language);
  const units = {
    'pt-BR': 'hectares',
    'en-US': 'hectares',
    'de-DE': 'Hektar',
    'fr-FR': 'hectares',
    'es-ES': 'hectáreas',
  };
  const formatted = new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(areaHectares);
  return `${formatted} ${units[locale]}`;
}
