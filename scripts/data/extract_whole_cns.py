"""Export every traced MaleCNS neuron with compact, complete sorted adjacency."""

import gzip
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.ipc as ipc

from download_sources import matches
from extract_circuit import FIELDS, ROOT, DATA_DIR, require, write_json

CONFIG_PATH = DATA_DIR / 'config/whole-cns-v1.json'
MAGIC = 0x3242464C
ANATOMY_FIELDS = ('somaNeuromere', 'subclass', 'rootSide', 'entryNerve', 'exitNerve')


def export_neuron(row: dict) -> dict:
    """Keep original voxel coordinates and body annotations, including missing values."""
    return {
        'id': str(row['bodyId']),
        **{field: None if pd.isna(row[field]) else row[field] for field in FIELDS},
        'anatomy': {
            **{field: None if row[field] is None else [int(value) for value in row[field]]
               for field in ('somaLocation', 'tosomaLocation')},
            **{field: None if pd.isna(row[field]) else row[field] for field in ANATOMY_FIELDS},
        },
    }


def main() -> None:
    config_bytes = CONFIG_PATH.read_bytes()
    config = json.loads(config_bytes)
    retrieval = json.loads((DATA_DIR / '.cache/retrieval.json').read_text())
    paths = {role: DATA_DIR / '.cache' / spec['name'] for role, spec in config['files'].items()}
    for role, path in paths.items():
        require(matches(path, config['files'][role]), f'Unverified source {path}; run npm run data:download')
        require(path.name in retrieval, f'Missing retrieval record for {path.name}')
    annotations = pd.read_feather(paths['annotations'])
    selection = config['selection']
    selected = annotations[annotations[selection['column']] == selection['equals']].sort_values('bodyId')
    require(selected.bodyId.is_unique and selected.bodyId.notna().all(), 'Non-unique or missing body IDs')
    ids = pa.array(selected.bodyId, type=pa.int64())
    require(config['limits']['minNeurons'] <= len(ids) <= config['limits']['maxNeurons'], 'Neuron count outside limits')
    neurons = [export_neuron(row) for row in selected.to_dict('records')]
    sources, targets, weights = [], [], []
    self_connections = 0
    threshold = config['minSynapseCount']
    require(config['removeSelfConnections'] and config['startNeurons'] == {'allWithOutgoing': True}, 'Whole-CNS export requires removed self-connections and all eligible starts')
    require(config['compareThresholds'] == [threshold], 'Whole-CNS comparison must match the retained threshold')
    with pa.memory_map(str(paths['connections']), 'r') as source:
        reader = ipc.open_file(source)
        for field in ('body_pre', 'body_post', 'weight'):
            require(pa.types.is_integer(reader.schema.field(field).type), f'Non-integer {field}')
        for index in range(reader.num_record_batches):
            batch = reader.get_batch(index)
            batch = batch.filter(pc.greater_equal(batch.column('weight'), threshold))
            if not batch.num_rows:
                continue
            pre = pc.fill_null(pc.index_in(batch.column('body_pre'), value_set=ids), -1).to_numpy()
            post = pc.fill_null(pc.index_in(batch.column('body_post'), value_set=ids), -1).to_numpy()
            counts = batch.column('weight').to_numpy()
            valid = (pre >= 0) & (post >= 0)
            self_connections += int(np.count_nonzero(valid & (pre == post)))
            keep = valid & (pre != post)
            require(np.all(counts[keep] <= np.iinfo(np.uint32).max), 'Weight exceeds uint32 range')
            sources.append(pre[keep].astype(np.uint32))
            targets.append(post[keep].astype(np.uint32))
            weights.append(counts[keep].astype(np.uint32))
            if index % 250 == 0:
                print(f'Scanned batch {index + 1}/{reader.num_record_batches}', flush=True)
    source_indices, target_indices, synapse_counts = map(np.concatenate, (sources, targets, weights))
    del sources, targets, weights
    require(len(target_indices) <= config['limits']['maxConnections'], 'Connection count outside limits')
    keys = (source_indices.astype(np.uint64) << 32) | target_indices
    order = np.argsort(keys)
    sorted_keys = keys[order]
    require(np.all(sorted_keys[1:] > sorted_keys[:-1]), 'Duplicate connection pairs')
    del keys, sorted_keys
    degrees = np.bincount(source_indices, minlength=len(ids))
    offsets = np.concatenate(([0], np.cumsum(degrees))).astype('<u4')
    target_indices = target_indices[order].astype('<u4')
    synapse_counts = synapse_counts[order].astype('<u4')
    del source_indices, order
    counts = {
        'neurons': len(neurons), 'cellTypes': selected.type.nunique(),
        'connections': len(target_indices), 'synapses': int(synapse_counts.sum(dtype=np.uint64)),
        'deadEnds': int(np.count_nonzero(degrees == 0)),
    }
    output_dir = ROOT / config['outputDir']
    output_dir.mkdir(parents=True, exist_ok=True)
    neuron_bytes = gzip.compress((json.dumps({'schemaVersion': 2, 'circuitId': config['circuitId'], 'neurons': neurons}, separators=(',', ':'), ensure_ascii=False) + '\n').encode(), mtime=0)
    (output_dir / 'neurons.json.gzip').write_bytes(neuron_bytes)
    header = np.array([MAGIC, len(ids), len(target_indices), threshold, 0], dtype='<u4')
    binary_size = header.nbytes + offsets.nbytes + target_indices.nbytes + synapse_counts.nbytes
    with (output_dir / 'adjacency.bin.gzip').open('wb') as output:
        with gzip.GzipFile(filename='', mode='wb', fileobj=output, mtime=0) as compressed:
            for array in (header, offsets, target_indices, synapse_counts):
                compressed.write(memoryview(array))
    legacy = json.loads((ROOT / 'public/data/circuits/mbon-v1/manifest.json').read_text())
    manifest = {
        'schemaVersion': 2, 'circuitId': config['circuitId'],
        'title': 'The whole MaleCNS connectome',
        'description': f'Every traced neuron across the MaleCNS v1.0 brain and ventral nerve cord, with every directed connection among them containing at least {threshold} synapses.',
        'source': {**legacy['source'], 'retrievedOn': max(retrieval[path.name]['retrievedOn'] for path in paths.values()), 'files': [
            {'role': role, **spec, 'url': config['baseUrl'] + spec['name'], 'sha256': retrieval[spec['name']]['sha256']}
            for role, spec in config['files'].items()
        ]},
        'license': {**legacy['license'], 'attribution': f'Connectome data from MaleCNS male-cns:v1.0 by FlyEM (HHMI Janelia), the University of Cambridge, the MRC Laboratory of Molecular Biology, and Google Research, licensed CC BY 4.0. Includes all traced neurons across the brain and ventral nerve cord; connections contain at least {threshold} synapses.'},
        'extraction': {
            'script': 'scripts/data/extract_whole_cns.py', 'scriptVersion': 2,
            'config': str(CONFIG_PATH.relative_to(ROOT)), 'configSha256': hashlib.sha256(config_bytes).hexdigest(),
            'neuronSelection': 'annotations.status == "Traced" (all neuron classes)',
            'minSynapseCount': threshold, 'selfConnectionsRemoved': self_connections,
            'rules': [
                'Selected every annotated body with status Traced, across all neuron classes, including untyped neurons.',
                'Glia, unfinished fragments, and untraced bodies are excluded using the upstream status annotation.',
                f'Kept every connection between selected bodies with at least {threshold} synapses; original weights are unchanged.',
                'Removed self-connections that meet the synapse threshold; rejected duplicate pairs.',
                'Preserved original decimal body IDs and annotations; missing annotations are null.',
                'Preserved somaLocation and tosomaLocation in original 8nm voxel coordinates, plus neuromere, subclass, side, and entry/exit nerve annotations for anatomy views.',
                'Stored every retained connection in sorted compressed sparse rows, without sampling or per-neuron edge caps.',
            ],
            'thresholdComparison': [{'minSynapseCount': threshold, 'connections': counts['connections'], 'deadEnds': counts['deadEnds']}],
            'startNeuronRule': 'Choose uniformly from every selected neuron with at least one outgoing connection; dead ends rest until the next bar, then restart from the same whole-connectome pool.',
        },
        'counts': counts, 'startNeuronIds': [],
        'output': {
            'file': 'neurons.json.gzip', 'bytes': len(neuron_bytes), 'sha256': hashlib.sha256(neuron_bytes).hexdigest(),
            'adjacency': {
                'file': 'adjacency.bin.gzip', 'encoding': 'csr-u32-le-v1',
                'bytes': (output_dir / 'adjacency.bin.gzip').stat().st_size,
                'sha256': hashlib.sha256((output_dir / 'adjacency.bin.gzip').read_bytes()).hexdigest(),
                'uncompressedBytes': binary_size,
            },
        },
    }
    manifest['output']['graphSha256'] = hashlib.sha256(f"{manifest['output']['sha256']}:{manifest['output']['adjacency']['sha256']}".encode()).hexdigest()
    write_json(output_dir / 'manifest.json', manifest)
    print(json.dumps({'counts': counts, 'output': manifest['output']}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        sys.exit(f'Extraction failed: {error}')
