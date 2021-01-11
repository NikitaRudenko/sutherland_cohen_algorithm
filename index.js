function createScene() {
  const canvas = document.getElementById('scene')
  const ctx = canvas.getContext('2d')

  canvas.width = 800
  canvas.height = 800

  return ctx
}

function drawScreen(ctx, rect) {
  ctx.fillStyle = 'rgba(255, 255, 255, 1)'
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  ctx.fill()
}

function drawViewport(ctx, rect) {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
  ctx.fillRect(rect.x, rect.y, rect.width, rect.height)
  ctx.fill()
}

function drawLines(ctx, lines, color = '#000') {
  lines.forEach(line => {
    const [lineStart, lineEnd] = line
    ctx.beginPath()
    ctx.moveTo(lineStart.x, lineStart.y)
    ctx.lineTo(lineEnd.x, lineEnd.y)
    ctx.strokeStyle = color
    ctx.stroke()
  })
}

function createLines(viewport) {
  const Xmin = viewport.x
  const Xmax = viewport.width
  const Ymax = viewport.height
  const Ymin = viewport.y

  const getRandomX = () => Math.floor(Math.random() * (Xmax - Xmin)) + Xmin
  const getRandomY = () => Math.floor(Math.random() * (Ymax - Ymin)) + Ymin

  const linesCount = Math.round((Math.random() * 100))

  const lines = []
  for (let i = 0; i < linesCount; i++) {
    const x1 = getRandomX()
    const y1 = getRandomY()
    let x2 = getRandomX()
    let y2 = getRandomY()

    if (isEqual({x: x1, y: y1}, {x: x2, y: y2})) {
      x2 += 10
      y2 += 10
    }

    lines.push([
      {
        x: x1,
        y: y1
      },
      {
        x: getRandomX(),
        y: getRandomY()
      }
    ])
  }

  return lines
}

// 1. Отрисовать экран
// 2. Отрисовать отрезки
// 3. Вычислить обрезаемые отрезки (новые отрезки)
// 4. Отрисовать обрезаемые отрезки

// 1. grab lines
// 2. foreach line -> get points -> make bin code
// 3. a. code1 & code2 == 0 -- рисовать целиком
// 4. b. code1 & code2 == (code1 || code2) -- не рисовать
// 5. c. отсечение:
// 6.  a. code1 || code2 has 1 -> move point to border
// 7.  b. goto #1.

function getLinesWithBinCode(rect, lines) {
  const Xmin = rect.x
  const Xmax = rect.x + rect.width
  const Ymax = rect.y + rect.height
  const Ymin = rect.y

  return lines.map((line) => {
    return line.map(({
      x,
      y
    }) => {
      let code = 0

      code |= x >= Xmin ? 0 : (1 << 3)
      code |= x <= Xmax ? 0 : (1 << 2)
      code |= y >= Ymin ? 0 : (1 << 1)
      code |= y <= Ymax ? 0 : 1

      return {
        x,
        y,
        code
      }
    })
  })
}

function isInside(point) {
  return point.code === 0
}

function getPointInsideRect(line, defaultPoint) {
  if (isInside(line[0])) {
    return line[0]
  }

  if (isInside(line[1])) {
    return line[1]
  }

  return defaultPoint
}

function getDistance(point1, point2) {
  return Math.sqrt(Math.pow(point2.x - point2.x, 2) + Math.pow(point2.y - point1.y, 2))
}

function isEqual(point1, point2) {
  return point1.x === point2.x && point1.y === point2.y
}

// [
// 	// line
// 	[
//		{x, y},
// 		{x1, y1}
// 	]
// ]
function getDisplayedLines(rect, lines) {
  let linesToClip = []
  let displayedLines = []
  let binLines = getLinesWithBinCode(rect, lines)

  let isClipping = true
  do {
    if (linesToClip.length) {
      linesToClip.length = 0
    }

    const linesToDisplay = binLines.filter(line => {
      const [lineStart, lineEnd] = line
      const conRes = lineStart.code & lineEnd.code

      if (isInside(lineStart) && isInside(lineEnd)) {
        return true
      }

      if (conRes !== 0) {
        return false
      }

      linesToClip.push(line)
      return false
    })

    displayedLines = [
      ...displayedLines,
      ...linesToDisplay
    ]

    if (linesToClip.length) {
      linesToClip = linesToClip.map(line => clipLine(rect, line))
      binLines = getLinesWithBinCode(rect, linesToClip)
    }
  } while (linesToClip.length)

  return displayedLines
}


// 1. Составить ур-ние прямой
// 2. Если x ближе к X, чем y к
// 		a. TRUE -> подставить x в ур-ние -> получить y
//		b. FALSE -> подставить y в ур-ние -> получить x
function clipLine(rect, line) {
  const Xmin = rect.x
  const Xmax = rect.x + rect.width
  const Ymax = rect.y + rect.height
  const Ymin = rect.y

  const isConverges = point => line.some(pt => pt.x === point.x && pt.y === point.y)

  return line.map(point => {
    const {
      x,
      y
    } = point
    
    if (isInside(point)) {
    	return point
    }

    const distMinX = Math.abs(x - Xmin)
    const distMaxX = Math.abs(x - Xmax)
    const distMinY = Math.abs(y - Ymin)
    const distMaxY = Math.abs(y - Ymax)

    const minX = Math.min(distMinX, distMaxX)
    const minY = Math.min(distMinY, distMaxY)

    const newX = distMinX < distMaxX ? Xmin : Xmax
    const clipPoint1 = {
      x: newX,
      y: getY(line, newX)
    }

    const newY = distMinY < distMaxY ? Ymin : Ymax
    const clipPoint2 = {
      x: getX(line, newY),
      y: newY
    }

    const distanceTo1 = isEqual(point, clipPoint1) ? Infinity : getDistance(point, clipPoint1)
    const distanceTo2 = isEqual(point, clipPoint2) ? Infinity : getDistance(point, clipPoint2)

    if (distanceTo1 > distanceTo2) {
      return isConverges(clipPoint2) ? getPointInsideRect(line, clipPoint1) : clipPoint2
    }

    return clipPoint1
  })
}

// x = (((y - y1) * (x2 - x1)) / (y2 - y1)) + x1
function getX(line, y) {
  const [lineStart, lineEnd] = line
  const x1 = lineStart.x
  const y1 = lineStart.y
  const x2 = lineEnd.x
  const y2 = lineEnd.y

  return (((y - y1) * (x2 - x1)) / (y2 - y1)) + x1
}

// y = (((x - x1) * (y2 - y1)) / (x2 - x1)) + y1
function getY(line, x) {
  const [lineStart, lineEnd] = line
  const x1 = lineStart.x
  const y1 = lineStart.y
  const x2 = lineEnd.x
  const y2 = lineEnd.y

  return (((x - x1) * (y2 - y1)) / (x2 - x1)) + y1
}

function main() {
  const screen = {
    x: 50,
    y: 50,
    width: 250,
    height: 250
  }
  const viewport = {
    x: 20,
    y: 20,
    width: 400,
    height: 400
  }
  const ctx = createScene()
  const lines = createLines(viewport)

  drawViewport(ctx, viewport)
  drawScreen(ctx, screen)
  drawLines(ctx, lines, '#ccc')

  const linesInScreen = getDisplayedLines(screen, lines)
  drawLines(ctx, linesInScreen, '#ff0000')
}

main()
