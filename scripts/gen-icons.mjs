// Génère public/icon-192.png et public/icon-512.png à partir de favicon.svg
// sans aucune dépendance : rendu SVG minimal intégré + encodage PNG (zlib natif Node).
// Usage : node scripts/gen-icons.mjs
import { writeFileSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

const SIZE = process.argv[2] ? parseInt(process.argv[2], 10) : null

// Rendu logiciel d'un fond arrondi + étoile, identique à favicon.svg.
function renderPixels(size) {
  const px = new Uint8Array(size * size * 4)
  const cx = size / 2
  const cy = size / 2
  const radius = size * 0.5
  const corner = size * 0.22 // rayon des coins arrondis

  // Étoile à 5 branches (pleine), tournée vers le haut.
  const spikes = 5
  const outerR = size * 0.34
  const innerR = size * 0.14
  const rot = -Math.PI / 2
  const star = []
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR
    const a = rot + (i * Math.PI) / spikes
    star.push([cx + r * Math.cos(a), cy + r * Math.sin(a)])
  }

  const insideStar = (x, y) => {
    let inside = false
    for (let i = 0, j = star.length - 1; i < star.length; j = i++) {
      const [xi, yi] = star[i]
      const [xj, yj] = star[j]
      const intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi
      if (intersect) inside = !inside
    }
    return inside
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4
      // Coin arrondi : distance au centre du coin si dans la zone du coin.
      const dx = Math.max(Math.abs(x + 0.5 - cx) - (cx - corner), 0)
      const dy = Math.max(Math.abs(y + 0.5 - cy) - (cy - corner), 0)
      const inRounded = dx * dx + dy * dy <= corner * corner
      if (!inRounded) {
        px[i] = 0; px[i + 1] = 0; px[i + 2] = 0; px[i + 3] = 0
        continue
      }
      if (insideStar(x + 0.5, y + 0.5)) {
        px[i] = 0x38; px[i + 1] = 0xbd; px[i + 2] = 0xf8; px[i + 3] = 255
      } else {
        px[i] = 0x0f; px[i + 1] = 0x17; px[i + 2] = 0x2a; px[i + 3] = 255
      }
    }
  }
  return px
}

function crc32(buf) {
  let table = crc32.table
  if (!table) {
    table = crc32.table = new Int32Array(256)
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      table[n] = c
    }
  }
  let crc = -1
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff]
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(size, pixels) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0 // filter none
    Buffer.from(pixels.buffer, y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const sizes = SIZE ? [SIZE] : [192, 512]
for (const s of sizes) {
  const png = encodePng(s, renderPixels(s))
  writeFileSync(`public/icon-${s}.png`, png)
  console.log(`public/icon-${s}.png généré (${png.length} octets)`)
}
