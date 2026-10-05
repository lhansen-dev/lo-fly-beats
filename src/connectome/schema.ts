import { z } from 'zod'

const idSchema = z.string().regex(/^[1-9][0-9]*$/)
const sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const countSchema = z.number().int().nonnegative()
const annotationSchema = z.string().nullable()
export const neuronSchema = z.strictObject({
  id: idSchema,
  type: annotationSchema,
  instance: annotationSchema,
  class: annotationSchema,
  superclass: annotationSchema,
  somaSide: annotationSchema,
})

export const compactCircuitSchema = z.strictObject({
  schemaVersion: z.literal(2),
  circuitId: z.string().min(1),
  neurons: z.array(neuronSchema),
})

export const circuitSchema = z.strictObject({
  schemaVersion: z.literal(1),
  circuitId: z.string().min(1),
  neurons: z.array(neuronSchema),
  connections: z.array(z.strictObject({
    source: idSchema,
    target: idSchema,
    synapseCount: z.number(),
  })),
})

export const manifestSchema = z.strictObject({
  schemaVersion: z.union([z.literal(1), z.literal(2)]),
  circuitId: z.string().min(1),
  title: z.string(),
  description: z.string(),
  source: z.strictObject({
    dataset: z.string(),
    release: z.string(),
    homepage: z.url(),
    downloadPage: z.url(),
    citation: z.string(),
    paperUrl: z.url(),
    retrievedOn: z.iso.date(),
    files: z.array(z.strictObject({
      role: z.enum(['annotations', 'connections']),
      name: z.string(),
      url: z.url(),
      bytes: countSchema,
      md5Base64: z.string(),
      sha256: sha256Schema,
    })),
  }),
  license: z.strictObject({ name: z.string(), url: z.url(), attribution: z.string() }),
  extraction: z.strictObject({
    script: z.string(),
    scriptVersion: z.number().int().positive(),
    config: z.string(),
    configSha256: sha256Schema,
    neuronSelection: z.string(),
    minSynapseCount: z.number().int().positive(),
    selfConnectionsRemoved: countSchema,
    rules: z.array(z.string()),
    thresholdComparison: z.array(z.strictObject({
      minSynapseCount: z.number().int().positive(),
      connections: countSchema,
      largestStronglyConnected: countSchema.optional(),
      deadEnds: countSchema,
    })),
    startNeuronRule: z.string(),
  }),
  counts: z.strictObject({
    neurons: countSchema,
    cellTypes: countSchema,
    connections: countSchema,
    synapses: countSchema,
    largestStronglyConnected: countSchema.optional(),
    weaklyConnectedComponents: countSchema.optional(),
    deadEnds: countSchema,
  }),
  startNeuronIds: z.array(idSchema),
  output: z.union([
    z.strictObject({ file: z.literal('circuit.json'), bytes: countSchema, sha256: sha256Schema }),
    z.strictObject({
      file: z.literal('neurons.json.gzip'), bytes: countSchema, sha256: sha256Schema,
      graphSha256: sha256Schema,
      adjacency: z.strictObject({
        file: z.literal('adjacency.bin.gzip'), encoding: z.literal('csr-u32-le-v1'),
        bytes: countSchema, sha256: sha256Schema, uncompressedBytes: countSchema,
      }),
    }),
  ]),
})
