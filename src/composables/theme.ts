// 主题通过 CSS 变量在 main.css 中管理
// 当 isDark 改变时，html.dark 类会自动应用相应的 CSS 变量
export function useTheme() {
  // 这个 composable 保留作为未来扩展的接口
  // 目前主题切换通过 useDark 自动处理
}
