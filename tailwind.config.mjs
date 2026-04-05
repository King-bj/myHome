/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      typography: (theme) => ({
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: theme('colors.gray.700'),
            lineHeight: '1.75',
            fontSize: '1rem',
            a: {
              color: theme('colors.primary.500'),
              '&:hover': {
                color: theme('colors.primary.600'),
              },
              textDecoration: 'underline',
              textDecorationColor: theme('colors.primary.200'),
              textUnderlineOffset: '2px',
            },
            'a:hover': {
              textDecorationColor: theme('colors.primary.500'),
            },
            h1: {
              fontWeight: '700',
              color: theme('colors.gray.900'),
            },
            h2: {
              fontWeight: '600',
              color: theme('colors.gray.900'),
              marginTop: '2.5rem',
              marginBottom: '1rem',
            },
            h3: {
              fontWeight: '600',
              color: theme('colors.gray.900'),
              marginTop: '2rem',
            },
            h4: {
              fontWeight: '600',
              color: theme('colors.gray.800'),
            },
            code: {
              backgroundColor: theme('colors.gray.100'),
              padding: '0.25rem 0.5rem',
              borderRadius: '0.375rem',
              fontWeight: '400',
              fontSize: '0.875em',
              border: `1px solid ${theme('colors.gray.200')}`,
            },
            'code::before': {
              content: '""',
            },
            'code::after': {
              content: '""',
            },
            pre: {
              backgroundColor: theme('colors.gray.900'),
              borderRadius: '0.5rem',
              padding: '1rem',
            },
            'pre code': {
              backgroundColor: 'transparent',
              padding: '0',
              border: 'none',
            },
            blockquote: {
              fontWeight: '400',
              fontStyle: 'normal',
              borderLeftWidth: '4px',
              paddingLeft: '1rem',
              color: theme('colors.gray.600'),
            },
            ul: {
              listStyleType: 'disc',
            },
            ol: {
              listStyleType: 'decimal',
            },
            'li::marker': {
              color: theme('colors.gray.400'),
            },
            hr: {
              borderColor: theme('colors.gray.200'),
            },
            table: {
              fontSize: '0.875rem',
            },
            th: {
              fontWeight: '600',
            },
          },
        },
        dark: {
          css: {
            color: theme('colors.gray.300'),
            a: {
              color: theme('colors.primary.400'),
              '&:hover': {
                color: theme('colors.primary.300'),
              },
              textDecorationColor: theme('colors.primary.700'),
            },
            'a:hover': {
              textDecorationColor: theme('colors.primary.400'),
            },
            h1: {
              color: theme('colors.gray.100'),
            },
            h2: {
              color: theme('colors.gray.100'),
              borderColor: theme('colors.gray.700'),
            },
            h3: {
              color: theme('colors.gray.100'),
            },
            h4: {
              color: theme('colors.gray.200'),
            },
            code: {
              backgroundColor: theme('colors.gray.800'),
              borderColor: theme('colors.gray.700'),
              color: theme('colors.gray.200'),
            },
            pre: {
              backgroundColor: theme('colors.gray.900'),
              borderColor: theme('colors.gray.700'),
            },
            blockquote: {
              color: theme('colors.gray.400'),
              borderLeftColor: theme('colors.primary.500'),
            },
            'li::marker': {
              color: theme('colors.gray.500'),
            },
            hr: {
              borderColor: theme('colors.gray.700'),
            },
            th: {
              backgroundColor: theme('colors.gray.800'),
              color: theme('colors.gray.100'),
            },
            td: {
              borderColor: theme('colors.gray.700'),
            },
          },
        },
      }),
    },
  },
  plugins: [require('@tailwindcss/typography')],
};
