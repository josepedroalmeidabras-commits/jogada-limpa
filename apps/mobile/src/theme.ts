// Centralised colour + spacing tokens.
// Brand: S7VN — premium gold-on-deep-forest aesthetic.

export const colors = {
  // Deep forest green background (replaces pure black for richer feel)
  bg: '#0E1812',
  bgElevated: 'rgba(255,255,255,0.04)',
  bgElevatedHover: 'rgba(255,255,255,0.06)',
  bgSubtle: 'rgba(255,255,255,0.02)',
  // Hero card gradient endpoints (top → bottom)
  bgHeroTop: '#1A2520',
  bgHeroBottom: '#0E1812',

  text: '#ffffff',
  textMuted: '#a8b3ad',
  // textDim e textFaint: subidos para passar WCAG AA sobre bg #0E1812.
  // Anteriores #737d77 (~3.5:1) e #5a635d (~2.3:1) falhavam o threshold de 4.5:1.
  textDim: '#9aa49e',
  textFaint: '#7d877f',

  // Brand — warm bronze/gold from the S7VN crest
  // Two tiers to avoid "everything is gold" fatigue:
  // - goldDeep: saturated headline gold for hero numbers / display moments
  // - brand:    standard gold for buttons, primary text accents
  // - goldDim:  desaturated for borders, dividers, subtle accents
  goldDeep: '#E0B97C',
  brand: '#C9A26B',
  brandHover: '#B58E55',
  brandSoft: 'rgba(201,162,107,0.12)',
  brandSoftBorder: 'rgba(201,162,107,0.35)',
  goldDim: 'rgba(201,162,107,0.22)',
  goldGlow: 'rgba(201,162,107,0.18)',

  // Competition / amigável accent — azul electric para diferenciar das peladinhas
  compete: '#5BB0FF',
  competeSoft: 'rgba(91,176,255,0.14)',
  competeDim: 'rgba(91,176,255,0.30)',

  // Semantic — kept readable on dark green
  success: '#34d399',
  successSoft: 'rgba(52,211,153,0.12)',
  successSoftBorder: 'rgba(52,211,153,0.35)',
  warning: '#fbbf24',
  warningSoft: 'rgba(251,191,36,0.12)',
  warningSoftBorder: 'rgba(251,191,36,0.35)',
  danger: '#f87171',
  dangerSoft: 'rgba(248,113,113,0.12)',
  dangerSoftBorder: 'rgba(248,113,113,0.35)',

  borderSubtle: 'rgba(255,255,255,0.06)',
  borderMuted: 'rgba(255,255,255,0.10)',
};

// Gradient sets for use with expo-linear-gradient
export const gradients = {
  hero: ['#1E2A24', '#13201A', '#0E1812'] as const,
  card: ['#161F19', '#0E1812'] as const,
  goldOnDark: ['rgba(224,185,124,0.18)', 'rgba(201,162,107,0.04)'] as const,
};

// Editorial typography scale — premium hero numbers and titles
export const typography = {
  // Display: huge hero number (win%, final score, ELO)
  display1: {
    fontSize: 64,
    fontWeight: '900' as const,
    letterSpacing: -2,
    lineHeight: 64,
  },
  display2: {
    fontSize: 48,
    fontWeight: '900' as const,
    letterSpacing: -1.5,
    lineHeight: 48,
  },
  display3: {
    fontSize: 36,
    fontWeight: '900' as const,
    letterSpacing: -1,
    lineHeight: 38,
  },
  // Eyebrow: tiny caps label
  eyebrow: {
    fontSize: 10,
    fontWeight: '800' as const,
    letterSpacing: 1.6,
    textTransform: 'uppercase' as const,
  },
};
