/* Runs before React/CSS to prevent a flash of the wrong saved theme.
   Stores ONLY visual preference, never file content or detection data. */
(function () {
  var preference = 'dark'
  try {
    var saved = window.localStorage.getItem('shareshield-appearance')
    if (saved === 'light' || saved === 'dark' || saved === 'system') preference = saved
  } catch (_error) {
    // Private browsing may block storage. Dark mode remains a safe default.
  }
  var dark = false
  try {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches
  } catch (_error) { /* fallback to light */ }
  document.documentElement.dataset.preference = preference
  document.documentElement.dataset.theme = preference === 'system'
    ? (dark ? 'dark' : 'light') : preference
  document.documentElement.style.colorScheme = document.documentElement.dataset.theme
})()
