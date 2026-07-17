/**
 * Inline script to prevent flash of wrong theme on load.
 * Runs before React hydrates; reads theme from localStorage and applies dark class immediately.
 */
export default function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `
(function() {
  var theme = localStorage.getItem('marketing-hub-theme');
  var isDark = theme === 'dark' || (theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  if (isDark) document.documentElement.classList.add('dark');
  else document.documentElement.classList.remove('dark');
})();
`,
      }}
    />
  )
}
