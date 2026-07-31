// Design Tokens — JS Connect Design System
// Source: colors_and_type.css

export const tokens = {
  colors: {
    // Brand
    brandNavy: '#173B6C',
    brandNavy700: '#102a4f',
    brandNavy300: '#4a6a99',
    brandTeal: '#21BDA3',
    brandTeal700: '#178873',
    brandTeal300: '#6dd5c2',
    brandTeal100: '#d4f1ea',

    // Primary aliases (app accent = teal)
    primary: '#21BDA3',
    primaryDark: '#178873',
    primaryLight: '#6dd5c2',
    primaryAlpha10: 'rgba(33, 189, 163, 0.1)',
    primaryAlpha15: 'rgba(33, 189, 163, 0.15)',
    primaryAlpha20: 'rgba(33, 189, 163, 0.2)',

    // Gray ramp
    gray50: '#f9fafb',
    gray100: '#f3f4f6',
    gray150: '#ececec',
    gray200: '#e5e7eb',
    gray300: '#d1d5db',
    gray400: '#9ca3af',
    gray500: '#6b7280',
    gray600: '#4b5563',
    gray700: '#374151',
    gray800: '#1f2937',
    gray900: '#111827',

    // App canvas + surfaces
    appBg: '#f8f8f8',
    bgDefault: '#f8f8f8',
    bgPaper: '#ffffff',
    bgSubtle: '#f5f5f7',
    surfaceAlt: '#fafafa',
    divider: '#f0f0f0',
    borderDefault: '#e5e7eb',
    borderLight: '#f0f0f0',
    borderSoft: 'rgba(0,0,0,0.08)',

    // Marketing ink
    ink: '#1d1d1f',
    inkMuted: '#86868b',
    inkBody: '#666666',
    textPrimary: '#111827',
    textSecondary: '#6b7280',
    textTertiary: '#9ca3af',

    // Semantic
    success: '#10b981',
    successLight: '#d1fae5',
    error: '#ef4444',
    errorLight: '#fee2e2',
    warning: '#f59e0b',
    warningLight: '#fef3c7',
    info: '#173B6C',
    infoLight: '#dbeafe',

    // Marketing CTA
    marketingBlack: '#000000',
    marketingWhite: '#ffffff',
  },

  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
    xl: '16px',
    xxl: '20px',
    xxxl: '24px',
    pill: '9999px',
    full: '50%',
  },

  shadows: {
    xs: '0 1px 2px rgba(0,0,0,0.04)',
    sm: '0 1px 3px rgba(0,0,0,0.05)',
    md: '0 1px 3px rgba(0,0,0,0.10)',
    lg: '0 4px 20px rgba(0,0,0,0.10)',
    xl: '0 20px 40px rgba(0,0,0,0.08)',
    pop: '0 20px 40px rgba(0,0,0,0.12)',
    alert: '0 4px 20px rgba(0,0,0,0.15)',
    card: '0 1px 3px rgba(0,0,0,0.10)',
    cardHover: '0 8px 30px rgba(0,0,0,0.08)',
    button: '0 2px 8px rgba(33, 189, 163, 0.3)',
  },

  gradients: {
    marketingHero: 'linear-gradient(45deg, #000 30%, #333 90%)',
    marketingOverlay: 'linear-gradient(45deg, rgba(0,0,0,0.02) 0%, rgba(0,0,0,0.05) 100%)',
    subtle: 'linear-gradient(135deg, #ffffff 0%, #f8f8f8 100%)',
    brand: 'linear-gradient(135deg, #173B6C 0%, #21BDA3 100%)',
  },

  transitions: {
    default: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
    fast: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
    slow: 'all 1000ms cubic-bezier(0.4, 0, 0.2, 1)',
  },

  layout: {
    sidebarIconW: 64,
    sidebarDetailW: 240,
    navbarH: 64,
    footerH: 24,
  },

  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    fontMono: "'JetBrains Mono', source-code-pro, Menlo, Monaco, Consolas, 'Courier New', monospace",
    display: { fontSize: '3.5rem', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.1 },
    h1: { fontSize: '2.5rem', fontWeight: 700, letterSpacing: '-0.02em' },
    h2: { fontSize: '2rem', fontWeight: 600, letterSpacing: '-0.01em' },
    h3: { fontSize: '1.5rem', fontWeight: 600 },
    pageTitle: { fontSize: '26px', fontWeight: 600, letterSpacing: '-0.02em' },
    sectionTitle: { fontSize: '1.25rem', fontWeight: 600, letterSpacing: '-0.01em' },
    cardTitle: { fontSize: '1rem', fontWeight: 600 },
    body: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.6 },
    bodySm: { fontSize: '0.875rem', fontWeight: 400, lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', fontWeight: 500 },
    eyebrow: { fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' as const },
  },
} as const;

export const { colors, radius, shadows, gradients, transitions, layout } = tokens;
