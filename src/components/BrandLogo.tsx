import React, { useEffect, useRef, useState } from 'react'

interface BrandLogoProps {
  size?: number
  className?: string
  // Asset URLs (place in public/ to avoid build-time import issues)
  logoUrl?: string
  eyeRotorUrl?: string
  blinkFrames?: string[] // ordered, e.g., ['/blink-step-1.svg','/blink-step-2.svg','/blink-step-3.svg']
}

const BrandLogo: React.FC<BrandLogoProps> = ({
  size = 48,
  className = '',
  logoUrl = '/logo.svg',
  eyeRotorUrl = '/eye-rotor.svg',
  blinkFrames = ['/blink-step-1.svg', '/blink-step-2.svg', '/blink-step-3.svg']
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [rotationDeg, setRotationDeg] = useState<number>(180) // default down
  const [logoSvg, setLogoSvg] = useState<string>('')
  const [eyeSvg, setEyeSvg] = useState<string>('')
  const [blinkSvgs, setBlinkSvgs] = useState<string[]>([])
  const [blinkFrame, setBlinkFrame] = useState<number>(-1) // -1 none

  // Fetch assets from public
  useEffect(() => {
    const fetchText = async (url: string) => {
      const r = await fetch(url)
      if (!r.ok) return ''
      return r.text()
    }
    fetchText(logoUrl).then(setLogoSvg)
    fetchText(eyeRotorUrl).then(setEyeSvg)
    Promise.all(blinkFrames.map(fetchText)).then(setBlinkSvgs)
  }, [logoUrl, eyeRotorUrl, blinkFrames.join('|')])

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const svg = el.querySelector('.brand-logo-base svg') as SVGSVGElement | null
      if (!svg) return
      // We position an overlay eye SVG to the target rect in the base logo: #eye-canvas
      const baseDoc = svg
      const eyeCanvas = baseDoc.querySelector('#eye-canvas') as SVGGraphicsElement | null
      const overlaySvg = el.querySelector('.brand-logo-eye svg') as SVGSVGElement | null
      if (!eyeCanvas || !overlaySvg) return
      // In the overlay eye SVG, find ellipse center within its own coords
      const ellipse = (overlaySvg.querySelector('#eye-ellipse') as SVGEllipseElement | null) || (overlaySvg.querySelector('ellipse') as SVGEllipseElement | null)
      const rotor = (overlaySvg.querySelector('#eye-rotor') as SVGGElement | null) || (ellipse ? (ellipse.parentElement as SVGGElement | null) : null)
      if (!ellipse || !rotor) return

      const ebbox = (ellipse as any).getBBox ? (ellipse as any).getBBox() : { x: 0, y: 0, width: 0, height: 0 }
      const ellipseCenterLocal = svg.createSVGPoint()
      ellipseCenterLocal.x = ebbox.x + ebbox.width / 2
      ellipseCenterLocal.y = ebbox.y + ebbox.height / 2

      // Compute rotor local center using its CTM
      const ellipseCTM = (ellipse as any).getCTM && (ellipse as any).getCTM()
      const rotorScreenCTM = (rotor as any).getScreenCTM && (rotor as any).getScreenCTM()
      if (!ellipseCTM || !rotorScreenCTM || !(rotorScreenCTM as any).inverse) return

      const centerOnScreen = ellipseCenterLocal.matrixTransform(ellipseCTM)
      const centerInRotor = centerOnScreen.matrixTransform((rotorScreenCTM as any).inverse())

      // Compute mouse in rotor coordinates
      const pt = svg.createSVGPoint()
      pt.x = e.clientX
      pt.y = e.clientY
      const mouseInRotor = pt.matrixTransform((rotorScreenCTM as any).inverse())

      const dxr = mouseInRotor.x - centerInRotor.x
      const dyr = mouseInRotor.y - centerInRotor.y
      const rad = Math.atan2(dyr, dxr)
      const deg = (rad * 180) / Math.PI
      const adjusted = deg + 90 // default at 6 o'clock when mouse below
      setRotationDeg(adjusted)

      rotor.setAttribute('transform', `rotate(${adjusted} ${centerInRotor.x} ${centerInRotor.y})`)
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [])

  // After assets load, fit the eye overlay into #eye-canvas rect of base logo
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const baseSvg = el.querySelector('.brand-logo-base svg') as SVGSVGElement | null
    const overlay = el.querySelector('.brand-logo-eye') as HTMLDivElement | null
    const overlaySvg = el.querySelector('.brand-logo-eye svg') as SVGSVGElement | null
    if (!baseSvg || !overlay || !overlaySvg) return
    const rectEl = baseSvg.querySelector('#eye-canvas') as SVGGraphicsElement | null
    if (!rectEl) return
    const rectBBox = (rectEl as any).getBBox ? (rectEl as any).getBBox() : null
    if (!rectBBox) return
    // Compute CSS pixels for the rect by mapping rect corners to screen then relative to container
    const baseCTM = baseSvg.getScreenCTM()
    const containerRect = el.getBoundingClientRect()
    if (!baseCTM) return
    const p = baseSvg.createSVGPoint()
    const toPx = (x: number, y: number) => {
      p.x = x; p.y = y
      const s = p.matrixTransform(baseCTM)
      return { x: s.x - containerRect.left, y: s.y - containerRect.top }
    }
    const topLeft = toPx(rectBBox.x, rectBBox.y)
    const bottomRight = toPx(rectBBox.x + rectBBox.width, rectBBox.y + rectBBox.height)
    const w = bottomRight.x - topLeft.x
    const h = bottomRight.y - topLeft.y
    overlay.style.position = 'absolute'
    overlay.style.left = `${topLeft.x}px`
    overlay.style.top = `${topLeft.y}px`
    overlay.style.width = `${w}px`
    overlay.style.height = `${h}px`
    // Scale overlay SVG to fill the rect using its viewBox
    const vb = overlaySvg.viewBox?.baseVal
    if (vb && vb.width && vb.height) {
      const sx = w / vb.width
      const sy = h / vb.height
      overlaySvg.style.transformOrigin = '0 0'
      overlaySvg.style.transform = `scale(${sx}, ${sy})`
    }
  }, [logoSvg, eyeSvg, size])

  // Blink logic
  useEffect(() => {
    let timeout: any
    const schedule = () => {
      const nextIn = 2500 + Math.random() * 3500 // 2.5s–6s
      timeout = setTimeout(() => {
        // run frames quickly
        setBlinkFrame(0)
        setTimeout(() => setBlinkFrame(1), 80)
        setTimeout(() => setBlinkFrame(2), 160)
        setTimeout(() => setBlinkFrame(-1), 240)
        schedule()
      }, nextIn)
    }
    schedule()
    return () => clearTimeout(timeout)
  }, [])

  return (
    <div ref={containerRef} className={`brand-logo ${className}`} style={{ width: `${size}px`, height: `${size}px`, position: 'relative' }}>
      {/* Base logo */}
      <div className="brand-logo-base" dangerouslySetInnerHTML={{ __html: logoSvg }} style={{ width: '100%', height: '100%' }} />
      {/* Eye rotor overlay */}
      <div className="brand-logo-eye" style={{ position: 'absolute', left: 0, top: 0 }} dangerouslySetInnerHTML={{ __html: eyeSvg }} />
      {/* Blink overlay */}
      {blinkFrame >= 0 && blinkSvgs[blinkFrame] && (
        <div className="brand-logo-blink" style={{ position: 'absolute', left: 0, top: 0 }} dangerouslySetInnerHTML={{ __html: blinkSvgs[blinkFrame] }} />
      )}
    </div>
  )
}

export default BrandLogo


