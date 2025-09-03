import React, { useState, useEffect } from 'react'

interface RunicTextProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
  startDelay?: number
  letterDelay?: number
}

// Mapping of letters to runic equivalents
const RUNIC_MAP: { [key: string]: string } = {
  'a': 'ᚨ', 'b': 'ᛒ', 'c': 'ᚲ', 'd': 'ᛞ', 'e': 'ᛖ', 'f': 'ᚠ', 'g': 'ᚷ', 'h': 'ᚻ',
  'i': 'ᛁ', 'j': 'ᛃ', 'k': 'ᚲ', 'l': 'ᛚ', 'm': 'ᛗ', 'n': 'ᚾ', 'o': 'ᛟ', 'p': 'ᛈ',
  'q': 'ᚲ', 'r': 'ᚱ', 's': 'ᛊ', 't': 'ᛏ', 'u': 'ᚢ', 'v': 'ᚹ', 'w': 'ᚹ', 'x': 'ᚲᛊ',
  'y': 'ᚤ', 'z': 'ᛉ',
  'A': 'ᚨ', 'B': 'ᛒ', 'C': 'ᚲ', 'D': 'ᛞ', 'E': 'ᛖ', 'F': 'ᚠ', 'G': 'ᚷ', 'H': 'ᚻ',
  'I': 'ᛁ', 'J': 'ᛃ', 'K': 'ᚲ', 'L': 'ᛚ', 'M': 'ᛗ', 'N': 'ᚾ', 'O': 'ᛟ', 'P': 'ᛈ',
  'Q': 'ᚲ', 'R': 'ᚱ', 'S': 'ᛊ', 'T': 'ᛏ', 'U': 'ᚢ', 'V': 'ᚹ', 'W': 'ᚹ', 'X': 'ᚲᛊ',
  'Y': 'ᚤ', 'Z': 'ᛉ'
}

const RunicText: React.FC<RunicTextProps> = ({ 
  children, 
  className = '', 
  style = {},
  startDelay = 0.2,
  letterDelay = 40 // ms between each letter transformation
}) => {
  const textContent = React.Children.toArray(children).join('')
  const characters = textContent.split('')
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set())

  useEffect(() => {
    // Start transformation after startDelay
    const timeout = setTimeout(() => {
      // Get only letter indices (skip spaces)
      const letterIndices = characters
        .map((char, index) => char !== ' ' ? index : null)
        .filter(index => index !== null) as number[]
      
      // Sequential transformation in left-to-right order
      letterIndices.forEach((index, i) => {
        setTimeout(() => {
          setRevealedIndices(prev => new Set([...prev, index]))
        }, i * letterDelay)
      })
    }, startDelay * 1000)

    return () => clearTimeout(timeout)
  }, [characters.length, startDelay, letterDelay])

  return (
    <div className={`${className}`} style={{ 
      wordBreak: 'keep-all', 
      overflowWrap: 'break-word',
      hyphens: 'none',
      ...style 
    }}>
      {characters.map((char, index) => {
        if (char === ' ') {
          return <span key={index}> </span>
        }
        
        const isRevealed = revealedIndices.has(index)
        const runicChar = RUNIC_MAP[char] || 'ᚱ'
        
        return (
          <span 
            key={index} 
            style={{ 
              position: 'relative',
              display: 'inline-block',
              transition: 'all 0.1s ease-out'
            }}
          >
            {/* Simple character swap - no transparency */}
            <span style={{ 
              filter: isRevealed ? 'none' : 'brightness(0.8)', // 20% darker for runes
              fontFamily: 'inherit'
            }}>
              {isRevealed ? char : runicChar}
            </span>
          </span>
        )
      })}
    </div>
  )
}

export default RunicText
