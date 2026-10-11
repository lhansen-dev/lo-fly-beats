# Lo-fly beats

## What it is

A lo-fi beat player starring a fruit fly studying beside an overripe banana, and **the fly composes the beats himself**. A simulated network built from the male fly's real ear-to-song wiring (MaleCNS: Johnston's organ, wing and haltere sense, auditory relays, courtship-song neurons, and wing motor neurons) chooses every kick, snare, hat, bass note, chord, keys strike, melody move, and loop. He learned from an original lofi tutor, practiced alone for bananas from his own critic, and keeps practicing on what he plays for you. Give him a banana when you like a phrase.

**Beats to relax / repeatedly fly into the same window to**

- Hear him first: [demo tapes](docs/demos/), with the score of every phrase he played.
- How he works and what the measurements do and do not show: [experiment 02](docs/learning/experiment-02-fly-brain.md).
- The classic seeded walk through the whole connectome is still available at `/?composer=walk`.

## Quick start

Use Node 22 (22.12 or newer) and npm. The circuit is committed; Python and upstream downloads are only needed to regenerate it.

```sh
make setup
make run
```

Open the URL Vite prints and press **Start listening**.

## The fly's brain

| Path | Purpose |
| --- | --- |
| `public/data/circuits/song-v1/` | The 1,771-neuron ear-to-song circuit with predicted transmitters; regenerate with `uv run --project scripts/data python scripts/data/extract_song_circuit.py` after placing `body-neurotransmitters-male-cns-v1.0.feather` in `scripts/data/.cache/` |
| `public/data/brains/fly-v1/` | The trained fly: int8 readout (about 530 KB) and a checkpoint with his training history |
| `src/brain/` | Circuit loading, rate dynamics, senses, decisions, tutor, critic, learning, the persistent `FlyMind`, and its worker |
| `scripts/brain/train.ts` | School + practice + evaluation; `--publish` writes the shipped fly, `--connectivity source-permuted|zero` trains controls |
| `scripts/brain/evaluate.ts`, `judge.ts`, `compare-wiring.py`, `audio-qa.py`, `publish.ts` | Measure a fly with the critic and with an independent style judge, compare wirings, check rendered audio, and ship a measured readout |
| `scripts/brain/render-demos.mjs` | Renders demo tapes through the app's audio rig in headless Chromium (needs the dev server) |

```sh
node --import tsx scripts/brain/train.ts --school 1500 --practice 3000 --publish   # ~20 minutes
npm run dev -- --port 5173 & node scripts/brain/render-demos.mjs artifacts/brain/demos 5
```

In the app, the fly runs in a worker one phrase ahead of playback. Only phrases that actually play advance his neural state and get practiced; preparation never changes him. New beat or a preset change wakes the same fly in a new mood (seeded spontaneous activity), keeping everything he learned. Variation sets how adventurous he is (sampling temperature 0.6–1.0). His browser-local practice is saved in IndexedDB; **Forget his practice here** returns to the shipped fly.

## Learning prototype (experiment 01)

Run `npm run dev` and open `/?learning=1&debug=1` to use the development-only MBON bass experiment. **Start listening** plays prepared learning scores through the normal transport; **Teach motif** trains a candidate in one dedicated worker and adopts it at a phrase boundary after a replacement score is ready. Teaching while paused preserves the active phrase until playback reaches that boundary. The initial screen can accept teaching before playback begins.

IndexedDB keeps the current and previous committed boundary checkpoints separately from UI settings. Reload starts without audio and replays the saved phrase after Start listening. New beat and preset changes reset transient activity while preserving learned parameters. Pause, mixer changes, and captured-score WAV export preserve learning. A missed preparation repeats the current phrase with model progress frozen; worker/storage failures display a status and leave listening usable.

`npm run test:learning:browser` checks the development experiment in Chromium. `npm run learning:eval` measures frozen retention and the comparison controls. See [the implementation handoffs](docs/05-LEARNING-IMPLEMENTATION.md) and [experiment 01](docs/learning/experiment-01.md). Human listening, production mode selection, Forget learning, and the extended learning soak remain session 5 work; the measured motif task has not established a benefit from fly connectivity.

## Make targets

