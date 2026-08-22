import '@mdi/font/css/materialdesignicons.css';
import 'vuetify/styles';
import { createVuetify } from 'vuetify';

export default createVuetify({
  icons: { defaultSet: 'mdi' },
  theme: {
    defaultTheme: 'light',
    themes: {
      light: {
        dark: false,
        colors: {
          primary: '#1867c0',
          secondary: '#5cbbf6',
          success: '#4caf50',
          info: '#2196f3',
          warning: '#fb8c00',
          error: '#ff5252',
          indigo: '#3f51b5',
          teal: '#009688',
        },
      },
    },
  },
});
