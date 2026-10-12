import { convertMinor, formatMinor, parseMajor, toMajorString } from './money';

describe('parseMajor', () => {
  it.each([
    ['12.30', 'EUR', 1230],
    ['12,30', 'EUR', 1230],
    ['12.3', 'EUR', 1230],
    ['1,234.50', 'USD', 123450],
    ['1.234,50', 'EUR', 123450],
    ['€ 3', 'EUR', 300],
    ['-1.20', 'EUR', -120],
    ['0.005', 'EUR', 1],
    ['0.29', 'EUR', 29], // 0.29 * 100 is 28.999… in floats
    ['500', 'JPY', 500],
    ['1.234', 'KWD', 1234],
  ])('%s %s -> %d', (text, currency, minor) => {
    expect(parseMajor(text, currency)).toBe(minor);
  });

  it('rejects junk', () => {
    expect(parseMajor('', 'EUR')).toBeNull();
    expect(parseMajor('abc', 'EUR')).toBeNull();
  });
});

describe('toMajorString', () => {
  it('round-trips', () => {
    for (const minor of [0, 5, 99, 100, 1642, -120, 123456]) {
      expect(parseMajor(toMajorString(minor, 'EUR'), 'EUR')).toBe(minor);
    }
    expect(toMajorString(5, 'EUR')).toBe('0.05');
    expect(toMajorString(500, 'JPY')).toBe('500');
  });
});

it('formats with the currency', () => {
  expect(formatMinor(1642, 'EUR')).toMatch(/16\.42/);
  expect(formatMinor(500, 'JPY')).toMatch(/500/);
});


describe('convertMinor', () => {
  // rates: units of each currency per 1 of the target (USD here)
  const rates = { USD: 1, EUR: 0.5, JPY: 150 };
  it('converts through the rate, respecting each currency\'s decimals', () => {
    expect(convertMinor(1000, 'EUR', 'USD', rates)).toBe(2000); // €10.00 → $20.00
    expect(convertMinor(1500, 'JPY', 'USD', rates)).toBe(1000); // ¥1500 → $10.00
    expect(convertMinor(1234, 'USD', 'USD', null)).toBe(1234);
  });
  it('gives null without a rate', () => {
    expect(convertMinor(100, 'GBP', 'USD', rates)).toBeNull();
    expect(convertMinor(100, 'EUR', 'USD', null)).toBeNull();
  });
});
