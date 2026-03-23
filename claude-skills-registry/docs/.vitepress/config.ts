import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'Skills Registry',
  description: 'รวมทุก Skill, Plugin, MCP Server ที่ติดตั้งไว้ใน Claude Code',
  lang: 'th',
  head: [
    ['link', { rel: 'icon', type: 'image/png', href: 'https://framerusercontent.com/images/c0z2TLP8Vruh4UchIrSxQOCMIk.png?width=64&height=64' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { href: 'https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Thai:wght@300;400;500;600;700&display=swap', rel: 'stylesheet' }],
  ],
  themeConfig: {
    logo: 'https://framerusercontent.com/images/c0z2TLP8Vruh4UchIrSxQOCMIk.png?width=64&height=64',
    search: {
      provider: 'local',
      options: {
        translations: {
          button: { buttonText: 'ค้นหา', buttonAriaLabel: 'ค้นหา' },
          modal: {
            noResultsText: 'ไม่พบผลลัพธ์',
            resetButtonTitle: 'ล้างการค้นหา',
            footer: { selectText: 'เลือก', navigateText: 'เลื่อน', closeText: 'ปิด' }
          }
        }
      }
    },
    nav: [
      { text: 'หน้าแรก', link: '/' },
      { text: 'All Projects', link: 'https://projects.tanplanet.info/' }
    ],
    sidebar: [
      {
        text: '🔌 Plugins',
        collapsed: false,
        items: [
          { text: 'ออกแบบ & หน้าบ้าน', link: '/plugin/design-frontend' },
          { text: 'พัฒนา & ตรวจโค้ด', link: '/plugin/dev-review' },
          { text: 'สร้าง Plugin & Skill', link: '/plugin/plugin-skill' },
          { text: 'ตั้งค่า & จัดการ', link: '/plugin/setup' },
          { text: 'เครื่องมือทั่วไป', link: '/plugin/general' },
        ]
      },
      {
        text: '🔗 MCP Servers',
        collapsed: false,
        items: [
          { text: 'เชื่อมต่อแชทกับทีม', link: '/mcp/chat' },
          { text: 'เชื่อมต่อเครื่องมือ Dev', link: '/mcp/dev-tools' },
          { text: 'จัดการโปรเจกต์ & Ticket', link: '/mcp/project-management' },
          { text: 'Backend & ฐานข้อมูล', link: '/mcp/backend-db' },
          { text: 'ดีไซน์ & อื่น ๆ', link: '/mcp/design-others' },
          { text: 'Built-in (claude.ai)', link: '/mcp/builtin' },
        ]
      },
      {
        text: '🎨 Custom Skills',
        collapsed: false,
        items: [
          { text: 'ดีไซน์ & QA', link: '/custom/design-qa' },
          { text: 'อื่น ๆ & Vercel', link: '/custom/others-vercel' },
        ]
      },
      {
        text: '🤖 BMAD',
        collapsed: false,
        items: [
          { text: 'ทีม AI จำลอง', link: '/bmad/team' },
          { text: 'ขั้นตอนทำงาน', link: '/bmad/workflows' },
          { text: 'ตรวจสอบ & เครื่องมือเสริม', link: '/bmad/validation-tools' },
        ]
      },
      {
        text: '💻 LSP',
        items: [
          { text: 'ตัวช่วยภาษาโปรแกรม', link: '/lsp/' },
        ]
      },
      {
        text: '📚 Reference',
        items: [
          { text: 'เอกสารอ้างอิง', link: '/reference/' },
        ]
      },
      {
        text: '🛠️ Tools',
        items: [
          { text: 'เครื่องมือที่ใช้ทำงาน', link: '/tool/' },
        ]
      },
    ],
    socialLinks: [
      { icon: 'github', link: 'https://github.com/natpakans-stack' }
    ],
    outline: {
      level: [2, 3],
      label: 'ในหน้านี้'
    },
    docFooter: {
      prev: 'ก่อนหน้า',
      next: 'ถัดไป'
    },
    darkModeSwitchLabel: 'ธีม',
    sidebarMenuLabel: 'เมนู',
    returnToTopLabel: 'กลับด้านบน',
  }
})
