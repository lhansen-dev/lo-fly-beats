/**
 * Let the fly compose and render demo tapes in headless Chromium through the app's own audio rig.
 * Start the dev server first (npm run dev -- --port 5173), then:
 *   node scripts/brain/render-demos.mjs [outDir] [phrasesPerTape]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const out = process.argv[2] ?? 'artifacts/brain/demos'
const phrases = Number(process.argv[3] ?? 5)
const base = process.env.DEV_URL ?? 'http://localhost:5173/'
const stem = process.env.STEM ?? null
const tapes = [
  { name: 'rainy-windowsill', presetId: 'rainy-windowsill', sessionSeed: 101, variation: 0.4 },
  { name: 'overripe-2am', presetId: 'overripe-2am', sessionSeed: 202, variation: 0.3 },
  { name: 'fruit-bowl-finals', presetId: 'fruit-bowl-finals', sessionSeed: 303, variation: 0.5 },
  { name: 'rainy-windowsill-adventurous', presetId: 'rainy-windowsill', sessionSeed: 404, variation: 1 },
]
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()
page.on('pageerror', error => console.error('page error', error.message))
await page.goto(`${base}?composer=walk`)
const only = process.env.TAPE ?? null
for (const tape of (only ? tapes.filter(t => t.name === only) : stem ? tapes.slice(0, 1) : tapes)) {
  const result = await page.evaluate(async ({ tape, phrases, stem }) => {
    const [{ loadBrainCircuit }, { createBrainModel }, { checkpointSchema, decodeReadout }, { FlyMind }, { renderTrack }, { encodeWav16 }, { getPreset }, { DEFAULT_MIX }, { notate }] = await Promise.all([
      import('/src/brain/circuit.ts'), import('/src/brain/model.ts'), import('/src/brain/checkpoint.ts'), import('/src/brain/mind.ts'),
      import('/src/audio/export.ts'), import('/src/audio/wav.ts'), import('/src/presets/presets.ts'), import('/src/audio/rig.ts'), import('/src/brain/notation.ts'),
    ])
    const { circuit } = await loadBrainCircuit('/')
    const model = createBrainModel(circuit)
    const checkpoint = checkpointSchema.parse(await (await fetch('/data/brains/fly-v1/checkpoint.json')).json())
    const compressed = await (await fetch('/data/brains/fly-v1/readout.bin.gzip')).arrayBuffer()
    const raw = new Uint8Array(await new Response(new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
    const mind = new FlyMind(model, decodeReadout(raw, model), checkpoint, null)
    const preset = getPreset(tape.presetId)
    const recipe = { recipeVersion: 1, presetId: tape.presetId, sessionSeed: tape.sessionSeed, variation: tape.variation, tempoBpm: preset.tempoBpm }
    const scores = []
    const sheets = []
    const bananas = []
    for (let index = 0; index < phrases; index++) {
      const phrase = mind.compose(recipe, index, index === 0)
      mind.adopt(phrase.id)
      scores.push(phrase.score)
      bananas.push(phrase.bananas)
      sheets.push(`phrase ${index + 1}: ${phrase.bananas} bananas${phrase.notes.length ? ` (${phrase.notes.join('; ')})` : ''}\n${notate(phrase.score.brain.actions, tape.presetId)}`)
    }
    // STEM=drums|bass|keys|lead renders one layer alone, for checking the balance.
    const mix = stem ? { ...DEFAULT_MIX, layers: Object.fromEntries(Object.entries(DEFAULT_MIX.layers).map(([layer, value]) => [layer, { ...value, muted: layer !== stem }])) } : DEFAULT_MIX
    const wav = encodeWav16(await renderTrack(scores, recipe, preset, mix))
    const bytes = new Uint8Array(wav)
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000))
    return { wav: btoa(binary), sheets, bananas, tempo: preset.tempoBpm }
  }, { tape, phrases, stem })
  await writeFile(`${out}/${tape.name}${stem ? `-${stem}` : ''}.wav`, Buffer.from(result.wav, 'base64'))
  await writeFile(`${out}/${tape.name}.txt`, `${tape.name} at ${result.tempo} BPM, composed by the fly (variation ${tape.variation})\n\n${result.sheets.join('\n\n')}\n`)
  console.log(tape.name, 'bananas', result.bananas.join(' '))
}
await browser.close()
