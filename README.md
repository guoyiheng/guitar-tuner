# 🎸 吉他调音器 Guitar Tuner

一个基于 Vue3 和 Web Audio API 的现代化吉他调音器应用。

[![Vue 3](https://img.shields.io/badge/Vue-3-42b883)](https://vuejs.org/)
[![Vite](https://img.shields.io/badge/Vite-6-646cff)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6)](https://www.typescriptlang.org/)

## ✨ 特性

- 🎯 **实时音高检测** - 使用自相关算法精准检测吉他音高
- 🎨 **简洁美观的界面** - 现代化设计，渐变背景，视觉舒适
- 📊 **可视化指针指示器** - 直观显示音准偏差
- 🎵 **标准调音参考** - 显示六根弦的标准频率
- 📱 **响应式设计** - 完美支持手机和桌面设备
- ⚡ **快速准确** - 实时音频分析，延迟低
- 🔊 **音量指示** - 可视化显示当前音量

## 🎮 功能

### 核心功能
- 实时音频捕获和频率分析
- 自动检测最接近的吉他弦
- 显示音高偏差（cents）
- 指针式调音指示器
- 标准六弦调音参考（E A D G B E）

### 技术亮点
- 基于 Web Audio API 的音频处理
- 自相关算法进行音高检测
- Vue 3 Composition API
- TypeScript 类型安全
- UnoCSS 原子化 CSS
- 自动导入组件和 API

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建生产版本

```bash
npm run build
```

### 预览生产构建

```bash
npm run preview
```

## 📖 使用说明

1. 打开应用后，点击"开始调音"按钮
2. 允许浏览器访问麦克风
3. 将麦克风靠近吉他音孔
4. 拨动琴弦，观察指针和音准指示
5. 根据显示调整琴弦松紧，直到指针居中且显示"音准完美"

## 🛠 技术栈

- **框架**: Vue 3 + TypeScript
- **构建工具**: Vite 6
- **路由**: Vue Router
- **状态管理**: Composition API
- **样式**: UnoCSS
- **音频处理**: Web Audio API
- **工具库**: @vueuse/core

## 📁 项目结构

```
src/
├── components/          # 组件目录
│   └── GuitarTuner.vue # 主调音器组件
├── composables/        # 组合式函数
│   └── usePitchDetection.ts  # 音高检测逻辑
├── pages/              # 页面路由
│   └── index.vue       # 首页
└── main.ts            # 应用入口
```

## 🎯 调音参考

| 弦序 | 音符 | 频率 (Hz) |
| ---- | ---- | --------- |
| 6    | E2   | 82.41     |
| 5    | A2   | 110.00    |
| 4    | D3   | 146.83    |
| 3    | G3   | 196.00    |
| 2    | B3   | 246.94    |
| 1    | E4   | 329.63    |

## 🌟 特色

1. **界面简单好看** - 使用渐变背景和毛玻璃效果，视觉舒适
2. **功能独特好用** - 实时音高检测，指针式指示器，操作直观
3. **拓展性强** - 基于 vitesse-lite 模板，易于添加新功能

## 📝 浏览器兼容性

需要支持以下 API 的现代浏览器：
- Web Audio API
- MediaDevices API (getUserMedia)
- ES2020+

推荐使用：
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 📄 许可证

MIT License

## 🙏 致谢

- 基于 [Vitesse Lite](https://github.com/antfu-collective/vitesse-lite) 模板
- 音高检测算法参考了多个开源实现

---

Made with ❤️ and Vue 3


## Pre-packed

### UI Frameworks

- [UnoCSS](https://github.com/antfu/unocss) - The instant on-demand atomic CSS engine.

### Icons

- [Iconify](https://iconify.design) - use icons from any icon sets [🔍Icônes](https://icones.netlify.app/)
- [Pure CSS Icons via UnoCSS](https://github.com/antfu/unocss/tree/main/packages/preset-icons)

### Plugins

- [Vue Router](https://github.com/vuejs/vue-router)
  - [`unplugin-vue-router`](https://github.com/posva/unplugin-vue-router) - file system based routing
- [`unplugin-auto-import`](https://github.com/antfu/unplugin-auto-import) - Directly use Vue Composition API and others without importing
- [`unplugin-vue-components`](https://github.com/antfu/unplugin-vue-components) - components auto import
- [`unplugin-vue-macros`](https://github.com/sxzz/unplugin-vue-macros) - Explore and extend more macros and syntax sugar to Vue.
- [VueUse](https://github.com/antfu/vueuse) - collection of useful composition APIs

## Try it now!

### GitHub Template

[Create a repo from this template on GitHub](https://github.com/antfu-collective/vitesse-lite/generate).

### Clone to local

If you prefer to do it manually with the cleaner git history

```bash
npx degit antfu-collective/vitesse-lite my-vitesse-app
cd my-vitesse-app
pnpm i # If you don't have pnpm installed, run: npm install -g pnpm
```
