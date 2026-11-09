import type { Theme } from '@aws-amplify/ui-react'

/*
 * Amplify Authenticator theme mapped to the tokens in src/styles/tokens.css (FR8.3),
 * so the sign-in screen matches the rest of the app. Values reference the CSS custom
 * properties, which keeps one source of truth for the palette and typefaces.
 */
export const amplifyTheme: Theme = {
  name: 'hr-leave-portal',
  tokens: {
    colors: {
      brand: {
        primary: {
          10: { value: 'var(--color-primary-tint)' },
          20: { value: 'var(--color-primary-tint)' },
          40: { value: 'var(--color-primary)' },
          60: { value: 'var(--color-primary)' },
          80: { value: 'var(--color-primary)' },
          90: { value: 'var(--color-primary-dark)' },
          100: { value: 'var(--color-primary-dark)' },
        },
      },
      font: {
        primary: { value: 'var(--color-text)' },
        interactive: { value: 'var(--color-primary)' },
      },
      background: {
        primary: { value: 'var(--color-bg)' },
        secondary: { value: 'var(--color-surface)' },
      },
      border: {
        primary: { value: 'var(--color-border-strong)' },
        focus: { value: 'var(--color-primary)' },
      },
    },
    fonts: {
      default: {
        variable: { value: 'var(--font-body)' },
        static: { value: 'var(--font-body)' },
      },
    },
    radii: {
      xs: { value: 'var(--radius)' },
      small: { value: 'var(--radius)' },
      medium: { value: 'var(--radius)' },
      large: { value: 'var(--radius)' },
      xl: { value: 'var(--radius)' },
    },
    components: {
      authenticator: {
        router: {
          borderWidth: { value: '1px' },
          borderColor: { value: 'var(--color-border)' },
          boxShadow: { value: 'none' },
        },
      },
      button: {
        fontWeight: { value: '600' },
        primary: {
          backgroundColor: { value: 'var(--color-primary)' },
          _hover: { backgroundColor: { value: 'var(--color-primary-dark)' } },
          _focus: { backgroundColor: { value: 'var(--color-primary-dark)' } },
          _active: { backgroundColor: { value: 'var(--color-primary-dark)' } },
        },
        link: {
          color: { value: 'var(--color-primary)' },
          _hover: {
            color: { value: 'var(--color-primary-dark)' },
            backgroundColor: { value: 'transparent' },
          },
        },
      },
      tabs: {
        item: {
          color: { value: 'var(--color-text-muted)' },
          _active: {
            color: { value: 'var(--color-primary)' },
            borderColor: { value: 'var(--color-gold)' },
          },
        },
      },
    },
  },
}
