# Whole MaleCNS extraction report

Verified independently against the cached upstream sources by `scripts/data/verify_whole_cns.py`.

Dataset: male-cns:v1.0. Retrieved 2026-09-19.

Connectome data from MaleCNS male-cns:v1.0 by FlyEM (HHMI Janelia), the University of Cambridge, the MRC Laboratory of Molecular Biology, and Google Research, licensed CC BY 4.0. Includes all traced neurons across the brain and ventral nerve cord; connections contain at least 3 synapses.

## Selection

- Selected every annotated body with status Traced, across all neuron classes, including untyped neurons.
- Glia, unfinished fragments, and untraced bodies are excluded using the upstream status annotation.
- Kept every connection between selected bodies with at least 3 synapses; original weights are unchanged.
- Removed self-connections that meet the synapse threshold; rejected duplicate pairs.
- Preserved original decimal body IDs and annotations; missing annotations are null.
- Preserved somaLocation and tosomaLocation in original 8nm voxel coordinates, plus neuromere, subclass, side, and entry/exit nerve annotations for anatomy views.
- Stored every retained connection in sorted compressed sparse rows, without sampling or per-neuron edge caps.

## Verified counts

| Measure | Value |
| --- | --- |
| neurons | 165,122 |
| cellTypes | 11,751 |
| connections | 10,510,984 |
| synapses | 104,213,241 |
| deadEnds | 3,442 |
| Eligible phrase starts | 161,680 |
| Removed self-connections at threshold | 54 |

## Integrity

Graph fingerprint: `ad42e3e52de41c931f79d4cbcc218f59f438387fec6a2abae8df7cc7046ca0cb` (SHA-256 of `annotations SHA-256:adjacency SHA-256`).
Config SHA-256: `55b32ab7d37f4b77bb08e4ae9178975f2f8f0d52b80119fe5275f8a0a317b85a`.

- body-annotations-male-cns-v1.0-minconf-0.5.feather: 14,483,314 bytes; SHA-256 `2177e246113e4cfbf1e7772ec37c6da1955ff22e8063d0b1f833101f99a9a3b2`.
- connectome-weights-male-cns-v1.0-minconf-0.5.feather: 1,051,241,946 bytes; SHA-256 `e35da783d1c686b2b58b3b87cd6a403ae43bfcfba8bff28e08ef752c1a56afc1`.
- neurons.json.gzip: 3,205,690 bytes; SHA-256 `caa5c519106b0af075ef870b51ed9193dac0f33c91862ed407a23b9ec1078361`.
- adjacency.bin.gzip: 33,799,576 bytes; SHA-256 `19fb04b8d99f6f21d4918a70a06c536df631bee5f908bc8080b3b151610ae6e6`.

## Sample connections

All retained connections and weights were checked; these evenly spaced examples are provided for review.

| Source ID | Target ID | Synapses |
| --- | --- | --- |
| 10001 | 10091 | 5 |
| 11118 | 525960 | 3 |
| 13558 | 15732 | 5 |
| 17468 | 28312 | 31 |
| 22560 | 109208 | 3 |
| 28991 | 54611 | 6 |
| 37040 | 165025 | 8 |
| 46090 | 114281 | 12 |
| 56111 | 42650 | 6 |
| 67415 | 47310 | 3 |
| 80081 | 35298 | 11 |
| 95069 | 35392 | 3 |
| 113844 | 34745 | 6 |
| 138492 | 89716 | 3 |
| 213235 | 71628 | 3 |
| 520520 | 549378 | 3 |
| 539786 | 115499 | 14 |
| 802304 | 805108 | 7 |
| 811976 | 805363 | 5 |
| 1471062202 | 1053002338 | 3 |

All 165,122 annotation records and 10,510,984 directed connections match upstream exactly. No connections were sampled or capped in the exported graph.

Strong/weak component counts are not computed for this export; starts cover every neuron with retained outgoing connections.
