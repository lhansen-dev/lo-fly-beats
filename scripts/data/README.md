# Data regeneration

The application uses the complete traced MaleCNS `male-cns:v1.0` connectome, including the brain and ventral nerve cord. Committed compressed assets allow development without Python or upstream downloads. Install [uv](https://docs.astral.sh/uv/getting-started/installation/) to regenerate them with the locked Python 3.12, pyarrow, pandas, and networkx environment:

```sh
uv sync --locked --project scripts/data
npm run data:download
npm run data:extract
npm run data:verify
npm run data:validate
```

Run these commands from the repository root. Downloads and cache need about 1.1 GB; allow additional space for the Python environment, extraction arrays, and the 35 MB committed export. The connection table is scanned in Arrow batches instead of loading 151 million rows into pandas.

## Selection and configuration

[config/whole-cns-v1.json](config/whole-cns-v1.json) is the active configuration.

| Field | Meaning |
| --- | --- |
| `circuitId`, `release` | `whole-cns-v1`, `male-cns:v1.0` |
| `baseUrl`, `files` | Source locations, exact sizes, and base64 MD5 checksums |
| `selection.column`, `selection.equals` | Every body with `status == "Traced"`; no class or type restriction |
| `minSynapseCount` | Inclusive threshold, currently 3, preserving the previous music graph's threshold |
| `compareThresholds` | The retained threshold only; component analysis is omitted for the full graph |
| `removeSelfConnections` | Required to be true; self-connections meeting the threshold are counted and removed |
| `limits` | 150,000–250,000 neurons and at most 20 million retained connections |
| `startNeurons.allWithOutgoing` | Every neuron with a retained outgoing connection is an eligible phrase start |
| `outputDir` | `public/data/circuits/whole-cns-v1` |

Traced neurons without cell-type annotations remain included. Glia and unfinished or untraced bodies are excluded using the upstream status field. Connections require both endpoints in the selected neuron set. Every qualifying connection is exported with its original weight; there is no sampling, strongest-edge selection, or per-neuron edge cap. Numeric IDs and adjacency rows sort in ascending numeric order. Missing annotations are null.

## Scripts

| Command | Result |
| --- | --- |
| `npm run data:download` | Verifies cached sources by size and MD5, preserves retrieval dates, and records SHA-256. Replaces sources only after successful verification. |
| `npm run data:extract` | Runs `extract_whole_cns.py`, validates sources, selects all traced annotations, scans connection batches, rejects duplicate pairs, sorts compact adjacency, and writes both assets and the manifest. |
| `npm run data:verify` | Runs `verify_whole_cns.py`, independently selects source annotations with Arrow and locates edges with NumPy binary searches. Compares every annotation, retained pair, and weight, both source and output checksums, counts, and starts; writes [the report](reports/whole-cns-v1-extraction.md). |
| `npm run data:validate` | TypeScript validation of committed assets, graph integrity, traversal, composition, and provenance; no source cache needed. |
| `uv run --project scripts/data python -m unittest discover -s scripts/data -p 'test_*.py'` | Source-tool regression checks for downloads, cache integrity, and IPC metadata inspection. |
| `uv run --project scripts/data python scripts/data/inspect_sources.py` | Writes [source-schema.md](reports/source-schema.md); its MBON section describes the original subset. |

Source filenames remain `body-annotations-male-cns-v1.0-minconf-0.5.feather` (14,483,314 bytes) and `connectome-weights-male-cns-v1.0-minconf-0.5.feather` (1,051,241,946 bytes). Source caches and virtual environments are ignored by git and excluded from builds.

## Export format

The version-2 manifest describes two gzip-compressed files:

- `neurons.json.gzip`: UTF-8 JSON containing `schemaVersion: 2`, `circuitId`, and original neuron annotation records.
- `adjacency.bin.gzip`: `csr-u32-le-v1` compressed sparse rows. All words are unsigned 32-bit little-endian integers. The five-word header contains magic `0x3242464c` (`LFB2`), neuron count, edge count, synapse threshold, and a reserved zero. It is followed by `neuronCount + 1` row offsets, `edgeCount` target indices, and `edgeCount` original weights. Targets index the sorted annotation array.

The browser verifies each compressed file's exact byte count and SHA-256, then decompresses it with `DecompressionStream`. Assets deliberately use `.gzip` rather than `.gz`, because some static servers automatically add `Content-Encoding: gzip` to `.gz` files and cause browsers to decode them before integrity checks. Serve these files as ordinary binary assets; their contents are explicitly decoded by the application.

The graph fingerprint is SHA-256 of the UTF-8 string `annotations SHA-256:adjacency SHA-256`. It covers both annotation and connectivity changes. The full adjacency stays in typed arrays; at most 128 outgoing rows are cached as objects. Starts are derived from every nonempty row, so the manifest's `startNeuronIds` is empty. Dead ends rest until the next bar and restart from that same eligible pool. Strong/weak component counts are omitted; starts are not limited to one core or a small list of hubs.

Gzip timestamps are zero and serialization is stable. Regenerating from the same sources, config, and locked environment produces identical assets.

## Expected results

| Measure | Value |
| --- | --- |
| Neurons / cell types | 165,122 / 11,751 |
| Directed connections / synapses | 10,510,984 / 104,213,241 |
| Dead ends / eligible starts | 3,442 / 161,680 |
| Removed self-connections at threshold | 54 |
| Compressed annotations / adjacency | 1,280,213 / 33,799,576 bytes |
| Uncompressed adjacency | 84,748,384 bytes |
| Graph fingerprint | `466714bc473d63e3368fd19f2abd6255db625e97bc4c295e9f94a9d35dda0f59` |

The scanner plots every neuron but reduces background links to at most 1,200 representative connections. Its current and recent paths always use exact edges from the full graph. That display reduction does not affect music, totals, or exported data.

## Previous circuit and changed data

The original [MBON config](config/mbon-v1.json), `extract_circuit.py`, `verify_circuit.py`, and `public/data/circuits/mbon-v1/` remain for regression checks. The old extractor/verifier can be run directly through `uv run --project scripts/data python`; application loading and npm extraction commands use the whole connectome.

For changes to the full graph, regenerate both assets and the manifest, independently verify them, and update expected values, the report, README, and asset credits. Keep loader paths and size budgets synchronized with renamed outputs. Composition rule changes require a mapping version bump; expanding the dataset changes its fingerprint while preserving the existing musical rules.

## Troubleshooting

- **Source checksum mismatch:** remove the affected cached file and run `npm run data:download`. Investigate discrepancies before changing expected checksums.
- **Browser checksum mismatch:** confirm both assets match their manifest and are served without implicit gzip decoding. Rebuild if outputs changed.
- **Missing retrieval metadata:** run `npm run data:download`; do not invent retrieval dates.
- **Dependency errors:** run `uv sync --locked --project scripts/data` and invoke Python through uv.
- **Unexpected counts:** check the source release, status selection, and synapse threshold before accepting results.
- **Memory pressure:** preserve Arrow batch scanning and typed-array adjacency; avoid loading all source connections into pandas or materializing all outgoing rows at once.

Source: [MaleCNS downloads](https://male-cns.janelia.org/download/), licensed [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Attribution appears in the manifest, root README, and [ASSETS.md](../../ASSETS.md).