Run `make` to list the common targets. The main ones are `make setup`, `make run`, `make check`, `make test-all`, `make build`, and `make preview`. Run `make browsers` once before `make test-browser` or `make test-all` if the Playwright browser binaries are not installed. Node 22.12 or newer, npm, and Make are required. The connectome is already committed, so running the app does not require Python or a data download.

## Commands

| Script | Command | Purpose |
| --- | --- | --- |
| `dev` | `vite` | Local development |
| `build` | `tsc -b && vite build` | Static production output in `dist/` |
| `preview` | `vite preview --port 4173 --strictPort` | Serve the production build |
| `typecheck` | `tsc -b` | TypeScript checks |
| `lint` | `oxlint` | Lint source and tests |
| `test` | `vitest run --project unit` | Unit and committed-data tests |
| `check` | `npm run typecheck && npm run lint && npm run test && npm run data:validate && npm run build` | Routine validation and build |
| `data:download` | `uv run --project scripts/data python scripts/data/download_sources.py` | Download and verify upstream sources |
| `data:extract` | `uv run --project scripts/data python scripts/data/extract_whole_cns.py` | Regenerate whole-connectome assets and manifest |
| `data:verify` | `uv run --project scripts/data python scripts/data/verify_whole_cns.py` | Compare export to upstream and write the report |
| `data:validate` | `vitest run --project unit tests/data` | Validate committed data and composition |
| `test:browser` | `playwright test` | Production browser interaction tests |
| `test:learning:browser` | `playwright test --config playwright.learning.config.ts` | Development learning playback, teaching, restart, and failure checks |
| `test:audio` | `vitest run --project audio` | Chromium Web Audio rendering tests |
| `test:all` | `npm run check && npm run test:audio && npm run test:browser` | All automated checks |
| `budget` | `node scripts/measure-budgets.mjs` | Measure gzip budgets after building |

## How it works

The app loads all 165,122 traced MaleCNS neurons and 10,510,984 directed connections with original IDs and synapse counts. A versioned seeded generator walks the complete retained graph, weighting choices by synapse count and variation. Each phrase can start at any of the 161,680 neurons with outgoing connections, so visual, central-brain, sensory, motor, and nerve-cord circuits can all shape the music. Neuron types select chords and bass motifs within authored harmony and rhythm rules. Drums, keys, timing, and humanization turn the trace into an immutable eight-bar score. Tone.js schedules that score against the audio clock and renders the same score for export. Drum hits, ambience, and the convolution impulse use separate seeded streams.

The musical mapping is authored and does not simulate neural activity. Scene animation and jokes cannot change the score. See the [plan](docs/02-PLAN.md), [implementation contracts and decisions](docs/03-IMPLEMENT.md), and in-app **How the beat is made** panel.

The live MaleCNS scanner plots every selected neuron on a canvas overview with representative background connections. Its SVG overlay follows the score's current beat, highlighting the exact selected neuron, incoming connection, and last eight traversal steps from the full graph. The inspector shows original body IDs, synapse counts, selection probability, and musical uses; totals always describe the complete dataset. Select an elapsed beat in the eight-bar timeline to inspect it; **Follow live beat** returns to playback. Inspection resets when a new phrase begins. The scanner pauses with playback and respects reduced motion, the animation switch, and tab visibility. Its anatomical X–Z projection uses original MaleCNS coordinates at a uniform scale, with the fly’s annotated left on the left: 140,024 measured cell bodies and 976 soma attachment points. The 24,122 neurons without positions occupy a separate labeled strip. Callouts identify the optic lobes, central brain, thoracic neuromeres, and abdominal neuromeres. A linked fly-body map highlights regions and pathways using the source’s superclass, subclass, neuromere, and entry/exit nerve annotations; it assigns a limb side only when rootSide is explicit. General thoracic neurons do not imply a specific limb target. Connection arcs describe graph edges rather than axon morphology. Highlights represent the musical traversal, not measured neural firing or movement. Only the overview's background links are reduced; composition uses every retained connection.

## Audio behavior

