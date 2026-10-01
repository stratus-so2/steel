/**
 * Aplica o tema salvo (cookie `steel.theme`) antes da primeira pintura, para
 * não piscar claro/escuro. Fica em /public, e não inline no layout, porque a
 * casca do HTML é pré-renderizada (Cache Components) e um script inline ali
 * não recebe o nonce da CSP — seria bloqueado. Como arquivo de mesma origem,
 * entra pelo `script-src 'self'`.
 */
(function () {
  try {
    var m = document.cookie.match(/(?:^|; )steel\.theme=([^;]+)/)
    var t = m ? decodeURIComponent(m[1]) : 'SYSTEM'
    var dark =
      t === 'DARK' ||
      (t === 'SYSTEM' && matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
  } catch (e) {}
})()
