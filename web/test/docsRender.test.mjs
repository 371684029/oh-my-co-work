import assert from 'node:assert/strict'
import test from 'node:test'

// 4.0.0 文档中心渲染测试：XSS 转义、三类链接行为、路径识别（含反斜杠/空格/误判防护）。

const { createDocsMarkdown, findPathsInText } = await import(
  '../src/views/docs/markdownRenderer.js'
)

function render(text, opts = {}) {
  return createDocsMarkdown(opts).render(text)
}

test('raw HTML in markdown is escaped, never executable', () => {
  const out = render('<script>alert(1)</script>\n\n<img src=x onerror="alert(1)">')
  assert.equal(out.includes('<script>'), false)
  assert.equal(out.includes('<img'), false)
  assert.ok(out.includes('&lt;script&gt;'))

  const js = render('[点我](javascript:alert(1))')
  // markdown-it 拒绝 javascript: 方案：不产出可执行链接（保留纯文本即可）
  assert.equal(/<a [^>]*javascript:/i.test(js), false)
})

test('web links open in a new tab with noopener', () => {
  const out = render('[官网](https://example.com) 和 https://auto.link/x')
  assert.ok(out.includes('target="_blank"'))
  assert.ok(out.includes('rel="noopener noreferrer"'))
  assert.ok(out.includes('href="https://auto.link/x"'))
})

test('markdown links to other journal docs become in-app doc links', () => {
  const out = render('[报告](./ANNOUNCEMENT.md) 与 [台账](/journals/sessions/ses_x/nodes/step-01-a.md)')
  assert.ok(out.includes('data-docs-link'))
  assert.equal(out.includes('target="_blank"'), false)
})

test('windows paths with spaces and backslashes are linkified on raw text', () => {
  const out = render('输出在 C:\\work\\a b\\ 目录下。详见 D:\\项目\\报告。')
  assert.ok(out.includes('data-docs-path="C:\\work\\a b"'))
  assert.ok(out.includes('data-docs-path="D:\\项目\\报告"'))
  // 句尾说明文字不得被吞进路径属性
  assert.equal(out.includes('data-docs-path="C:\\work\\a b\\ 目录下'), false)
})

test('unc paths are linkified (post markdown escape: leading pair collapses)', () => {
  const out = render('共享：\\\\nas\\share\\docs 可看')
  assert.ok(out.includes('data-docs-path="\\nas\\share\\docs"'))
})

test('posix paths only linkified as standalone tokens, not mid-sentence', () => {
  const wholeLine = render('/home/user/project\n下一行')
  assert.ok(wholeLine.includes('data-docs-path="/home/user/project"'))

  const inline = render('查看 /var/log 与 /api/docs 接口')
  assert.equal(inline.includes('data-docs-path'), false)
})

test('known workFolder is linkified even inline', () => {
  const out = render('产物见 /home/user/project/out 目录', {
    workFolders: ['/home/user/project'],
  })
  assert.ok(out.includes('data-docs-path="/home/user/project"'))
  // 前缀路径也覆盖
  assert.ok(findPathsInText('产物在 /home/user/project/out 下', ['/home/user/project']).length > 0)
})

test('plain sentences are not mistaken for paths', () => {
  const plain = render('版本 3.7.4 很稳，性能提升 40% 了。一般句子。')
  assert.equal(plain.includes('data-docs-path'), false)
})

test('trailing punctuation is not part of the path', () => {
  const out = render('目录：C:\\tools\\x，然后别的。')
  assert.ok(out.includes('data-docs-path="C:\\tools\\x"'))
  assert.equal(out.includes('C:\\tools\\x，'), false)
})

test('paths inside existing markdown links are not double-linked', () => {
  const out = render('[前往 D:\\guide\\readme.md](https://example.com/guide)')
  // 外链保持外链行为；链接文本内的路径不再包一层
  assert.ok(out.includes('href="https://example.com/guide"'))
  assert.equal(out.includes('data-docs-path'), false)
})