- The drum kit uses a short, damped snare, restrained hats, and a rounded kick. Each preset filters the drums separately; Overripe at 2 AM is darkest and Fruit Bowl Finals is brightest. Playback and WAV export use the same kit and mix.
- **Start listening** requires a user action. Reloads restore active settings but start at phrase 1 with playback idle.
- Tempo changes apply at the next bar while playing. Preset, variation, and New beat changes apply at the next phrase, with pending descriptions until applied. Mixer settings apply immediately with short ramps.
- Desktop scheduling uses the audio clock and continues when the tab is hidden; scene updates pause. Browser or OS suspension interrupts audio and displays **Press Play to resume**. Resuming continues from the saved step. Actual background and mobile suspension behavior still requires the release device checks.
- With focus on the page body or scene, Space/K toggles playback and N requests New beat. Inputs, buttons, and links keep normal keyboard behavior. Reduced motion is respected; **Animate scene** can override it.
- Export captures the current phrase from its first step and the active preset, tempo, and mix, excluding pending changes. It pauses playback and produces eight bars plus a two-second tail: stereo, 44.1 kHz, 16-bit PCM WAV. At 60–100 BPM, clips last about 34–21 seconds. Press Play to resume afterward. Repeated exports replace the previous download URL.

## Browser support

The production build passes automated browser checks on macOS 26.5.1, arm64 MacBookPro18,2 (64 GiB RAM). These results identify the tested browser engines; real-device listening, background playback, independent audio-player checks, and VoiceOver validation remain pending at [phase 38](docs/03-IMPLEMENT.md#phase-38-human-gate--release-validation). The build is a release candidate pending that review.

| Browser/engine | Tested version | Automated playback, controls, simulated recovery, WAV download | Manual release validation |
| --- | --- | --- | --- |
| Chromium | 153.0.8010.12 | Pass; accessibility, startup, 15-minute soak and five exports also pass | Desktop Chrome listening/background checks pending |
| Firefox | 155.0 | Pass | Desktop listening/background checks pending |
| WebKit | 26.6 | Pass | Actual desktop Safari validation pending |
| iOS Safari | Untested | Not established | Playback, app switching/locking, and export support pending |
| Android Chrome | Untested | Not established | Playback, app switching/locking, and export support pending |

Mobile background playback and export are unverified. Automated WebKit results supplement actual Safari testing; they do not establish iOS support. The user’s manual matrix will replace these pending entries after release review.

## Data

Source: [MaleCNS](https://male-cns.janelia.org/), release `male-cns:v1.0`, [download page](https://male-cns.janelia.org/download/), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Credit FlyEM at HHMI Janelia, the University of Cambridge Department of Zoology, the MRC Laboratory of Molecular Biology, and Google Research.

Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2025). *Sexual dimorphism in the complete connectome of the Drosophila male central nervous system*. bioRxiv. [Preprint DOI](https://doi.org/10.1101/2025.10.09.680999). [Published paper](https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6).

Selection includes every annotation with `status == "Traced"`, across all neuron classes and both the brain and nerve cord, including neurons without a type annotation. Glia and unfinished or untraced bodies are excluded. Connections between selected bodies retain the existing minimum of three synapses; self-connections are removed. There is no sampling or per-neuron connection cap. IDs are decimal strings; missing annotations are null.

[The manifest](public/data/circuits/whole-cns-v1/manifest.json) records source checksums, selection, counts, start rules, and both compressed asset hashes. `neurons.json.gzip` contains annotations, while `adjacency.bin.gzip` stores every retained edge in compact sorted sparse rows. The browser verifies both files before decompression and checks graph integrity. Typed arrays retain the entire graph; a bounded cache materializes only outgoing rows currently used by playback or inspection. The initial graph download is about 35.3 MiB, and adjacency occupies 84.7 MB uncompressed. Loading time depends on the connection and device; playback starts after data validation. These assets use `.gzip` rather than `.gz` to avoid static servers implicitly decoding them before checksum verification.

`data:verify` independently checks all 165,122 annotation records and 10,510,984 retained weights against upstream. See the [whole-connectome extraction report](scripts/data/reports/whole-cns-v1-extraction.md). The previous MBON files remain committed as regression fixtures; the application loads `whole-cns-v1`.

## Regenerating the data

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), which manages the locked Python 3.12 environment. From the repository root:

```sh
uv sync --locked --project scripts/data
npm run data:download
npm run data:extract
npm run data:verify
npm run data:validate
```

Downloads and cache require about 1.1 GB, plus Python dependencies and any temporary replacement downloads. Sources remain in ignored `scripts/data/.cache/`; builds use committed compressed assets. Downloads reuse verified caches and preserve retrieval dates.

Expected results: 165,122 neurons, 11,751 cell types, 10,510,984 connections, 104,213,241 synapses, 3,442 dead ends, and 161,680 eligible phrase starts. Annotations contain 211,577 total rows; the complete upstream connection file contains 151,856,684 rows in 2,318 Arrow batches. The graph fingerprint is `ad42e3e52de41c931f79d4cbcc218f59f438387fec6a2abae8df7cc7046ca0cb`, derived from both compressed asset hashes.

For changed data, update `scripts/data/config/whole-cns-v1.json`, regenerate both assets and the manifest, run independent verification, and update expected counts and documentation. Composition rule changes require a mapping version bump; this expansion preserves mapping version 2 and changes the graph fingerprint. The [data guide](scripts/data/README.md) documents the format and regeneration.

## Testing

Install browser binaries once, then run all checks:

```sh
npx playwright install chromium firefox webkit
npm run test:all
```

Unit/data tests run in Node, audio tests use real Chromium Web Audio, and browser specs use the production preview in Chromium, Firefox, and WebKit. Accessibility, lifecycle, startup, and subdirectory acceptance specs target Chromium. The [coverage table](tests/README.md) maps acceptance areas to automated and manual evidence.

```sh
SOAK=1 SOAK_MINUTES=15 npx playwright test tests/browser/soak.spec.ts --project=chromium
npm run build && npm run budget
```

The opt-in soak defaults to five minutes, verifies bounded playback resources, performs five exports, and logs heap sizes without asserting on garbage collection. Budgets are 36 MiB compressed for the whole connectome and 40 MiB for all build files except source maps. Already compressed `.gzip` assets count at their stored size. Startup tests require playing status and the first position change within two seconds after circuit loading. Timings supplement measurements on a reference laptop and phone at phase 38. Add `?debug=1` to view resource counts and simulate an interruption.

## Deployment

```sh
npm run build
npm run budget
npm run preview
```

Serve static `dist/` on any static host. There is no backend, database, secret, or runtime upstream connection. Vite's `base: './'` supports root and subdirectory hosting; serve the directory at a URL ending in `/`. Assets and circuit data come from the same origin. The subpath test exercises `/nested/lofly/`; run its fixture with `node scripts/serve-subpath.mjs` on port 4174. Host selection and publication remain deferred until release review.

## Project structure

| Directory | Responsibility |
| --- | --- |
| `src/app/` | Session state, controller, persistence, shortcuts |
| `src/connectome/` | Schema, checksums, graph loading |
| `src/music/` | Seeded streams, traversal, harmony, composition |
| `src/audio/` | Buffers, instruments, timing, live playback, rendering, WAV |
| `src/presets/` | Musical, sound, and visual presets |
| `src/components/`, `src/styles/` | Controls, export, explanation, credits, layout |
| `src/scene/` | Three.js listening room, procedural fly model, and musical animation |
| `public/data/circuits/whole-cns-v1/` | Full traced connectome, compressed adjacency, annotations, and manifest |
| `public/data/circuits/mbon-v1/` | Previous circuit retained for regression checks |
| `scripts/data/` | Locked Python pipeline, config, reports |
| `scripts/` | Budget and subdirectory preview tools |
| `tests/` | Fixtures, data, unit, audio, browser acceptance |
| `docs/` | Ideas, plan, checklist, decisions |

## Credits

Data credit appears above and in the application's Credits section. The listening room is original procedural 3D artwork rendered with Three.js; interface icons use original SVG. Sound is synthesized or generated in code, and fonts are system fonts. Sources and asset paths are in [ASSETS.md](ASSETS.md).

The 3D fly has red compound eyes, a segmented chitin body, bristles, six jointed legs, veined translucent wings, and headphones. Its gentle head bobs and leg grooming follow the existing musical cues. The renderer loads after the circuit data, compiles shaders asynchronously, caps pixel density and rendering at 30 frames per second, and stops rendering when animation is disabled or the tab is hidden. Presets change the room materials and lighting. A still image of the same 3D room appears while it loads, when WebGL is unavailable, or when its context is lost.
