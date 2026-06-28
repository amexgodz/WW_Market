const { detectLocale, scoreSkin } = require('../dist/server');

describe('utility functions', () => {
  test('detectLocale returns en for english header', () => {
    expect(detectLocale('en-US,en;q=0.9')).toBe('en');
  });

  test('detectLocale returns ru by default', () => {
    expect(detectLocale(undefined)).toBe('ru');
  });

  test('scoreSkin sums recommendation score by tags', () => {
    const score = scoreSkin(['rifle', 'red'], {
      rifle: { score: 2, updatedAt: Date.now() },
      red: { score: 3, updatedAt: Date.now() },
    });
    expect(score).toBe(5);
  });
});
