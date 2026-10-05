/** Independent of the legacy generator's mapping version. */
export const LEARNER_VERSION = 2
export const INPUT_VERSION = 1
export const VOCABULARY_VERSION = 1
export const SNAPSHOT_VERSION = 2
export const RECENT_ACTION_LIMIT = 8
export const MOTIF_HISTORY_LIMIT = 8

export const RESERVOIR_CONFIGURATION = Object.freeze({
  modelVersion: 1,
  incomingWeightTotal: 0.85,
  retention: 0.75,
  inputScale: 0.2,
  maxExploration: 0.2,
})
