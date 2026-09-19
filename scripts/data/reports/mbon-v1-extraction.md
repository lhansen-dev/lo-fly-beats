# MBON v1 extraction report

Verified independently by `scripts/data/verify_circuit.py` against the cached upstream files.

## Source files and checksums

Dataset: MaleCNS `male-cns:v1.0`. Retrieved 2026-09-19.

[Download page](https://male-cns.janelia.org/download/). Connectome data from MaleCNS male-cns:v1.0 by FlyEM (HHMI Janelia), the University of Cambridge, the MRC Laboratory of Molecular Biology, and Google Research, licensed CC BY 4.0. Filtered to mushroom body output neurons and connections with at least 3 synapses.

[License](https://creativecommons.org/licenses/by/4.0/).

Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2025). Sexual dimorphism in the complete connectome of the Drosophila male central nervous system. bioRxiv. https://doi.org/10.1101/2025.10.09.680999

[Published paper](https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6).

- [body-annotations-male-cns-v1.0-minconf-0.5.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/body-annotations-male-cns-v1.0-minconf-0.5.feather): 14,483,314 bytes; MD5 (base64) `UKdxh3DFciDxYLpPQxq4ng==`; SHA-256 `2177e246113e4cfbf1e7772ec37c6da1955ff22e8063d0b1f833101f99a9a3b2`.
- [connectome-weights-male-cns-v1.0-minconf-0.5.feather](https://storage.googleapis.com/flyem-male-cns/v1.0/connectome-data/flat-connectome/connectome-weights-male-cns-v1.0-minconf-0.5.feather): 1,051,241,946 bytes; MD5 (base64) `8w6dzKJc/QIb8eez2XVZng==`; SHA-256 `e35da783d1c686b2b58b3b87cd6a403ae43bfcfba8bff28e08ef752c1a56afc1`.

Circuit: 100,029 bytes; SHA-256 `95a7781dac7989cf56a9bcf0383d715569b45d421b0b44d606813bacf825ad3c`.

Config SHA-256: `56b41fcc0a01db1e4316a02f26764ca20e55456bc0d8f02b34bf67446ac2131d`.

## Selection and filtering

- Selected every body whose annotation class is MBON.
- Kept connections whose source and target are both selected bodies.
- Removed self-connections before applying the synapse threshold.
- Kept connections with at least 3 synapses; synapseCount is the upstream weight value, unchanged.
- Rejected duplicate pairs, missing endpoints, and non-positive counts.
- Recorded missing annotation values as null.

All 97 exported annotation records match the source. Original IDs and annotations are in [circuit.json](../../../public/data/circuits/mbon-v1/circuit.json).

There are 1,606 selected upstream pairs before filtering; 1 self-connection is removed. The complete retained connection set and all weights match the export.

## Counts

| Measure | Value |
| --- | --- |
| neurons | 97 |
| cellTypes | 37 |
| connections | 936 |
| synapses | 25,379 |
| largestStronglyConnected | 92 |
| weaklyConnectedComponents | 1 |
| deadEnds | 5 |

## Threshold comparison

| Minimum synapses | Connections | Largest strong component | Dead ends |
| --- | --- | --- | --- |
| 1 | 1605 | 97 | 0 |
| 3 | 936 | 92 | 5 |
| 5 | 682 | 82 | 11 |

## Degree distributions

Percentiles use linear interpolation across all selected neurons, including dead ends.

| Degree | Minimum | Median | 90th percentile | Maximum |
| --- | --- | --- | --- | --- |
| In | 2 | 9 | 17 | 20 |
| Out | 0 | 7 | 22 | 41 |

## Dead ends

| ID | Type | Side |
| --- | --- | --- |
| 39608 | MBON10 | L |
| 49262 | MBON10 | R |
| 520395 | MBON15 | L |
| 558665 | MBON10 | R |
| 579919 | MBON10 | R |

## Connected components

Weak component sizes: 97. Isolated neurons: 0.

Strong component sizes: 92, 1, 1, 1, 1, 1.

Singleton strong components: 39608, 49262, 520395, 558665, 579919.

## Starting neurons

Within the largest strongly connected component, order neurons by out-degree (descending), total outgoing synapses (descending), and numeric ID (ascending); take the first neuron of each type until 8 are chosen.

| ID | Type | Side | Out-degree | Outgoing synapses |
| --- | --- | --- | --- | --- |
| 10704 | MBON11 | L | 41 | 1093 |
| 519373 | MBON03 | L | 27 | 727 |
| 10013 | MBON01 | R | 26 | 851 |
| 13768 | MBON12 | L | 25 | 283 |
| 10495 | MBON05 | R | 24 | 1541 |
| 522749 | MBON02 | L | 24 | 718 |
| 21242 | MBON09 | R | 22 | 945 |
| 513174 | MBON30 | L | 22 | 834 |

## Upstream connection samples

Five highest weights, five lowest weights (numeric ID tie breaks), then file positions 0, 100, …, 900. Duplicates are replaced with unused connections in file order.

| Source | Target | Upstream weight | Exported synapseCount |
| --- | --- | --- | --- |
| 10495 | 513174 | 583 | 583 |
| 519371 | 515015 | 481 | 481 |
| 519131 | 524893 | 283 | 283 |
| 11402 | 523987 | 267 | 267 |
| 11455 | 11176 | 259 | 259 |
| 10013 | 521086 | 3 | 3 |
| 10013 | 523043 | 3 | 3 |
| 10079 | 18713 | 3 | 3 |
| 10079 | 513387 | 3 | 3 |
| 10495 | 10079 | 3 | 3 |
| 10013 | 10495 | 16 | 16 |
| 10704 | 31016 | 17 | 17 |
| 11402 | 525780 | 5 | 5 |
| 13728 | 13768 | 9 | 9 |
| 19366 | 18603 | 8 | 8 |
| 92112 | 10826 | 12 | 12 |
| 514853 | 187741 | 11 | 11 |
| 519373 | 13728 | 26 | 26 |
| 521526 | 524893 | 4 | 4 |
| 524893 | 11805 | 24 | 24 |

20 of 20 sample counts match; 97 of 97 annotation records match; full connection sets and all retained weights match.

## Regeneration

From the repository root with Node 22 and uv installed:

```sh
uv sync --locked --project scripts/data
npm run data:download
uv run --project scripts/data python scripts/data/inspect_sources.py
npm run data:extract
npm run data:verify
```

The bulk source files stay in the ignored `scripts/data/.cache/` directory. Application builds use the committed JSON files.
