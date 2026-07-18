import './App.css'
import Wack from './components/Wack'
import useScrollProgress from './hooks/useScrollProgress'

function App() {
  const scrollProgress = useScrollProgress()

  return (
    <div className="scroll-container">
      <div className="sticky-canvas">
        <Wack scrollProgress={scrollProgress} />
      </div>
    </div>
  )
}

export default App
