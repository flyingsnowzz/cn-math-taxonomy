import qrcode from 'qrcode-generator'
import type { PublicRemedyReport } from '@/engine/report'
import type { EngineChapterSummary, EngineSummary } from '@/engine/engineAdapter'
import { getSubject } from '@/data/subjectRegistry'
import type { SubjectCode } from '@/data/types'

export interface ShareCardModel {
  subject: SubjectCode
  scope: string
  summary: EngineSummary
  chapters?: EngineChapterSummary[]
  nameOf: (id: string) => string
  url?: string
}

const WIDTH = 1080
const HEIGHT = 1920
const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif'

function font(weight: number, size: number): string {
  return `${weight} ${size}px ${FONT}`
}

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, width / 2, height / 2))
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

function fillRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  color: string,
): void {
  ctx.fillStyle = color
  roundedRect(ctx, x, y, width, height, radius)
  ctx.fill()
}

function strokeRounded(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  roundedRect(ctx, x, y, width, height, radius)
  ctx.stroke()
}

function ellipsis(ctx: CanvasRenderingContext2D, value: string, maxWidth: number): string {
  const chars = Array.from(value)
  if (ctx.measureText(value).width <= maxWidth) return value
  let result = ''
  for (const char of chars) {
    const next = `${result}${char}…`
    if (ctx.measureText(next).width > maxWidth) return `${result}…`
    result += char
  }
  return `${result}…`
}

function wrapText(ctx: CanvasRenderingContext2D, value: string, maxWidth: number, maxLines: number): string[] {
  const chars = Array.from(value)
  const lines: string[] = []
  let current = ''
  for (const char of chars) {
    const next = current + char
    if (current && ctx.measureText(next).width > maxWidth) {
      lines.push(current)
      current = char
      if (lines.length === maxLines) return lines
    } else {
      current = next
    }
  }
  if (current && lines.length < maxLines) lines.push(current)
  return lines
}

function text(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number,
  y: number,
  weight: number,
  size: number,
  color: string,
  maxWidth?: number,
): void {
  ctx.fillStyle = color
  ctx.font = font(weight, size)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText(maxWidth ? ellipsis(ctx, value, maxWidth) : value, x, y)
}

function drawQr(ctx: CanvasRenderingContext2D, value: string, size: number): void {
  const qr = qrcode(0, 'M')
  qr.addData(value)
  qr.make()
  qr.renderTo2dContext(ctx, size / qr.getModuleCount())
}

function drawLogo(ctx: CanvasRenderingContext2D, x: number, y: number, size: number): void {
  fillRounded(ctx, x, y, size, size, 20, '#ffffff')
  ctx.strokeStyle = '#0f766e'
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.beginPath()
  ctx.moveTo(x + 24, y + 54)
  ctx.lineTo(x + 40, y + 32)
  ctx.lineTo(x + 60, y + 48)
  ctx.stroke()
  ctx.fillStyle = '#0f766e'
  for (const point of [[28, 58], [40, 28], [62, 52]] as const) {
    ctx.beginPath()
    ctx.arc(x + point[0], y + point[1], 7, 0, Math.PI * 2)
    ctx.fill()
  }
}

