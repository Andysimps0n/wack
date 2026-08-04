import './App.css'
import Wack from './components/Wack'
import Butter from './components/Butter'
import ThemeSwitcher from './components/ThemeSwitcher'
import SmashButton from './components/SmashButton'
import useSmashCrush from './hooks/useSmashCrush'
import { useState } from 'react'

function App() {
  const [theme, setTheme] = useState('apple')
  const {
    crushProgress,
    status,
    appleKey,
    smash,
    startBlow,
    handleCleared,
    handleSettled,
  } = useSmashCrush()

  return (
    <div className={theme === 'apple' ? 'scroll-container' : 'butter-container'}>
      {/* <ThemeSwitcher theme={theme} onThemeChange={setTheme} /> */}
      {theme === 'apple' && (
        <SmashButton status={status} onSmash={smash} />
      )}
      <div className="sticky-canvas">
        {theme === 'apple' ? (
          <Wack
            appleKey={appleKey}
            crushProgress={crushProgress}
            status={status}
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
