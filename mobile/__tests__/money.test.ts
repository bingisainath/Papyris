import { formatMinor, parseMajor, toMajorString } from '../src/utils/money';

test('parses amounts as text, without float errors', () => {
  expect(parseMajor('12,30', 'EUR')).toBe(1230);
  expect(parseMajor('0.29', 'EUR')).toBe(29);
  expect(parseMajor('1.234,50', 'EUR')).toBe(123450);
  expect(parseMajor('500', 'JPY')).toBe(500);
  expect(parseMajor('abc', 'EUR')).toBeNull();
});

test('round-trips and formats', () => {
  for (const minor of [0, 5, 1642, -120]) expect(parseMajor(toMajorString(minor, 'EUR'), 'EUR')).toBe(minor);
  expect(formatMinor(1642, 'EUR')).toMatch(/16\.42/);
});