export function createShareCanvas(model: ShareCardModel): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas，无法生成分享图')

  const summary = model.summary
  const subject = getSubject(model.subject)
  const url = model.url ?? window.location.origin

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  bg.addColorStop(0, '#e7f4f2')
  bg.addColorStop(0.48, '#f5f8fc')
  bg.addColorStop(1, '#e7eef6')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.fillStyle = '#0f766e'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(WIDTH, 0)
  ctx.lineTo(WIDTH, 450)
  ctx.quadraticCurveTo(WIDTH, 492, WIDTH - 42, 492)
  ctx.lineTo(42, 492)
  ctx.quadraticCurveTo(0, 492, 0, 450)
  ctx.closePath()
  ctx.fill()

  drawLogo(ctx, 60, 54, 86)
  text(ctx, '中小学知识图谱', 168, 64, 800, 40, '#ffffff', 760)
  text(ctx, `${subject.label}自适应诊断结果`, 168, 116, 500, 26, 'rgba(255,255,255,0.88)', 760)

  ctx.fillStyle = '#ffffff'
  ctx.font = font(800, 54)
  const titleLines = wrapText(ctx, model.scope.trim(), 940, 2)
  titleLines.forEach((line, index) => ctx.fillText(line, 64, 202 + index * 68))
  text(ctx, `生成日期 ${new Date().toLocaleDateString('zh-CN')}`, 64, 356, 500, 27, 'rgba(255,255,255,0.9)')

  const cardX = 48
  const cardW = WIDTH - 96
  const statsY = 430
  ctx.save()
  ctx.shadowColor = 'rgba(22,40,70,.12)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 10
  fillRounded(ctx, cardX, statsY, cardW, 210, 28, '#ffffff')
  ctx.restore()

  const stats = [
    { value: summary.mastered.length, label: '已掌握', color: '#157a3a', bg: '#dcfce7' },
    { value: summary.shaky.length, label: '不稳', color: '#b45309', bg: '#fef3c7' },
    { value: summary.weak.length, label: '薄弱', color: '#b91c1c', bg: '#fee2e2' },
    { value: summary.untested.length, label: '未测', color: '#475569', bg: '#e8eef6' },
  ]
  const gap = 16
  const chipW = (cardW - 40 - gap * 3) / 4
  stats.forEach((item, index) => {
    const x = cardX + 20 + index * (chipW + gap)
    const y = statsY + 22
    fillRounded(ctx, x, y, chipW, 166, 18, item.bg)
    ctx.fillStyle = item.color
    ctx.font = font(800, 58)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.fillText(String(item.value), x + chipW / 2, y + 30)
    ctx.font = font(700, 26)
    ctx.fillText(item.label, x + chipW / 2, y + 108)
  })
  ctx.textAlign = 'left'

  let y = 692
  const screenSpots = model.chapters
    ?.filter((chapter) => chapter.weak > 0 || chapter.shaky > 0)
    .slice(0, 3)
    .map((chapter) => ({
      title: chapter.label,
      detail: `薄弱 ${chapter.weak} · 不稳 ${chapter.shaky} · 未测 ${chapter.untested}`,
    })) ?? []
  const weakSpots = screenSpots.length > 0
    ? screenSpots
    : summary.roots
      .slice(0, 3)
      .map((root) => ({ title: model.nameOf(root.id), detail: '需要优先回到前置知识进行巩固' }))
  text(ctx, '最需要关注的知识点', 64, y, 800, 34, '#162033')
  y += 52
  if (weakSpots.length === 0) {
    ctx.strokeStyle = '#d5e0eb'
    ctx.lineWidth = 2
    strokeRounded(ctx, cardX, y, cardW, 92, 18)
    text(ctx, '本次没有发现明显薄弱知识点。', 80, y + 30, 500, 28, '#5c6d82')
    y += 108
  } else {
    weakSpots.forEach((spot, index) => {
      ctx.strokeStyle = '#d5e0eb'
      ctx.lineWidth = 2
      strokeRounded(ctx, cardX, y, cardW, 112, 18)
      ctx.fillStyle = '#0f766e'
      ctx.beginPath()
      ctx.arc(cardX + 48, y + 56, 22, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.font = font(800, 24)
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(String(index + 1), cardX + 48, y + 58)
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      text(ctx, spot.title, cardX + 88, y + 24, 700, 30, '#162033', cardW - 130)
      text(ctx, spot.detail, cardX + 88, y + 64, 500, 23, '#5c6d82', cardW - 130)
      y += 126
    })
  }

  y += 8
  text(ctx, '最该先补的根因', 64, y, 800, 34, '#162033')
  y += 52
  const roots = summary.roots.slice(0, 2)
  if (roots.length === 0) {
    ctx.strokeStyle = '#d5e0eb'
    ctx.lineWidth = 2
    strokeRounded(ctx, cardX, y, cardW, 92, 18)
    text(ctx, '没有判出需要优先补学的根因。', 80, y + 30, 500, 28, '#5c6d82')
  } else {
    roots.forEach((root) => {
      ctx.strokeStyle = '#d5e0eb'
      ctx.lineWidth = 2
      strokeRounded(ctx, cardX, y, cardW, 96, 18)
      fillRounded(ctx, cardX + 24, y + 24, 8, 48, 4, '#b91c1c')
      text(ctx, model.nameOf(root.id), cardX + 52, y + 28, 700, 30, '#162033', cardW - 90)
      y += 110
    })
  }

  ctx.fillStyle = '#e7f3f1'
  ctx.fillRect(0, 1504, WIDTH, HEIGHT - 1504)
  ctx.fillStyle = '#d5e0eb'
  ctx.fillRect(0, 1504, WIDTH, 2)

  const qrSize = 292
  const qrX = 72
  const qrY = 1540
  ctx.save()
  ctx.shadowColor = 'rgba(22,40,70,.08)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 6
  fillRounded(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 20, '#ffffff')
  ctx.restore()

  const qrCanvas = document.createElement('canvas')
  qrCanvas.width = qrSize
  qrCanvas.height = qrSize
  const qrContext = qrCanvas.getContext('2d')
  if (qrContext) {
    qrContext.fillStyle = '#ffffff'
    qrContext.fillRect(0, 0, qrSize, qrSize)
    drawQr(qrContext, url, qrSize)
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)
  }

  ctx.fillStyle = '#0f766e'
  ctx.font = font(800, 46)
  ctx.textBaseline = 'middle'
  ctx.fillText('扫码打开知识图谱', qrX + qrSize + 48, qrY + 118)
  ctx.fillStyle = '#5c6d82'
  ctx.font = font(500, 24)
  ctx.fillText(subject.label, qrX + qrSize + 48, qrY + 166)

  return canvas
}

