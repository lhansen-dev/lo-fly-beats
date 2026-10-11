import type { NeuronRole } from '../../brain/circuit'

export const ROLE_STYLE: Record<NeuronRole, { color: string; label: string }> = {
  ear: { color: '#f2cf3a', label: "Ear (Johnston's organ)" },
  wing: { color: '#f4a46a', label: 'Wing & haltere sense' },
  auditory: { color: '#8ec5e2', label: 'Auditory' },
  premotor: { color: '#b9a3e3', label: 'Premotor' },
  song: { color: '#ff86ad', label: 'Courtship song' },
  motor: { color: '#8ee2cb', label: 'Wing motor' },
}
