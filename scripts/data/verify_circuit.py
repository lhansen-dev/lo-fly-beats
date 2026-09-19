"""Independently verify the committed export against the upstream source files."""

import hashlib
import json
from pathlib import Path
import sys

import networkx as nx
import pandas as pd
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.feather as feather
import pyarrow.ipc as ipc

ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = ROOT / 'scripts/data'
OUTPUT_DIR = ROOT / 'public/data/circuits/mbon-v1'


def check(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def sha256(path: Path) -> str:
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def main() -> None:
    manifest = json.loads((OUTPUT_DIR / 'manifest.json').read_text())
    circuit_path = OUTPUT_DIR / 'circuit.json'
    check(sha256(circuit_path) == manifest['output']['sha256'], 'Circuit checksum mismatch')
    check(circuit_path.stat().st_size == manifest['output']['bytes'], 'Circuit byte count mismatch')
    check(sha256(ROOT / manifest['extraction']['config']) == manifest['extraction']['configSha256'], 'Config checksum mismatch')
    paths = {}
    for spec in manifest['source']['files']:
        path = DATA_DIR / '.cache' / spec['name']
        check(path.stat().st_size == spec['bytes'], f'Source byte count mismatch: {path.name}')
        check(sha256(path) == spec['sha256'], f'Source checksum mismatch: {path.name}')
        paths[spec['role']] = path

    circuit = json.loads(circuit_path.read_text())
    neurons = {node['id']: node for node in circuit['neurons']}
    check(len(neurons) == len(circuit['neurons']), 'Duplicate exported neuron IDs')
    annotations = feather.read_table(paths['annotations'])
    selected = annotations.filter(pc.equal(annotations['class'], 'MBON'))
    originals = {str(row['bodyId']): row for row in selected.to_pylist()}
    check(neurons.keys() == originals.keys(), 'Exported neuron set differs from upstream MBON selection')
    for node_id, node in neurons.items():
        for field in ('type', 'instance', 'class', 'superclass', 'somaSide'):
            check(node[field] == originals[node_id][field], f'Annotation mismatch: {node_id}.{field}')

    edges = circuit['connections']
    exported = {(edge['source'], edge['target']): edge['synapseCount'] for edge in edges}
    check(len(exported) == len(edges), 'Duplicate exported connection pairs')
    numeric_pair = lambda edge: (int(edge['source']), int(edge['target']))
    candidates = (
        sorted(edges, key=lambda edge: (-edge['synapseCount'], *numeric_pair(edge)))[:5]
        + sorted(edges, key=lambda edge: (edge['synapseCount'], *numeric_pair(edge)))[:5]
        + edges[::100]
        + edges
    )
    samples = {}
    for edge in candidates:
        samples.setdefault((edge['source'], edge['target']), edge['synapseCount'])
        if len(samples) == 20:
            break
    check(len(samples) == 20, 'Could not select 20 distinct samples')

    selected_ids = pa.array([int(node_id) for node_id in neurons], type=pa.int64())
    upstream = {}
    self_connections = 0
    with pa.memory_map(str(paths['connections']), 'r') as source:
        reader = ipc.open_file(source)
        for index in range(reader.num_record_batches):
            batch = reader.get_batch(index)
            rows = batch.filter(pc.is_in(batch.column('body_pre'), value_set=selected_ids))
            rows = rows.filter(pc.is_in(rows.column('body_post'), value_set=selected_ids))
            for row in rows.to_pylist():
                pair = (str(row['body_pre']), str(row['body_post']))
                if pair[0] == pair[1]:
                    self_connections += 1
                    continue
                check(pair not in upstream, f'Duplicate upstream pair: {pair}')
                upstream[pair] = row['weight']
    for pair, count in samples.items():
        check(upstream.get(pair) == count, f'Sample mismatch: {pair}, exported {count}, upstream {upstream.get(pair)}')
    retained = {pair: count for pair, count in upstream.items() if count >= manifest['extraction']['minSynapseCount']}
    check(retained.keys() == exported.keys(), 'Exported connection set differs from the retained upstream set')
    check(retained == exported, 'An exported synapse count differs from the upstream weight')
    check(self_connections == manifest['extraction']['selfConnectionsRemoved'], 'Self-connection count mismatch')

    def make_graph(connections):
        result = nx.DiGraph()
        result.add_nodes_from(neurons)
        result.add_weighted_edges_from((source, target, count) for (source, target), count in connections.items())
        return result

    graph = make_graph(exported)
    strong = sorted(nx.strongly_connected_components(graph), key=lambda nodes: (-len(nodes), min(map(int, nodes))))
    weak = list(nx.weakly_connected_components(graph))
    dead_ends = sorted((node for node in graph if graph.out_degree(node) == 0), key=int)
    counts = {
        'neurons': len(neurons), 'cellTypes': len({node['type'] for node in neurons.values() if node['type'] is not None}),
        'connections': len(exported), 'synapses': sum(exported.values()), 'largestStronglyConnected': len(strong[0]),
        'weaklyConnectedComponents': len(weak), 'deadEnds': len(dead_ends),
    }
    check(counts == manifest['counts'], f'Manifest counts mismatch: {counts}')
    for comparison in manifest['extraction']['thresholdComparison']:
        threshold = comparison['minSynapseCount']
        candidate = make_graph({pair: count for pair, count in upstream.items() if count >= threshold})
        measured = {
            'minSynapseCount': threshold, 'connections': candidate.number_of_edges(),
            'largestStronglyConnected': max(map(len, nx.strongly_connected_components(candidate))),
            'deadEnds': sum(candidate.out_degree(node) == 0 for node in candidate),
        }
        check(comparison == measured, f'Threshold comparison mismatch at {threshold}: {measured}')
    starts, chosen_types = [], set()
    for node in sorted(strong[0], key=lambda node: (-graph.out_degree(node), -graph.out_degree(node, weight='weight'), int(node))):
        if neurons[node]['type'] not in chosen_types:
            starts.append(node)
            chosen_types.add(neurons[node]['type'])
        if len(starts) == 8:
            break
    check(starts == manifest['startNeuronIds'], 'Starting neurons disagree with the documented ranking')

    lines = ['# MBON v1 extraction report', '', 'Verified independently by `scripts/data/verify_circuit.py` against the cached upstream files.', '', '## Source files and checksums', '', f'Dataset: {manifest["source"]["dataset"]} `{manifest["source"]["release"]}`. Retrieved {manifest["source"]["retrievedOn"]}.', '', f'[Download page]({manifest["source"]["downloadPage"]}). {manifest["license"]["attribution"]}', '', f'[License]({manifest["license"]["url"]}).', '', manifest['source']['citation'], '', f'[Published paper]({manifest["source"]["paperUrl"]}).', '']
    for spec in manifest['source']['files']:
        lines += [f'- [{spec["name"]}]({spec["url"]}): {spec["bytes"]:,} bytes; MD5 (base64) `{spec["md5Base64"]}`; SHA-256 `{spec["sha256"]}`.']
    lines += ['', f'Circuit: {manifest["output"]["bytes"]:,} bytes; SHA-256 `{manifest["output"]["sha256"]}`.', '', f'Config SHA-256: `{manifest["extraction"]["configSha256"]}`.', '', '## Selection and filtering', '']
    lines += [f'- {rule}' for rule in manifest['extraction']['rules']]
    lines += ['', f'All {len(neurons)} exported annotation records match the source. Original IDs and annotations are in [circuit.json](../../../public/data/circuits/mbon-v1/circuit.json).', '', f'There are {len(upstream) + self_connections:,} selected upstream pairs before filtering; {self_connections} self-connection is removed. The complete retained connection set and all weights match the export.', '', '## Counts', '', '| Measure | Value |', '| --- | --- |']
    lines += [f'| {name} | {value:,} |' for name, value in counts.items()]
    lines += ['', '## Threshold comparison', '', '| Minimum synapses | Connections | Largest strong component | Dead ends |', '| --- | --- | --- | --- |']
    for row in manifest['extraction']['thresholdComparison']:
        lines.append(f'| {row["minSynapseCount"]} | {row["connections"]} | {row["largestStronglyConnected"]} | {row["deadEnds"]} |')
    lines += ['', '## Degree distributions', '', 'Percentiles use linear interpolation across all selected neurons, including dead ends.', '', '| Degree | Minimum | Median | 90th percentile | Maximum |', '| --- | --- | --- | --- | --- |']
    for name, degrees in [('In', graph.in_degree()), ('Out', graph.out_degree())]:
        values = pd.Series([value for _, value in degrees])
        lines.append(f'| {name} | {values.min():g} | {values.median():g} | {values.quantile(0.9):g} | {values.max():g} |')
    lines += ['', '## Dead ends', '', '| ID | Type | Side |', '| --- | --- | --- |']
    lines += [f'| {node} | {neurons[node]["type"]} | {neurons[node]["somaSide"]} |' for node in dead_ends]
    lines += ['', '## Connected components', '', f'Weak component sizes: {", ".join(str(len(nodes)) for nodes in weak)}. Isolated neurons: {len(list(nx.isolates(graph)))}.', '', f'Strong component sizes: {", ".join(str(len(nodes)) for nodes in strong)}.', '', f'Singleton strong components: {", ".join(next(iter(nodes)) for nodes in strong if len(nodes) == 1)}.', '', '## Starting neurons', '', manifest['extraction']['startNeuronRule'], '', '| ID | Type | Side | Out-degree | Outgoing synapses |', '| --- | --- | --- | --- | --- |']
    for node in starts:
        lines.append(f'| {node} | {neurons[node]["type"]} | {neurons[node]["somaSide"]} | {graph.out_degree(node)} | {graph.out_degree(node, weight="weight")} |')
    lines += ['', '## Upstream connection samples', '', 'Five highest weights, five lowest weights (numeric ID tie breaks), then file positions 0, 100, …, 900. Duplicates are replaced with unused connections in file order.', '', '| Source | Target | Upstream weight | Exported synapseCount |', '| --- | --- | --- | --- |']
    lines += [f'| {source} | {target} | {upstream[(source, target)]} | {count} |' for (source, target), count in samples.items()]
    lines += ['', f'{len(samples)} of {len(samples)} sample counts match; {len(neurons)} of {len(neurons)} annotation records match; full connection sets and all retained weights match.', '', '## Regeneration', '', 'From the repository root with Node 22 and uv installed:', '', '```sh', 'uv sync --locked --project scripts/data', 'npm run data:download', 'uv run --project scripts/data python scripts/data/inspect_sources.py', 'npm run data:extract', 'npm run data:verify', '```', '', 'The bulk source files stay in the ignored `scripts/data/.cache/` directory. Application builds use the committed JSON files.']
    report = DATA_DIR / 'reports/mbon-v1-extraction.md'
    report.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    print(f'{len(samples)} of {len(samples)} matching samples; {len(neurons)} of {len(neurons)} matching annotation records; matching connection sets and weights.')
    print(f'Dead ends: {[(node, neurons[node]["type"], neurons[node]["somaSide"]) for node in dead_ends]}')
    print(f'Wrote {report.relative_to(ROOT)}')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        sys.exit(f'Verification failed: {error}')