export function downloadShareCard(model: ShareCardModel): void {
  const canvas = createShareCanvas(model)
  const link = document.createElement('a')
  link.download = `knowledge-diagnosis-${model.subject}-${new Date().toISOString().slice(0, 10)}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}

export interface RemedyCardModel {
  report: PublicRemedyReport
  url: string
}

export function createRemedyCanvas(model: RemedyCardModel): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = WIDTH
  canvas.height = HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('当前浏览器不支持 Canvas，无法生成分享图')

  const { report, url } = model
  const subject = getSubject(report.subject)

  const bg = ctx.createLinearGradient(0, 0, 0, HEIGHT)
  bg.addColorStop(0, '#e7f4f2')
  bg.addColorStop(0.5, '#f5f8fc')
  bg.addColorStop(1, '#e7eef6')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, WIDTH, HEIGHT)

  ctx.fillStyle = '#0f766e'
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(WIDTH, 0)
  ctx.lineTo(WIDTH, 420)
  ctx.quadraticCurveTo(WIDTH, 462, WIDTH - 42, 462)
  ctx.lineTo(42, 462)
  ctx.quadraticCurveTo(0, 462, 0, 420)
  ctx.closePath()
  ctx.fill()

  drawLogo(ctx, 60, 54, 86)
  text(ctx, '中小学知识图谱', 168, 64, 800, 40, '#ffffff', 760)
  text(ctx, `${subject.label}查漏补缺报告`, 168, 116, 500, 26, 'rgba(255,255,255,0.88)', 760)

  ctx.fillStyle = '#ffffff'
  ctx.font = font(800, 48)
  wrapText(ctx, report.targetLabel.trim() || '自适应补救', 940, 2).forEach((line, index) => {
    ctx.fillText(line, 64, 196 + index * 62)
  })
  text(ctx, report.generatedAt, 64, 336, 500, 26, 'rgba(255,255,255,0.9)')

  const cardX = 48
  const cardW = WIDTH - 96

  // 大数字：已补上
  ctx.save()
  ctx.shadowColor = 'rgba(22,40,70,.12)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 10
  fillRounded(ctx, cardX, 410, cardW, 240, 28, '#ffffff')
  ctx.restore()
  ctx.fillStyle = '#157a3a'
  ctx.font = font(800, 110)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(String(report.totals.mastered), cardX + cardW / 2, 442)
  ctx.fillStyle = '#162033'
  ctx.font = font(700, 30)
  const doneLabel = report.totals.mastered > 0 ? '个薄弱点已经复测通过、补上来了' : '个薄弱点已补上'
  ctx.fillText(doneLabel, cardX + cardW / 2, 575)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'

  // 三个小指标
  const mini = [
    { value: report.totals.remaining, label: '还在补', color: '#b45309', bg: '#fef3c7' },
    { value: report.totals.questionsDone, label: '已练习题', color: '#0f766e', bg: '#ccfbf1' },
    { value: report.totals.rootsMastered, label: '根因已补', color: '#157a3a', bg: '#dcfce7' },
  ]
  const gap = 16
  const chipW = (cardW - 40 - gap * 2) / 3
  mini.forEach((item, index) => {
    const x = cardX + 20 + index * (chipW + gap)
    fillRounded(ctx, x, 680, chipW, 170, 18, item.bg)
    ctx.fillStyle = item.color
    ctx.font = font(800, 56)
    ctx.textAlign = 'center'
    ctx.fillText(String(item.value), x + chipW / 2, 706)
    ctx.font = font(700, 25)
    ctx.fillText(item.label, x + chipW / 2, 788)
  })
  ctx.textAlign = 'left'

  // 明细列表
  let y = 900
  text(ctx, '补救路径', 64, y, 800, 34, '#162033')
  y += 52
  const items = report.path.slice(0, 6)
  if (items.length === 0) {
    ctx.strokeStyle = '#d5e0eb'
    ctx.lineWidth = 2
    strokeRounded(ctx, cardX, y, cardW, 92, 18)
    text(ctx, '还没有补救记录，先做一次诊断。', 80, y + 30, 500, 28, '#5c6d82')
    y += 108
  } else {
    items.forEach((item) => {
      ctx.strokeStyle = '#d5e0eb'
      ctx.lineWidth = 2
      strokeRounded(ctx, cardX, y, cardW, 104, 18)
      if (item.mastered) {
        ctx.fillStyle = '#157a3a'
        ctx.beginPath()
        ctx.arc(cardX + 48, y + 52, 22, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#ffffff'
        ctx.font = font(800, 26)
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('✓', cardX + 48, y + 54)
      } else {
        ctx.fillStyle = item.kind === 'weak' ? '#b91c1c' : '#b45309'
        ctx.beginPath()
        ctx.arc(cardX + 48, y + 52, 22, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      text(ctx, item.name, cardX + 88, y + 20, 700, 29, '#162033', cardW - 130)
      text(
        ctx,
        item.mastered ? '已补上 · 复测通过' : item.kind === 'weak' ? '薄弱 · 待补救' : '不稳 · 待巩固',
        cardX + 88,
        y + 60,
        500,
        22,
        item.mastered ? '#157a3a' : '#5c6d82',
        cardW - 130,
      )
      y += 118
    })
    if (report.path.length > items.length) {
      text(ctx, `另有 ${report.path.length - items.length} 个知识点，打开查看全部`, 64, y, 500, 24, '#5c6d82')
    }
  }

  // 底部二维码
  ctx.fillStyle = '#e7f3f1'
  ctx.fillRect(0, 1504, WIDTH, HEIGHT - 1504)
  ctx.fillStyle = '#d5e0eb'
  ctx.fillRect(0, 1504, WIDTH, 2)
  const qrSize = 292
  const qrX = 72
  const qrY = 1540
  ctx.save()
  ctx.shadowColor = 'rgba(22,40,70,.08)'
  ctx.shadowBlur = 18
  ctx.shadowOffsetY = 6
  fillRounded(ctx, qrX - 16, qrY - 16, qrSize + 32, qrSize + 32, 20, '#ffffff')
  ctx.restore()
  const qrCanvas = document.createElement('canvas')
  qrCanvas.width = qrSize
  qrCanvas.height = qrSize
  const qrContext = qrCanvas.getContext('2d')
  if (qrContext) {
    qrContext.fillStyle = '#ffffff'
    qrContext.fillRect(0, 0, qrSize, qrSize)
    drawQr(qrContext, url, qrSize)
    ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize)
  }
  ctx.fillStyle = '#0f766e'
  ctx.font = font(800, 42)
  ctx.textBaseline = 'middle'
  ctx.fillText('扫码测一测你家孩子', qrX + qrSize + 48, qrY + 108)
  ctx.fillStyle = '#5c6d82'
  ctx.font = font(500, 24)
  ctx.fillText('找到真正没学会的那一步', qrX + qrSize + 48, qrY + 158)

  return canvas
}

export function downloadRemedyCard(model: RemedyCardModel): void {
  const canvas = createRemedyCanvas(model)
  const link = document.createElement('a')
  link.download = `remedy-report-${model.report.subject}-${new Date().toISOString().slice(0, 10)}.png`
  link.href = canvas.toDataURL('image/png')
  link.click()
}
