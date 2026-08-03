import { useState } from 'react'
import './App.css'
import Wack from './components/Wack'
import Butter from './components/Butter'
import ThemeSwitcher from './components/ThemeSwitcher'
import useScrollProgress from './hooks/useScrollProgress'

function App() {
  const [theme, setTheme] = useState('apple')
  const scrollProgress = useScrollProgress()

  return (
    <div className={theme === 'apple' ? 'scroll-container' : 'butter-container'}>
      <ThemeSwitcher theme={theme} onThemeChange={setTheme} />
      <div className="sticky-canvas">
        {theme === 'apple' ? (
          <Wack scrollProgress={scrollProgress} />
        ) : (
          <Butter />
        )}
      </div>
    </div>
  )
}

export default App
