// The Code tab's look: Big Puffin's charcoal and paper, with its orange as the accent. Every colour is one of brand/bigpuffin/bp.css, and __tests__/plugin.test.mjs holds it to that.
export const LOOK = {
  label: 'Big Puffin',
  roles: { accent: '#9A5A00' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#F1F3F5',
        'text-primary': '#0D1420',
        'text-secondary': '#5A6475',
        'text-muted': '#5A6475',
      },
    },
  },
  dark: {
    roles: { accent: '#F2A21E' },
    gray: {
      anchors: {
        'surface-0': '#0D1420',
        'surface-1': '#131C2B',
        'surface-2': '#131C2B',
        'surface-3': '#131C2B',
        'text-primary': '#F1F3F5',
        'text-secondary': '#8D98AB',
        'text-muted': '#8D98AB',
      },
    },
  },
}

export const HOME_TEXT = 'What is outstanding?'
