"""Independently compare every compact connection and annotation to MaleCNS."""

import gzip
import hashlib
import json
from pathlib import Path
import sys

import numpy as np
import pyarrow as pa
import pyarrow.compute as pc
import pyarrow.feather as feather
import pyarrow.ipc as ipc

from verify_circuit import check, sha256, ROOT, DATA_DIR

OUTPUT_DIR = ROOT / 'public/data/circuits/whole-cns-v1'


def main() -> None:
    manifest = json.loads((OUTPUT_DIR / 'manifest.json').read_text())
    config = json.loads((ROOT / manifest['extraction']['config']).read_text())
    check(sha256(ROOT / manifest['extraction']['config']) == manifest['extraction']['configSha256'], 'Config checksum mismatch')
    paths = {}
    for spec in manifest['source']['files']:
        path = DATA_DIR / '.cache' / spec['name']
        check(path.stat().st_size == spec['bytes'] and sha256(path) == spec['sha256'], f'Source mismatch: {path.name}')
        paths[spec['role']] = path
    for spec in [manifest['output'], manifest['output']['adjacency']]:
        path = OUTPUT_DIR / spec['file']
        check(path.stat().st_size == spec['bytes'] and sha256(path) == spec['sha256'], f'Output mismatch: {path.name}')
    fingerprint = hashlib.sha256(f"{manifest['output']['sha256']}:{manifest['output']['adjacency']['sha256']}".encode()).hexdigest()
    check(fingerprint == manifest['output']['graphSha256'], 'Graph fingerprint mismatch')
    circuit = json.loads(gzip.decompress((OUTPUT_DIR / 'neurons.json.gzip').read_bytes()))
    annotations = feather.read_table(paths['annotations'])
    selection = config['selection']
    originals = annotations.filter(pc.equal(annotations[selection['column']], selection['equals'])).sort_by('bodyId')
    expected_nodes = [{
        'id': str(row['bodyId']),
        **{field: row[field] for field in ('type', 'instance', 'class', 'superclass', 'somaSide')},
        'anatomy': {field: row[field] for field in (
            'somaLocation', 'tosomaLocation', 'somaNeuromere', 'subclass', 'rootSide', 'entryNerve', 'exitNerve',
        )},
    } for row in originals.to_pylist()]
    check(circuit['schemaVersion'] == 2 and circuit['circuitId'] == manifest['circuitId'], 'Invalid annotation header')
    check(circuit['neurons'] == expected_nodes, 'Annotation set or values differ from upstream')
    ids = originals['bodyId'].to_numpy()
    binary = gzip.decompress((OUTPUT_DIR / 'adjacency.bin.gzip').read_bytes())
    check(len(binary) == manifest['output']['adjacency']['uncompressedBytes'], 'Decompressed byte count mismatch')
    words = np.frombuffer(binary, dtype='<u4')
    n, e = manifest['counts']['neurons'], manifest['counts']['connections']
    check(words[:5].tolist() == [0x3242464C, n, e, config['minSynapseCount'], 0], 'Invalid binary header')
    check(len(words) == 5 + n + 1 + e * 2, 'Invalid binary length')
    offsets, targets, weights = words[5:5 + n + 1], words[5 + n + 1:5 + n + 1 + e], words[5 + n + 1 + e:]
    check(offsets[0] == 0 and offsets[-1] == e and np.all(offsets[1:] >= offsets[:-1]), 'Invalid offsets')
    check(np.all(targets < n) and np.all(weights >= config['minSynapseCount']), 'Invalid edge values')
    degrees = np.diff(offsets)
    sources = np.repeat(np.arange(n, dtype=np.uint32), degrees)
    keys = (sources.astype(np.uint64) << 32) | targets
    check(np.all(keys[1:] > keys[:-1]) and np.all(sources != targets), 'Duplicate, unsorted, or self connections')
    verified = np.zeros(e, dtype=np.bool_)
    self_connections = 0
    retained = 0
    with pa.memory_map(str(paths['connections']), 'r') as source:
        reader = ipc.open_file(source)
        for index in range(reader.num_record_batches):
            batch = reader.get_batch(index)
            raw_pre, raw_post, raw_weight = (batch.column(field).to_numpy() for field in ('body_pre', 'body_post', 'weight'))
            strong = raw_weight >= config['minSynapseCount']
            if not np.any(strong):
                continue
            raw_pre, raw_post, raw_weight = raw_pre[strong], raw_post[strong], raw_weight[strong]
            pre, post = np.searchsorted(ids, raw_pre), np.searchsorted(ids, raw_post)
            valid = (pre < n) & (post < n)
            valid &= (ids[np.minimum(pre, n - 1)] == raw_pre) & (ids[np.minimum(post, n - 1)] == raw_post)
            self_connections += int(np.count_nonzero(valid & (raw_pre == raw_post)))
            keep = valid & (raw_pre != raw_post)
            expected_keys = (pre[keep].astype(np.uint64) << 32) | post[keep].astype(np.uint64)
            positions = np.searchsorted(keys, expected_keys)
            check(np.all(positions < e), 'Missing exported connection')
            check(np.array_equal(keys[positions], expected_keys), 'Upstream connection missing from export')
            check(np.array_equal(weights[positions], raw_weight[keep]), 'Exported weight differs from upstream')
            check(len(np.unique(positions)) == len(positions) and not np.any(verified[positions]), 'Duplicate upstream pairs')
            verified[positions] = True
            retained += len(positions)
    check(retained == e and np.all(verified), 'Export contains connections absent from the source')
    check(self_connections == manifest['extraction']['selfConnectionsRemoved'], 'Self-connection count mismatch')
    counts = {'neurons': len(expected_nodes), 'cellTypes': len({node['type'] for node in expected_nodes if node['type'] is not None}), 'connections': e, 'synapses': int(weights.sum(dtype=np.uint64)), 'deadEnds': int(np.count_nonzero(degrees == 0))}
    check(counts == manifest['counts'], 'Manifest counts mismatch')
    check(manifest['startNeuronIds'] == [] and config['startNeurons'] == {'allWithOutgoing': True}, 'Invalid whole-connectome start rule')
    check(manifest['extraction']['thresholdComparison'] == [{'minSynapseCount': config['minSynapseCount'], 'connections': e, 'deadEnds': counts['deadEnds']}], 'Threshold counts mismatch')
    samples = np.unique(np.linspace(0, e - 1, 20, dtype=int))
    lines = ['# Whole MaleCNS extraction report', '', 'Verified independently against the cached upstream sources by `scripts/data/verify_whole_cns.py`.', '', f"Dataset: {manifest['source']['release']}. Retrieved {manifest['source']['retrievedOn']}.", '', manifest['license']['attribution'], '', '## Selection', '', *[f'- {rule}' for rule in manifest['extraction']['rules']], '', '## Verified counts', '', '| Measure | Value |', '| --- | --- |', *[f'| {key} | {value:,} |' for key, value in counts.items()], f'| Eligible phrase starts | {np.count_nonzero(degrees):,} |', f'| Removed self-connections at threshold | {self_connections:,} |', '', '## Integrity', '', f"Graph fingerprint: `{fingerprint}` (SHA-256 of `annotations SHA-256:adjacency SHA-256`).", f"Config SHA-256: `{manifest['extraction']['configSha256']}`.", '']
    for spec in [*manifest['source']['files'], manifest['output'], manifest['output']['adjacency']]:
        lines.append(f"- {spec.get('name', spec.get('file'))}: {spec['bytes']:,} bytes; SHA-256 `{spec['sha256']}`.")
    lines += ['', '## Sample connections', '', 'All retained connections and weights were checked; these evenly spaced examples are provided for review.', '', '| Source ID | Target ID | Synapses |', '| --- | --- | --- |']
    lines += [f'| {ids[sources[index]]} | {ids[targets[index]]} | {weights[index]} |' for index in samples]
    lines += ['', f'All {n:,} annotation records and {e:,} directed connections match upstream exactly. No connections were sampled or capped in the exported graph.', '', 'Strong/weak component counts are not computed for this export; starts cover every neuron with retained outgoing connections.', '']
    report = DATA_DIR / 'reports/whole-cns-v1-extraction.md'
    report.write_text('\n'.join(lines))
    print(f'Verified {n:,} neurons and {e:,} connections; wrote {report.relative_to(ROOT)}')


if __name__ == '__main__':
    try:
        main()
    except (OSError, ValueError, KeyError) as error:
        sys.exit(f'Verification failed: {error}')
