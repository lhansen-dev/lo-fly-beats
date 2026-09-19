"""Extract the configured MBON circuit with stable JSON serialization."""

import hashlib
import json
from pathlib import Path
import sys

import networkx as nx
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.ipc as ipc

DATA_DIR = Path(__file__).resolve().parent
ROOT = DATA_DIR.parent.parent
CONFIG_PATH = DATA_DIR / 'config/mbon-v1.json'
FIELDS = ('type', 'instance', 'class', 'superclass', 'somaSide')


def require(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def write_json(path: Path, value: dict) -> bytes:
    data = (json.dumps(value, indent=2, ensure_ascii=False) + '\n').encode('utf-8')
    path.write_bytes(data)
    return data


def main() -> None:
    config_bytes = CONFIG_PATH.read_bytes()
    config = json.loads(config_bytes)
    retrieval_path = DATA_DIR / '.cache/retrieval.json'
    paths = {role: DATA_DIR / '.cache' / spec['name'] for role, spec in config['files'].items()}
    for path in [retrieval_path, *paths.values()]:
        require(path.is_file(), f'Missing {path}; run npm run data:download first')
    retrieval = json.loads(retrieval_path.read_text())
    for path in paths.values():
        require(path.name in retrieval, f'Missing retrieval record for {path.name}; run npm run data:download')
    annotations = pd.read_feather(paths['annotations'])
    selected = annotations[annotations[config['selection']['column']] == config['selection']['equals']].sort_values('bodyId')
    require(selected.bodyId.notna().all() and selected.bodyId.is_unique, 'Selected body IDs must be non-null and unique')
    ids = [int(value) for value in selected.bodyId]
    require(all(value > 0 for value in ids), 'Body IDs must be positive integers')
    limits = config['limits']
    require(limits['minNeurons'] <= len(ids) <= limits['maxNeurons'], f'Neuron count {len(ids)} is outside configured limits')
    neurons = [
        {'id': str(row['bodyId']), **{field: None if pd.isna(row[field]) else row[field] for field in FIELDS}}
        for row in selected.to_dict('records')
    ]
    id_set = pa.array(ids, type=pa.int64())
    connections = []
    seen = set()
    self_connections = 0
    with pa.memory_map(str(paths['connections']), 'r') as source:
        reader = ipc.open_file(source)
        for field in ('body_pre', 'body_post', 'weight'):
            require(pa.types.is_integer(reader.schema.field(field).type), f'Connection column {field} must contain integers')
        for index in range(reader.num_record_batches):
            batch = reader.get_batch(index)
            mask = pc.and_(pc.is_in(batch.column('body_pre'), value_set=id_set), pc.is_in(batch.column('body_post'), value_set=id_set))
            for row in batch.filter(mask).to_pylist():
                require(all(row[field] is not None for field in ('body_pre', 'body_post', 'weight')), 'Null value in selected connection')
                source_id, target_id, count = row['body_pre'], row['body_post'], row['weight']
                pair = (source_id, target_id)
                require(pair not in seen, f'Duplicate connection {source_id} -> {target_id}')
                require(isinstance(count, int) and count > 0, f'Invalid count for {source_id} -> {target_id}: {count}')
                seen.add(pair)
                if source_id == target_id and config['removeSelfConnections']:
                    self_connections += 1
                    continue
                connections.append((source_id, target_id, count))
    connections.sort()

    def graph_at(threshold: int) -> nx.DiGraph:
        graph = nx.DiGraph()
        graph.add_nodes_from(ids)
        graph.add_weighted_edges_from((source, target, count) for source, target, count in connections if count >= threshold)
        return graph

    comparisons = []
    for threshold in config['compareThresholds']:
        graph = graph_at(threshold)
        comparisons.append({
            'minSynapseCount': threshold,
            'connections': graph.number_of_edges(),
            'largestStronglyConnected': len(max(nx.strongly_connected_components(graph), key=len)),
            'deadEnds': sum(graph.out_degree(node) == 0 for node in graph),
        })
    graph = graph_at(config['minSynapseCount'])
    require(graph.number_of_edges() <= limits['maxConnections'], f'Connection count {graph.number_of_edges()} exceeds configured limit')
    core = max(nx.strongly_connected_components(graph), key=len)
    types = {int(neuron['id']): neuron['type'] for neuron in neurons}
    ranked = sorted(core, key=lambda node: (-graph.out_degree(node), -graph.out_degree(node, weight='weight'), node))
    starts, chosen_types = [], set()
    for node in ranked:
        if graph.out_degree(node) == 0 or (config['startNeurons']['onePerType'] and types[node] in chosen_types):
            continue
        starts.append(str(node))
        chosen_types.add(types[node])
        if len(starts) == config['startNeurons']['count']:
            break
    require(len(starts) == config['startNeurons']['count'], 'Not enough eligible starting neurons in the largest strongly connected component')
    circuit = {
        'schemaVersion': 1,
        'circuitId': config['circuitId'],
        'neurons': neurons,
        'connections': [
            {'source': str(source), 'target': str(target), 'synapseCount': count}
            for source, target, count in connections if count >= config['minSynapseCount']
        ],
    }
    counts = {
        'neurons': len(neurons),
        'cellTypes': len({neuron['type'] for neuron in neurons if neuron['type'] is not None}),
        'connections': graph.number_of_edges(),
        'synapses': sum(edge['synapseCount'] for edge in circuit['connections']),
        'largestStronglyConnected': len(core),
        'weaklyConnectedComponents': nx.number_weakly_connected_components(graph),
        'deadEnds': sum(graph.out_degree(node) == 0 for node in graph),
    }
    output_dir = ROOT / config['outputDir']
    output_dir.mkdir(parents=True, exist_ok=True)
    circuit_bytes = write_json(output_dir / 'circuit.json', circuit)
    manifest = {
        'schemaVersion': 1,
        'circuitId': config['circuitId'],
        'title': 'Mushroom body output neurons',
        'description': 'All MaleCNS v1.0 neurons annotated as mushroom body output neurons (class MBON), with the directed connections among them that have at least 3 synapses.',
        'source': {
            'dataset': 'MaleCNS',
            'release': config['release'],
            'homepage': 'https://male-cns.janelia.org/',
            'downloadPage': 'https://male-cns.janelia.org/download/',
            'citation': 'Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2025). Sexual dimorphism in the complete connectome of the Drosophila male central nervous system. bioRxiv. https://doi.org/10.1101/2025.10.09.680999',
            'paperUrl': 'https://www.cell.com/cell/fulltext/S0092-8674(26)00942-6',
            'retrievedOn': max(retrieval[path.name]['retrievedOn'] for path in paths.values()),
            'files': [
                {
                    'role': role, 'name': spec['name'], 'url': config['baseUrl'] + spec['name'],
                    'bytes': spec['bytes'], 'md5Base64': spec['md5Base64'],
                    'sha256': retrieval[spec['name']]['sha256'],
                }
                for role, spec in config['files'].items()
            ],
        },
        'license': {
            'name': 'CC BY 4.0',
            'url': 'https://creativecommons.org/licenses/by/4.0/',
            'attribution': 'Connectome data from MaleCNS male-cns:v1.0 by FlyEM (HHMI Janelia), the University of Cambridge, the MRC Laboratory of Molecular Biology, and Google Research, licensed CC BY 4.0. Filtered to mushroom body output neurons and connections with at least 3 synapses.',
        },
        'extraction': {
            'script': 'scripts/data/extract_circuit.py',
            'scriptVersion': 1,
            'config': 'scripts/data/config/mbon-v1.json',
            'configSha256': hashlib.sha256(config_bytes).hexdigest(),
            'neuronSelection': 'annotations.class == "MBON"',
            'minSynapseCount': config['minSynapseCount'],
            'selfConnectionsRemoved': self_connections,
            'rules': [
                'Selected every body whose annotation class is MBON.',
                'Kept connections whose source and target are both selected bodies.',
                'Removed self-connections before applying the synapse threshold.',
                'Kept connections with at least 3 synapses; synapseCount is the upstream weight value, unchanged.',
                'Rejected duplicate pairs, missing endpoints, and non-positive counts.',
                'Recorded missing annotation values as null.',
            ],
            'thresholdComparison': comparisons,
            'startNeuronRule': 'Within the largest strongly connected component, order neurons by out-degree (descending), total outgoing synapses (descending), and numeric ID (ascending); take the first neuron of each type until 8 are chosen.',
        },
        'counts': counts,
        'startNeuronIds': starts,
        'output': {'file': 'circuit.json', 'bytes': len(circuit_bytes), 'sha256': hashlib.sha256(circuit_bytes).hexdigest()},
    }
    write_json(output_dir / 'manifest.json', manifest)
    print(json.dumps({'counts': counts, 'selfConnectionsRemoved': self_connections, 'thresholdComparison': comparisons, 'startNeuronIds': starts}, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        sys.exit(f'Extraction failed: {error}')
