/**
 * Design tokens — tema "pietra ollare & ottone".
 *
 * Questa è l'unica fonte di verità della palette in TypeScript.
 * Gli stessi valori sono esposti come CSS variables in `global.css`
 * (i due file vanno tenuti allineati). Nei componenti si preferiscono
 * le CSS variables (`var(--...)`); questo modulo serve quando servono
 * i valori a runtime in JS (es. canvas, grafici, calcoli di colore).
 */

export const color = {
  // superfici (dal fondo al rialzo)
  bg: '#2a2b27',
  panel: '#323430',
  surface: '#3b3d37',
  raised: '#44463f',

  // filetti / bordi
  rule: '#484a42',
  ruleSoft: '#3a3c36',

  // testo
  text: '#eee9dd',
  textMuted: '#a7a294',
  textWeak: '#7c786c',

  // ottone (denaro / luce di candela)
  brass: '#d0a860',
  brassDark: '#8f7642',
  onBrass: '#26251f',
} as const;

/** Colori semantici degli stati (denaro & ritiro). */
export const semantic = {
  cash: '#d0a860', // contanti (ottone)
  pending: '#82a6bb', // bonifico atteso (blu acciaio)
  received: '#95b389', // bonifico ricevuto (verde salvia)
  unpaid: '#d08869', // non pagato / allarme (terracotta)
} as const;

export const font = {
  serif: "'Fraunces Variable', Georgia, 'Times New Roman', serif",
  sans: "'Inter', system-ui, -apple-system, Segoe UI, sans-serif",
} as const;

/** Scala di spaziatura (px). */
export const space = {
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '32px',
  8: '40px',
  9: '56px',
} as const;

/** Raggi degli angoli: 10–20px come da design system. */
export const radius = {
  sm: '10px',
  md: '14px',
  lg: '20px',
  pill: '999px',
} as const;

/** Punto di rottura: sotto questa larghezza la navigazione si ripiega in barra superiore. */
export const layout = {
  navWidth: '250px',
  breakpoint: 880,
  toastWidth: '380px',
} as const;

export const tokens = { color, semantic, font, space, radius, layout } as const;
export default tokens;
