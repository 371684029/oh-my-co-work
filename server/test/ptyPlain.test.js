import assert from 'node:assert/strict'
import test from 'node:test'
import { renderPtyPlainText, furnaceGuiTranscript, furnaceGuiReadable, takeFurnaceAssistantDelta, buildFurnaceChatTurns } from '@acw/shared'

test('carriage return overwrites the same line', () => {
  assert.equal(renderPtyPlainText('hello\rworld', { cols: 40, rows: 10 }), 'world')
})

test('CSI EL clears the rest of the line before redraw', () => {
  const text = renderPtyPlainText('hello\u001b[1G\u001b[K你好', { cols: 40, rows: 10 })
  assert.equal(text, '你好')
})

test('colors do not leak into GUI text', () => {
  assert.equal(renderPtyPlainText('\u001b[32mhello\u001b[0m 世界', { cols: 40, rows: 10 }), 'hello 世界')
})

test('cursor home plus wipe does not concatenate TUI frames', () => {
  const raw = 'old frame ||||| leftover\u001b[H\u001b[2J新画面\n第二行'
  const text = renderPtyPlainText(raw, { cols: 40, rows: 10 })
  assert.equal(text.includes('old frame'), false)
  assert.equal(text.includes('|||||'), false)
  assert.match(text, /新画面/)
  assert.match(text, /第二行/)
})

test('GUI transcript drops TUI chrome and keeps the answer', () => {
  const raw = [
    '┌──────────────┐',
    '│ DeepSeek V4 Pro · always-approve',
    'Logged in with API key | Beta',
    'Enter:send  Alt+Enter:newline  Shift+Enter:newline',
    'Waiting for response... 0.0s',
    '你好，我是 Grok。',
    '可以帮你看代码。',
    '6',
    ':2 P',
  ].join('\n')
  const text = furnaceGuiTranscript(raw, { cols: 80, rows: 20 })
  assert.match(text, /你好，我是 Grok/)
  assert.match(text, /可以帮你看代码/)
  assert.equal(text.includes('Enter:send'), false)
  assert.equal(text.includes('always-approve'), false)
  assert.equal(text.includes('Waiting for response'), false)
  assert.equal(text.includes(':2 P'), false)
  assert.equal(text.includes('Shift+Enter'), false)
  assert.equal(furnaceGuiReadable(text), true)
})

test('chrome-only TUI is not treated as GUI body', () => {
  const raw = [
    '┌──────────────┐',
    '│ DeepSeek V4 Pro · always-approve',
    'Logged in with API key | Beta',
    'Enter:send  Alt+Enter:newline',
    'Waiting for response... 0.0s',
    'Grok',
    '6',
    ':2 P',
  ].join('\n')
  const text = furnaceGuiTranscript(raw, { cols: 80, rows: 20 })
  assert.equal(text.trim(), '')
  assert.equal(furnaceGuiReadable(text), false)
})

test('GUI transcript keeps earlier readable frames after wipe', () => {
  const raw =
    '第一轮回答：这里有足够长的中文内容。\u001b[H\u001b[2J第二轮回答：后面又写了一段中文。'
  const text = furnaceGuiTranscript(raw, { cols: 40, rows: 8 })
  assert.match(text, /第一轮回答/)
  assert.match(text, /第二轮回答/)
})

test('GUI transcript does not duplicate identical wipes', () => {
  const frame = '同一段足够长的中文回答内容。'
  const raw = `${frame}\u001b[H\u001b[2J${frame}\u001b[H\u001b[2J${frame}`
  const text = furnaceGuiTranscript(raw, { cols: 40, rows: 8 })
  assert.equal(text.split('同一段').length - 1, 1)
})

test('GUI last screen still drops chrome-only leftover frames', () => {
  const raw = `${'旧画面残留\n'.repeat(40)}\u001b[H\u001b[2J你好，这是当前屏。`
  const text = furnaceGuiTranscript(raw, { cols: 40, rows: 8 })
  assert.match(text, /当前屏/)
  assert.match(text, /旧画面残留/)
})

test('alternate screen still keeps earlier readable buffer in GUI history', () => {
  const raw = `主缓冲旧字也够长了。\u001b[?1049h\u001b[H\u001b[2J你好，备用屏上也有一段中文。`
  const text = furnaceGuiTranscript(raw, { cols: 40, rows: 8 })
  assert.match(text, /备用屏/)
  assert.match(text, /主缓冲旧字/)
})

test('assistant delta returns only the new tail', () => {
  const prev = '第一轮足够长的中文内容。'
  const curr = `${prev}\n第二轮足够长的中文内容。`
  assert.equal(takeFurnaceAssistantDelta(curr, prev), '第二轮足够长的中文内容。')
  assert.equal(takeFurnaceAssistantDelta(prev, prev), '')
})

test('chat turns split when user text appears in transcript', () => {
  const turns = buildFurnaceChatTurns('你好，我是 Grok。\n现在做到哪了？只看当前格。\n当前格在写文档。', [
    '现在做到哪了？只看当前格。',
  ])
  assert.equal(turns.length, 3)
  assert.equal(turns[0].role, 'assistant')
  assert.match(turns[0].text, /我是 Grok/)
  assert.equal(turns[1].role, 'user')
  assert.equal(turns[2].role, 'assistant')
  assert.match(turns[2].text, /写文档/)
})
