import { CellBuffer } from '@/render/CellBuffer'
import { serialize, escapeHtml } from '@/render/HtmlSerializer'

describe('escapeHtml', () => {
  it('escapes the text-context metacharacters', () => {
    expect(escapeHtml('a<b>&"c')).toBe('a&lt;b&gt;&amp;&quot;c')
  })
})

describe('serialize', () => {
  it('renders plain rows joined by newline', () => {
    const b = CellBuffer.create(3, 2).drawString(0, 0, 'abc').drawString(0, 1, 'xyz')
    expect(serialize(b)).toBe('abc\nxyz')
  })

  it('wraps a style region in a coloured span at the right columns', () => {
    const b = CellBuffer.create(5, 1)
      .drawString(0, 0, 'hello')
      .withStyle({ x: 1, y: 0, length: 3, color: '#ff0' })
    expect(serialize(b)).toBe('h<span style="color:#ff0">ell</span>o')
  })

  it('emits a data-action span for a hotspot', () => {
    const b = CellBuffer.create(4, 1)
      .drawString(0, 0, 'menu')
      .withHotspot({ x: 0, y: 0, width: 4, height: 1, action: 'open' })
    expect(serialize(b)).toBe('<span data-action="open">menu</span>')
  })

  it('escapes art so < and & render literally', () => {
    const b = CellBuffer.create(3, 1).drawString(0, 0, '<&>')
    expect(serialize(b)).toBe('&lt;&amp;&gt;')
  })

  it('splices multiple regions on one row without offset drift (right-to-left invariant)', () => {
    // Two adjacent styled ranges: [0,2) red, [2,4) blue. Right-to-left splicing must keep
    // both at their original columns.
    const b = CellBuffer.create(4, 1)
      .drawString(0, 0, 'abcd')
      .withStyle({ x: 0, y: 0, length: 2, color: 'red' })
      .withStyle({ x: 2, y: 0, length: 2, color: 'blue' })
    expect(serialize(b)).toBe(
      '<span style="color:red">ab</span><span style="color:blue">cd</span>',
    )
  })

  it('clamps an out-of-range region to the row width', () => {
    const b = CellBuffer.create(3, 1)
      .drawString(0, 0, 'xyz')
      .withStyle({ x: 1, y: 0, length: 99, color: '#000' })
    expect(serialize(b)).toBe('x<span style="color:#000">yz</span>')
  })

  it('renders a hotspot spanning multiple rows on each covered row', () => {
    const b = CellBuffer.create(2, 2)
      .drawString(0, 0, 'ab')
      .drawString(0, 1, 'cd')
      .withHotspot({ x: 0, y: 0, width: 2, height: 2, action: 'go' })
    expect(serialize(b)).toBe(
      '<span data-action="go">ab</span>\n<span data-action="go">cd</span>',
    )
  })

  it('supports a className style region', () => {
    const b = CellBuffer.create(3, 1)
      .drawString(0, 0, '☀☀☀')
      .withStyle({ x: 0, y: 0, length: 3, className: 'glow-sun' })
    expect(serialize(b)).toBe('<span class="glow-sun">☀☀☀</span>')
  })
})
