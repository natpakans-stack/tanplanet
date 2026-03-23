import DefaultTheme from 'vitepress/theme'
import './custom.css'
import MascotFooter from './MascotFooter.vue'
import CustomHome from './CustomHome.vue'
import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
  Layout: CustomHome,
  enhanceApp({ app }) {
    app.component('MascotFooter', MascotFooter)
  }
} satisfies Theme
