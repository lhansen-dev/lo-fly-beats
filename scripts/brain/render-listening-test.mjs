/**
 * Render matched clips for a blind listening test: the fly, his tutor, and the classic connectome walk,
 * two phrases each per preset, same tempo and mix. Needs the dev server (npm run dev -- --port 5173).
 *   node scripts/brain/render-listening-test.mjs [outDir]
 */
import { mkdir, writeFile } from 'node:fs/promises'
import { chromium } from 'playwright'

const out = process.argv[2] ?? 'artifacts/brain/listening'
const base = process.env.DEV_URL ?? 'http://localhost:5173/'
await mkdir(out, { recursive: true })
const browser = await chromium.launch()
const page = await browser.newPage()
page.on('pageerror', error => console.error('page error', error.message))
await page.goto(`${base}?composer=walk`)
const clips = await page.evaluate(async () => {
  const [{ loadBrainCircuit }, { createBrainModel }, { checkpointSchema, decodeReadout }, { FlyMind }, { renderTrack }, { encodeWav16 }, { getPreset }, { DEFAULT_MIX }, { loadCircuit }, { composePhrase }, { createTutor, tutorPhrase }, { arrangePhrase }, { createRng }] = await Promise.all([
    import('/src/brain/circuit.ts'), import('/src/brain/model.ts'), import('/src/brain/checkpoint.ts'), import('/src/brain/mind.ts'),
    import('/src/audio/export.ts'), import('/src/audio/wav.ts'), import('/src/presets/presets.ts'), import('/src/audio/rig.ts'),
    import('/src/connectome/load.ts'), import('/src/music/compose.ts'), import('/src/brain/tutor.ts'), import('/src/brain/arrange.ts'), import('/src/music/rng.ts'),
  ])
  const { circuit } = await loadBrainCircuit('/')
  const model = createBrainModel(circuit)
  const checkpoint = checkpointSchema.parse(await (await fetch('/data/brains/fly-v1/checkpoint.json')).json())
  const raw = new Uint8Array(await new Response(new Blob([await (await fetch('/data/brains/fly-v1/readout.bin.gzip')).arrayBuffer()]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer())
  const readout = decodeReadout(raw, model)
  const graph = await loadCircuit('/')
  const results = []
  const presets = [['rainy-windowsill', 11], ['overripe-2am', 22], ['fruit-bowl-finals', 33]]
  for (const [presetId, seed] of presets) {
    const preset = getPreset(presetId)
    const recipe = { recipeVersion: 1, presetId, sessionSeed: seed, variation: 0.5, tempoBpm: preset.tempoBpm }
    // Phrases 2 and 3 of a song: past the intro, before any breakdown, so all three play full grooves.
    const mind = new FlyMind(model, readout, checkpoint, null)
    const fly = []
    for (let index = 0; index < 3; index++) { const phrase = mind.compose(recipe, index, index === 0); mind.adopt(phrase.id); if (index > 0) fly.push(phrase.score) }
    const rng = createRng(`listening-tutor|${presetId}`)
    const tutor = createTutor(presetId, rng)
    const taught = []
    for (let index = 0; index < 3; index++) { const actions = tutorPhrase(tutor, rng); if (index > 0) taught.push(arrangePhrase(model, 0, recipe, index, actions, { beatPeaks: [], roleLevels: {} })) }
    const walk = [1, 2].map(index => composePhrase(graph, { ...recipe, variation: 0.5 }, index))
    for (const [source, scores] of [['fly', fly], ['tutor', taught], ['walk', walk]]) {
      const wav = new Uint8Array(encodeWav16(await renderTrack(scores, recipe, preset, DEFAULT_MIX)))
      let binary = ''
      for (let offset = 0; offset < wav.length; offset += 0x8000) binary += String.fromCharCode(...wav.subarray(offset, offset + 0x8000))
      results.push({ presetId, source, wav: btoa(binary) })
    }
  }
  return results
})
for (const clip of clips) await writeFile(`${out}/${clip.presetId}-${clip.source}.wav`, Buffer.from(clip.wav, 'base64'))
console.log('rendered', clips.length, 'clips')
await browser.close()
