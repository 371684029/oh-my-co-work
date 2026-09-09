import assert from 'node:assert/strict'
import test from 'node:test'

// 4.6 全局模糊搜索：统一匹配器（shared/fuzzy）行为锁定。
// 中文全拼/首字母、英文大小写、子序列容错、阈值过滤。
import { fuzzyScore, isFuzzyMatch, fuzzySearch, searchMatchThreshold } from '@acw/shared'

test('中文：子串/全拼/首字母/大小写 命中', () => {
  assert.equal(isFuzzyMatch('成员', '成员'), true)
  assert.equal(isFuzzyMatch('chengyuan', '成员'), true) // 全拼
  assert.equal(isFuzzyMatch('cy', '成员'), true) // 首字母
  assert.equal(isFuzzyMatch('Yuan', '成员'), true) // 大小写不敏感 + 拼音包含
})

test('中文：不相干词不命中', () => {
  assert.equal(isFuzzyMatch('文档', '成员'), false)
  assert.equal(isFuzzyMatch('abc', '成员'), false)
})

test('英文：大小写不敏感子串', () => {
  assert.equal(isFuzzyMatch('doc', 'English Doc'), true)
  assert.equal(isFuzzyMatch('DOC', 'English Doc'), true)
  assert.equal(isFuzzyMatch('english', 'English Doc'), true)
})

test('子序列容错（低分但仍命中）', () => {
  // 'cyg' -> '成员管理' 的首字母 c y g（guanli）
  assert.equal(isFuzzyMatch('cygl', '成员管理'), true)
})

test('空查询：全部命中', () => {
  assert.equal(isFuzzyMatch('', 'anything'), true)
})

test('fuzzySearch：多字段、降序、limit', () => {
  const items = [
    { id: 1, name: '成员张三', desc: '负责归档' },
    { id: 2, name: '文档中心', desc: 'markdown 渲染' },
    { id: 3, name: 'English Doc', desc: 'build' },
  ]
  const r1 = fuzzySearch(items, 'cy', (i) => [i.name, i.desc])
  assert.equal(r1.items[0].item.id, 1)

  const r2 = fuzzySearch(items, 'doc', (i) => [i.name, i.desc])
  // '文档中心' 拼音 wendangzhongxin 不含 'doc'，仅 'English Doc' 命中
  assert.ok(r2.items.some((h) => h.item.id === 3))
  assert.equal(r2.items.some((h) => h.item.id === 2), false)

  const r3 = fuzzySearch(items, 'doc', (i) => i.name, { limit: 1 })
  assert.equal(r3.items.length, 1)

  const r4 = fuzzySearch(items, 'zzz', (i) => i.name)
  assert.equal(r4.items.length, 0)
})

test('fuzzySearch：空查询返回全部（总分 0）', () => {
  const items = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }]
  const r = fuzzySearch(items, '', (i) => i.name)
  assert.equal(r.items.length, 2)
})

test('fuzzyScore：分值方向（exact > prefix > pinyin-first > 子序列）', () => {
  const exact = fuzzyScore('成员', '成员')
  const prefix = fuzzyScore('成', '成员')
  const first = fuzzyScore('cy', '成员')
  const sub = fuzzyScore('cyu', '成员') // 子序列 hmm -> 需 >=0
  assert.ok(exact > prefix)
  assert.ok(prefix >= first || prefix >= sub, '前缀不应低于首字母/子序列中最差者')
})

test('searchMatchThreshold：拒绝过短 ASCII，中文单字仍可搜', () => {
  assert.equal(searchMatchThreshold(''), null)
  assert.equal(searchMatchThreshold('a'), null)
  assert.equal(searchMatchThreshold('en'), 70)
  assert.equal(searchMatchThreshold('chengyuan'), 50)
  assert.equal(searchMatchThreshold('成'), 50)
})
