import { loadCircuit } from '../../connectome/load'
import { CircuitError } from '../../connectome/types'

/** Load the experimental subset explicitly, without changing the accompaniment loader. */
export async function loadLearningCircuit(baseUrl: string, fetchImpl: typeof fetch = fetch) {
  const graph = await loadCircuit(baseUrl, fetchImpl, 'mbon-v1')
  if (graph.manifest.circuitId !== 'mbon-v1') throw new CircuitError('integrity', 'Expected the mbon-v1 learning circuit')
  return graph
}
