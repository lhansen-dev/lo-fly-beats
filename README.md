# Lo-fly beats

## What it is

A lo-fi beat player starring a fruit fly studying beside an overripe banana. A seeded walk through a verified subset of the MaleCNS connectome selects bass and chord motifs; authored musical rules keep the arrangement coherent. Three presets, a mixer, gentle animation, and eight-bar WAV export run entirely in the browser, without an account.

**Beats to relax / repeatedly fly into the same window to**

## Quick start

Use Node 22 (22.12 or newer) and npm. The circuit is committed; Python and upstream downloads are only needed to regenerate it.

```sh
npm ci
npm run dev
```

Open the URL Vite prints and press **Start listening**.

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
| `data:extract` | `uv run --project scripts/data python scripts/data/extract_circuit.py` | Regenerate circuit and manifest |
| `data:verify` | `uv run --project scripts/data python scripts/data/verify_circuit.py` | Compare export to upstream and write the report |
| `data:validate` | `vitest run --project unit tests/data` | Validate committed data and composition |
| `test:browser` | `playwright test` | Production browser interaction tests |
| `test:audio` | `vitest run --project audio` | Chromium Web Audio rendering tests |
| `test:all` | `npm run check && npm run test:audio && npm run test:browser` | All automated checks |
| `budget` | `node scripts/measure-budgets.mjs` | Measure gzip budgets after building |

## How it works

The app loads 97 real mushroom body output neurons (MBONs) and 936 directed connections with original IDs and synapse counts. A versioned seeded generator walks those connections, weighting choices by their synapse counts and variation. Neuron types select chords and bass motifs within authored harmony and rhythm rules. Drums, keys, timing, and humanization turn the trace into an immutable eight-bar score. Tone.js schedules that score against the audio clock and renders the same score for export. Drum hits, ambience, and the convolution impulse use separate seeded streams.

The musical mapping is authored and does not simulate neural activity. Scene animation and jokes cannot change the score. See the [plan](docs/02-PLAN.md), [implementation contracts and decisions](docs/03-IMPLEMENT.md), and in-app **How the beat is made** panel.

The live MaleCNS scanner displays every neuron and directed connection in the verified circuit. It follows the score's current beat, highlighting the selected neuron, incoming edge, and the last eight traversal steps. The inspector shows the original body ID, synapse count, selection probability, and exact musical uses. Select an elapsed beat in the eight-bar timeline to inspect it; **Follow live beat** returns to playback. Inspection resets when a new phrase begins. The scanner pauses with playback and respects reduced motion, the animation switch, and tab visibility. Its layout groups neurons by soma side; these are schematic positions, not anatomical coordinates or measured neural activity.

## Audio behavior

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

Filtering selects every annotation with `class == "MBON"`, retains connections between selected bodies, removes self-connections, and keeps weights of at least three synapses unchanged. IDs are decimal strings; missing annotations are null. [circuit.json](public/data/circuits/mbon-v1/circuit.json) and [manifest.json](public/data/circuits/mbon-v1/manifest.json) load from the deployment base. The manifest records source checksums, filtering, counts, starts, and circuit SHA-256. The browser verifies exact circuit bytes before building the graph. `data:validate` checks committed files; `data:verify` independently checks all 936 retained weights and annotations against upstream, including 20 reported samples. See the [extraction report](scripts/data/reports/mbon-v1-extraction.md).

## Regenerating the data

Install [uv](https://docs.astral.sh/uv/getting-started/installation/), which manages the locked Python 3.12 environment. From the repository root:

```sh
uv sync --locked --project scripts/data
npm run data:download
npm run data:extract
npm run data:verify
npm run data:validate
```

Downloads and cache require about 1.1 GB, plus Python dependencies and any temporary replacement downloads. Sources remain in ignored `scripts/data/.cache/`; builds use committed JSON. Downloads reuse verified caches and preserve retrieval dates.

Expected results: 97 neurons, 37 types (48 left, 49 right), 936 connections, 25,379 synapses, a 92-neuron strong core, one weak component, five dead ends, and eight starts. Thresholds 1/3/5 retain 1,605/936/682 connections and strong cores of 97/92/82 neurons. Annotations contain 211,577 rows; connections contain 151,856,684 rows in 2,318 Arrow batches. The circuit is 100,029 bytes, SHA-256 `95a7781dac7989cf56a9bcf0383d715569b45d421b0b44d606813bacf825ad3c`.

For a changed circuit, update the config, circuit-specific verifier and metadata, expected tests, relevant R3/R4 values, asset credits, and loader/budget paths if the circuit ID changes. Regenerate and verify both JSON files and the report. Composition rule changes require a mapping version bump. The [data guide](scripts/data/README.md) covers scripts, config, and troubleshooting.

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

The opt-in soak defaults to five minutes, verifies bounded playback resources, performs five exports, and logs heap sizes without asserting on garbage collection. Budgets are 200 KiB gzipped for the circuit and 4 MiB for all build files except source maps. Startup tests require playing status and the first position change within two seconds after circuit loading. Timings supplement measurements on a reference laptop and phone at phase 38. Add `?debug=1` to view resource counts and simulate an interruption.

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
| `src/scene/` | Original SVG illustration and animation |
| `public/data/circuits/mbon-v1/` | Circuit and manifest |
| `scripts/data/` | Locked Python pipeline, config, reports |
| `scripts/` | Budget and subdirectory preview tools |
| `tests/` | Fixtures, data, unit, audio, browser acceptance |
| `docs/` | Ideas, plan, checklist, decisions |

## Credits

Data credit appears above and in the application's Credits section. Artwork is original inline SVG, sound is synthesized or generated in code, and fonts are system fonts. Sources and asset paths are in [ASSETS.md](ASSETS.md).
