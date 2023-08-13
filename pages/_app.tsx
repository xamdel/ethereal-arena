import { GameStateProvider } from '../src/context/Provider'
import '../styles/globals.css'
import type { AppProps } from 'next/app'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <GameStateProvider>
      <Component {...pageProps} />
    </GameStateProvider>
  )
}