/**
 * The look of the Nuxt UI components, set to the values of the Figma design (Lukas/design/, the "Components" page):
 *
 *   Button   md 40 px high, sm 32 px, padding 16, label 14 medium, radius 8; "secondary" = white with a border
 *   Field    label 14 medium, 8 px gap, input 48 px high (padding 16 / 14), radius 8, hint 12 muted
 *   Badge    24 px high, label 12, soft background, text in the status colour
 *   Alert    soft background, no border, padding 16, radius 8, text 14
 *   Card     white, 1 px border, radius 16, padding 32 on a computer and 16 on a phone
 *
 * The colours come from the CSS variables of assets/css/main.css (the semantic variables of Figma, Light and Dark).
 * Used in vite.config.ts: `ui({ ui: theme })`.
 */
type Colour = 'primary' | 'success' | 'error' | 'warning'

/** Soft background and the readable text colour of a status, from the semantic variables of Figma */
const SOFT: Record<Colour, string> = {
  primary: 'bg-(--figma-primary-soft) text-(--figma-primary-text)',
  success: 'bg-(--figma-success-soft) text-(--figma-success-text)',
  error: 'bg-(--figma-danger-soft) text-(--figma-danger-text)',
  warning: 'bg-(--figma-warning-soft) text-(--figma-warning-text)',
}

const COLOURS = Object.keys(SOFT) as Colour[]

const INPUT_SIZE = 'px-4 py-3.5 text-small gap-2'

export const theme = {
  colors: { primary: 'indigo', neutral: 'slate' },

  button: {
    slots: { base: 'rounded-lg font-medium' },
    variants: {
      size: {
        sm: { base: 'px-4 py-1.5 text-small gap-2' },
        md: { base: 'px-4 py-2.5 text-small gap-2' },
      },
    },
    compoundVariants: [
      { color: 'primary', variant: 'solid', class: 'bg-(--figma-primary) text-(--figma-on-primary) hover:bg-(--figma-primary)/90' },
      { color: 'error', variant: 'solid', class: 'bg-(--figma-danger) text-white hover:bg-(--figma-danger)/90' },
      // "Secondary" of the design: a white button with a thin border
      { color: 'neutral', variant: 'outline', class: 'ring-default bg-default text-highlighted hover:bg-elevated' },
    ],
  },

  input: {
    slots: { base: 'rounded-lg' },
    variants: { size: { md: { base: INPUT_SIZE } } },
    compoundVariants: [{ variant: 'outline', class: 'ring-default' }],
  },
  select: {
    slots: { base: 'rounded-lg' },
    variants: { size: { md: { base: INPUT_SIZE } } },
    compoundVariants: [{ variant: 'outline', class: 'ring-default' }],
  },
  nativeSelect: {
    slots: { base: 'rounded-lg' },
    variants: { size: { md: { base: INPUT_SIZE } } },
    compoundVariants: [{ variant: 'outline', class: 'ring-default' }],
  },
  textarea: {
    slots: { base: 'rounded-lg' },
    variants: { size: { md: { base: INPUT_SIZE } } },
    compoundVariants: [{ variant: 'outline', class: 'ring-default' }],
  },

  formField: {
    slots: {
      label: 'text-small font-medium text-highlighted',
      container: 'mt-2',
      hint: 'text-caption text-muted',
      description: 'text-caption text-muted',
      help: 'mt-2 text-caption text-muted',
      error: 'mt-2 text-caption text-error',
    },
  },

  badge: {
    slots: { base: 'rounded-md font-normal' },
    compoundVariants: COLOURS.map(color => ({ color, variant: 'subtle', class: `${SOFT[color]} ring-0` })),
  },

  alert: {
    slots: { root: 'rounded-lg p-4', title: 'text-small font-normal' },
    compoundVariants: COLOURS.map(color => ({ color, variant: 'subtle', class: `${SOFT[color]} ring-0` })),
  },

  card: {
    slots: {
      root: 'rounded-2xl',
      header: 'p-4 pb-0 sm:p-4 md:p-8 md:pb-0',
      body: 'p-4 sm:p-4 md:p-8',
    },
    variants: { variant: { outline: { root: 'bg-default ring ring-default divide-y-0' } } },
  },
}
