import { buildReservoirGraph } from './graph'
import { loadLearningCircuit } from './load'
import { createReservoirModel } from './reservoir'
import { createLearningWorkerRuntime } from './workerRuntime'
import type { LearningWorkerRequest, LearningWorkerResponse } from './workerProtocol'

const scope = globalThis as unknown as {
  onmessage: (event: MessageEvent<LearningWorkerRequest>) => void
  postMessage: (response: LearningWorkerResponse) => void
}
const runtime = createLearningWorkerRuntime(async baseUrl =>
  createReservoirModel(buildReservoirGraph(await loadLearningCircuit(baseUrl))),
response => scope.postMessage(response))
scope.onmessage = event => { void runtime.receive(event.data) }
