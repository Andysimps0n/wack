import './App.css'
import Wack from './components/Wack'
import Butter from './components/Butter'
import WackUI from './components/WackUI'
import useSmashCrush from './hooks/useSmashCrush'
import { useState } from 'react'

function App() {
  const [theme] = useState('apple')
  // Accumulated Y rotation in radians — one full bar swipe adds ±2π.
  const [rotationY, setRotationY] = useState(0)
  const {
    crushProgress,
    status,
    appleKey,
    smash,
    startBlow,
    handleCleared,
    handleSettled,
  } = useSmashCrush()

  function handleRotateDelta(deltaRadians) {
    setRotationY((prev) => prev + deltaRadians)
  }

  return (
    <div className={theme === 'apple' ? 'scroll-container' : 'butter-container'}>
      {theme === 'apple' && (
        <WackUI
          status={status}
          onSmash={smash}
          rotationY={rotationY}
          onRotateDelta={handleRotateDelta}
        />
      )}
      <div className="sticky-canvas">
        {theme === 'apple' ? (
          <Wack
            appleKey={appleKey}
            crushProgress={crushProgress}
            status={status}
            rotationY={rotationY}
            onStartBlow={startBlow}
            onCleared={handleCleared}
            onSettled={handleSettled}
          />
        ) : (
          <Butter />
        )}
      </div>
    </div>
  )
}

export default App
