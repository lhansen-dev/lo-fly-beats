"""Extract the fly's song brain: ear (Johnston's organ) to wing-song circuit, with transmitter signs.

Reads the committed whole-CNS assets plus the upstream body-neurotransmitter predictions, and writes
public/data/circuits/song-v1/{brain.json.gzip,manifest.json}. Selection is deterministic.
"""

import gzip
import hashlib
import io
import json
import re
from pathlib import Path

import numpy as np
import pandas as pd

DATA_DIR = Path(__file__).resolve().parent
ROOT = DATA_DIR.parent.parent
CONFIG_PATH = DATA_DIR / 'config/song-v1.json'
WHOLE = ROOT / 'public/data/circuits/whole-cns-v1'


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def stable_gzip(data: bytes) -> bytes:
    buffer = io.BytesIO()
    with gzip.GzipFile(fileobj=buffer, mode='wb', compresslevel=9, mtime=0, filename='') as handle:
        handle.write(data)
    return buffer.getvalue()


def top_by(scores: np.ndarray, count: int, exclude: np.ndarray) -> np.ndarray:
    scores = scores.copy()
    scores[exclude] = 0
    # Stable tie-break by index keeps the selection deterministic.
    order = np.lexsort((np.arange(len(scores)), -scores))[:count]
    mask = np.zeros(len(scores), bool)
    mask[order[scores[order] > 0]] = True
    return mask


