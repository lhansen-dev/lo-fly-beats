import { useEffect, useState } from 'react'
import type { EngineDiagnostics } from '../audio/engine'

type DiagnosticsPanelProps = {
  getDiagnostics: () => EngineDiagnostics | null
}

const idleDiagnostics = {
  status: 'idle',
  repeatEvents: 0,
  scoresHeld: 0,
  keysActiveVoices: 0,
}

export default function DiagnosticsPanel({ getDiagnostics }: DiagnosticsPanelProps) {
  const [diagnostics, setDiagnostics] = useState<EngineDiagnostics | null>(() => getDiagnostics())

  useEffect(() => {
    const interval = window.setInterval(() => setDiagnostics(getDiagnostics()), 500)
    return () => window.clearInterval(interval)
  }, [getDiagnostics])

  return <pre data-testid="diagnostics">{JSON.stringify(diagnostics ?? idleDiagnostics, null, 2)}</pre>
}
