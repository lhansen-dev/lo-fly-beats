# Data regeneration

The app uses committed JSON from MaleCNS `male-cns:v1.0`; upstream downloads are optional for development. Install [uv](https://docs.astral.sh/uv/getting-started/installation/) for the locked Python 3.12, pyarrow, pandas, and networkx environment. Run from the repository root:

```sh
uv sync --locked --project scripts/data
npm run data:download
npm run data:extract
npm run data:verify
npm run data:validate
```

## Configuration

Scripts read [config/mbon-v1.json](config/mbon-v1.json) directly; there are no command-line config arguments.

| Field | Meaning |
| --- | --- |
| `circuitId`, `release` | Circuit and upstream release identifiers |
| `baseUrl` | Directory containing source Feather files |
| `files.annotations`, `files.connections` | Source name, exact byte count, base64 MD5 |
| `selection.column`, `selection.equals` | Exact annotation match; currently `class == "MBON"` |
| `minSynapseCount` | Inclusive threshold, currently 3 |
| `compareThresholds` | Manifest comparisons, currently 1, 3, 5 |
| `removeSelfConnections` | Remove source-equals-target rows before thresholding |
| `limits.minNeurons`, `limits.maxNeurons`, `limits.maxConnections` | Reject subsets outside the 32–128 neuron / 2,000 connection bounds |
| `startNeurons.count`, `startNeurons.onePerType` | Eight starts with distinct types in the largest strong component |
| `outputDir` | Repository-relative directory for committed JSON |

Starts rank by descending out-degree, descending outgoing synapse total, then ascending numeric body ID. Records sort by numeric IDs; JSON key order, two-space indentation, UTF-8 encoding, and final newline are stable. Unchanged sources/config regenerate identical bytes.

## Scripts and outputs

| Command | Work and output |
| --- | --- |
| `npm run data:download` | Downloads annotations (14,483,314 bytes) and connections (1,051,241,946 bytes) into `.cache/`. Verifies size/MD5 before replacing cached sources, records dates/SHA-256 in `.cache/retrieval.json`, reuses verified caches, and removes failed `.part` downloads. |
| `uv run --project scripts/data python scripts/data/inspect_sources.py` | Reads annotation and IPC metadata; writes `reports/source-schema.md`. |
| `npm run data:extract` | Selects annotations, scans connection batches, filters/validates pairs, ranks starts, and writes `public/data/circuits/mbon-v1/circuit.json` and `manifest.json` with checksums, attribution, rules, and counts. |
| `npm run data:verify` | Independently compares every annotation and retained weight, complete edge set, counts, thresholds, starts, and source/config/circuit checksums. Writes `reports/mbon-v1-extraction.md`, including 20 samples. |
| `npm run data:validate` | TypeScript validation of committed JSON, composition, and provenance; no source cache needed. |
| `uv run --project scripts/data python -m unittest discover -s scripts/data -p 'test_*.py'` | Regression checks for cache integrity, failed downloads, and metadata inspection. |

About 1.1 GB is needed for downloads/cache, plus dependencies and temporary replacement downloads. Source names are `body-annotations-male-cns-v1.0-minconf-0.5.feather` and `connectome-weights-male-cns-v1.0-minconf-0.5.feather`. Extraction scans 151,856,684 connections in 2,318 Arrow batches; loading the full table into pandas uses much more memory. Cache and virtual environment are ignored by git and excluded from builds.

## Expected results

Pinned in [R3](../../docs/03-IMPLEMENT.md#r3-source-data-facts) and the [report](reports/mbon-v1-extraction.md):

| Measure | Value |
| --- | --- |
| Annotation rows | 211,577 |
| Connection rows / batches | 151,856,684 / 2,318 |
| Neurons / types | 97 / 37; all Traced; 48 left and 49 right |
| Selected upstream pairs | 1,606 including one weight-1 self-connection |
| Retained connections / synapses | 936 / 25,379 |
| Strong core / weak components / isolated neurons | 92 / 1 / 0 |
| Dead ends | Five: four MBON10, one MBON15 |
| Out-degree median / p90 / maximum | 7 / 22 / 41 |
| Starts | `10704`, `519373`, `10013`, `13768`, `10495`, `522749`, `21242`, `513174` |
| Example | `10013` is right MBON01; `10013` → `10495` has 16 synapses |
| Circuit bytes / SHA-256 | 100,029 / `95a7781dac7989cf56a9bcf0383d715569b45d421b0b44d606813bacf825ad3c` |

| Threshold | Connections without self-connections | Strong core | Dead ends |
| --- | --- | --- | --- |
| ≥1 | 1,605 | 97 | 0 |
| ≥3 | 936 | 92 | 5 |
| ≥5 | 682 | 82 | 11 |

Original IDs and weights are preserved. Source MD5 values are `UKdxh3DFciDxYLpPQxq4ng==` (annotations) and `8w6dzKJc/QIb8eez2XVZng==` (connections); SHA-256 values are in the manifest/report.

## Selecting another circuit

Edit selection, threshold, limits, starts, and output in the config and rerun the pipeline. The current metadata and independent verifier are MBON-specific: also update the verifier's selection, fixed output path, threshold expectations, and extractor title, description, and filtering/attribution strings for a new selection. Update the recorded config path if renamed. Check schema and licensing for different source releases.

After independent verification, update tests' expected values and R3/R4, regenerate both JSON files and reports, and update `ASSETS.md`. A changed output directory also requires loader paths in `src/main.tsx` / `src/connectome/load.ts`, data-test paths, and the budget's circuit path. Composition rule changes require a mapping version bump and updated snapshots.

## Troubleshooting

- **Checksum mismatch:** delete the affected cached source and run `npm run data:download` again. Investigate before changing expected checksums. Regenerate committed circuit/config output if needed and verify upstream evidence.
- **Missing cache/metadata:** run `npm run data:download` before extraction; do not invent retrieval dates.
- **Dependency/import errors:** run `uv sync --locked --project scripts/data` and invoke Python through `uv run --project scripts/data`.
- **Unexpected counts/schema:** check release, file names, selection, threshold, source schema report, and R3 before accepting changed values.
- **Memory pressure:** keep batch-wise Arrow scanning; avoid loading the connections table into pandas.

Source: [MaleCNS downloads](https://male-cns.janelia.org/download/), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Collaboration credit and citation links appear in the root [README](../../README.md#data), [manifest](../../public/data/circuits/mbon-v1/manifest.json), and [ASSETS.md](../../ASSETS.md).