def main() -> None:
    config_bytes = CONFIG_PATH.read_bytes()
    config = json.loads(config_bytes)
    whole_manifest = json.loads((WHOLE / 'manifest.json').read_text())
    neurons_gz = (WHOLE / 'neurons.json.gzip').read_bytes()
    adjacency_gz = (WHOLE / 'adjacency.bin.gzip').read_bytes()
    require(sha256(neurons_gz) == whole_manifest['output']['sha256'], 'Whole-CNS annotations checksum mismatch')
    require(sha256(adjacency_gz) == whole_manifest['output']['adjacency']['sha256'], 'Whole-CNS adjacency checksum mismatch')
    neurons = json.loads(gzip.decompress(neurons_gz))['neurons']
    words = np.frombuffer(gzip.decompress(adjacency_gz), dtype='<u4')
    count, edge_count = int(words[1]), int(words[2])
    require(count == len(neurons), 'Neuron count mismatch')
    offsets = words[5:5 + count + 1].astype(np.int64)
    targets = words[5 + count + 1:5 + count + 1 + edge_count].astype(np.int64)
    weights = words[5 + count + 1 + edge_count:].astype(np.float64)
    sources = np.repeat(np.arange(count), np.diff(offsets))

    nt_spec = config['neurotransmitters']
    nt_path = DATA_DIR / '.cache' / nt_spec['name']
    require(nt_path.is_file(), f'Missing {nt_path}; download {nt_spec["url"]}')
    nt_bytes = nt_path.read_bytes()
    require(len(nt_bytes) == nt_spec['bytes'], 'Neurotransmitter file size mismatch')
    import base64
    require(base64.b64encode(hashlib.md5(nt_bytes).digest()).decode() == nt_spec['md5Base64'], 'Neurotransmitter MD5 mismatch')
    nt_table = pd.read_feather(nt_path)[['body', 'consensus_nt']]
    nt_by_id = dict(zip(nt_table.body.astype(str), nt_table.consensus_nt))

    types = [neuron['type'] or '' for neuron in neurons]
    superclasses = [neuron['superclass'] or '' for neuron in neurons]
    sel = config['selection']
    ear = np.array([bool(re.match(sel['earTypePattern'], t)) for t in types])
    song = np.array([bool(re.match(sel['songTypePattern'], t)) for t in types])

    def forward(mask: np.ndarray) -> np.ndarray:
        chosen = mask[sources]
        return np.bincount(targets[chosen], weights=weights[chosen], minlength=count)

    def backward(mask: np.ndarray) -> np.ndarray:
        chosen = mask[targets]
        return np.bincount(sources[chosen], weights=weights[chosen], minlength=count)

    auditory1 = top_by(forward(ear), sel['auditoryHop1'], ear)
    auditory2 = top_by(forward(ear | auditory1), sel['auditoryHop2'], ear | auditory1)
    premotor1 = top_by(backward(song), sel['premotorHop1'], song)
    premotor2 = top_by(backward(song | premotor1), sel['premotorHop2'], song | premotor1)
    sensory = np.array([s in set(sel['wingSenseSuperclasses']) for s in superclasses])
    to_song = song[targets] & sensory[sources]
    wing_scores = np.bincount(sources[to_song], weights=weights[to_song], minlength=count)
    wing = top_by(wing_scores, sel['wingSenseCount'], ear | song)
    selected = ear | wing | auditory1 | auditory2 | song | premotor1 | premotor2
    limits = config['limits']
    require(limits['minNeurons'] <= selected.sum() <= limits['maxNeurons'], f'Neuron count {selected.sum()} outside limits')

    order = sorted(np.flatnonzero(selected), key=lambda index: int(neurons[index]['id']))
    local = {int(index): position for position, index in enumerate(order)}
    keep = selected[sources] & selected[targets] & (weights >= config['minSynapseCount'])
    edge_rows = sorted(zip((local[int(s)] for s in sources[keep]), (local[int(t)] for t in targets[keep]), weights[keep].astype(int)))
    require(len(edge_rows) <= limits['maxConnections'], 'Too many connections')

    motor_classes = set(sel['motorSuperclasses'])
    signs = config['transmitterSigns']
    out_neurons = []
    role_counts: dict[str, int] = {}
    nt_counts: dict[str, int] = {}
    for index in order:
        neuron = neurons[index]
        if ear[index]:
            role = 'ear'
        elif wing[index]:
            role = 'wing'
        elif superclasses[index] in motor_classes:
            role = 'motor'
        elif song[index]:
            role = 'song'
        elif auditory1[index] or auditory2[index]:
            role = 'auditory'
        else:
            role = 'premotor'
        nt = nt_by_id.get(neuron['id'])
        nt = None if nt is None or (isinstance(nt, float) and np.isnan(nt)) or nt == 'unclear' else str(nt)
        require(nt is None or nt in signs, f'Unknown transmitter {nt}')
        anatomy = neuron.get('anatomy') or {}
        out_neurons.append({
            'id': neuron['id'], 'type': neuron['type'], 'instance': neuron['instance'], 'superclass': neuron['superclass'],
            'role': role, 'nt': nt, 'soma': anatomy.get('somaLocation') or anatomy.get('tosomaLocation'),
        })
        role_counts[role] = role_counts.get(role, 0) + 1
        nt_counts[nt or 'unknown'] = nt_counts.get(nt or 'unknown', 0) + 1

    brain = {
        'schemaVersion': 1,
        'circuitId': config['circuitId'],
        'neurons': out_neurons,
        'edges': {
            'source': [row[0] for row in edge_rows],
            'target': [row[1] for row in edge_rows],
            'synapses': [int(row[2]) for row in edge_rows],
        },
    }
    raw = (json.dumps(brain, separators=(',', ':'), ensure_ascii=False) + '\n').encode()
    compressed = stable_gzip(raw)
    out_dir = ROOT / config['outputDir']
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / 'brain.json.gzip').write_bytes(compressed)
    manifest = {
        'schemaVersion': 1,
        'circuitId': config['circuitId'],
        'title': config['title'],
        'description': config['description'],
        'source': {
            'dataset': whole_manifest['source']['dataset'],
            'release': whole_manifest['source']['release'],
            'citation': whole_manifest['source']['citation'],
            'derivedFrom': {'circuitId': whole_manifest['circuitId'], 'graphSha256': whole_manifest['output']['graphSha256']},
            'neurotransmitters': {**nt_spec, 'sha256': sha256(nt_bytes), 'column': 'consensus_nt'},
        },
        'license': {
            'name': 'CC BY 4.0', 'url': 'https://creativecommons.org/licenses/by/4.0/',
            'attribution': 'Connectome and neurotransmitter predictions from MaleCNS male-cns:v1.0 by FlyEM (HHMI Janelia), the University of Cambridge, the MRC Laboratory of Molecular Biology, and Google Research, licensed CC BY 4.0. Filtered to an ear-to-song subcircuit.',
        },
        'extraction': {
            'script': 'scripts/data/extract_song_circuit.py',
            'config': 'scripts/data/config/song-v1.json',
            'configSha256': sha256(config_bytes),
            'rules': config['rules'],
        },
        'counts': {
            'neurons': len(out_neurons), 'connections': len(edge_rows),
            'synapses': int(sum(row[2] for row in edge_rows)), 'roles': dict(sorted(role_counts.items())),
            'transmitters': dict(sorted(nt_counts.items())),
        },
        'output': {'file': 'brain.json.gzip', 'bytes': len(compressed), 'sha256': sha256(compressed), 'uncompressedBytes': len(raw)},
    }
    (out_dir / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + '\n')
    print(json.dumps(manifest['counts'], indent=2))
    print('bytes', len(compressed))


if __name__ == '__main__':
    main()
