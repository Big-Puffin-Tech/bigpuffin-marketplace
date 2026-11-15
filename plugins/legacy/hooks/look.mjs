// The Code tab's look: Legacy's white and near-black, with its green as the accent. Every colour is one of legacy-v2/site/styles.css, and __tests__/plugin.test.mjs holds it to that.
export const LOOK = {
  label: 'Legacy',
  roles: { accent: '#0a7a43' },
  light: {
    gray: {
      anchors: {
        'surface-0': '#ffffff',
        'text-primary': '#0b0b0b',
        'text-secondary': '#56595a',
        'text-muted': '#56595a',
      },
    },
  },
  dark: {
    roles: { accent: '#5ef0a3' },
    gray: {
      anchors: {
        'surface-0': '#121212',
        'surface-1': '#1a1a1a',
        'surface-2': '#1a1a1a',
        'surface-3': '#1a1a1a',
        'text-primary': '#f2f2f0',
        'text-secondary': '#a8aaa9',
        'text-muted': '#a8aaa9',
      },
    },
  },
}

export const HOME_TEXT = 'What is outstanding?'
