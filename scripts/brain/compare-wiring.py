"""Paired comparison of real versus shuffled wiring across seeds, from training reports."""
import json, math, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2] / 'artifacts/brain'

def report(name):
    path = ROOT / f'report-{name}.json'
    return json.loads(path.read_text())['results'] if path.exists() else None

def tags(seed, wiring):
    return [f'final-{wiring}-seed{seed}', f'{wiring}-seed{seed}']

pairs = []
for seed in range(1, 21):
    found = []
    for wiring in ('anatomical', 'source-permuted'):
        result = next((r for r in (report(t) for t in tags(seed, wiring)) if r), None)
        found.append(result)
    if all(found):
        pairs.append((seed, *found))

metrics = {
    'school bananas': lambda r: r['schoolT08']['total'] * 10,
    'practiced bananas': lambda r: r['shippedT08']['total'] * 10,
    'original drums %': lambda r: r['shippedT08']['originality']['drums'] * 100,
    'original lead %': lambda r: r['shippedT08']['originality']['lead'] * 100,
    'progressions': lambda r: r['shippedT08']['progressions'],
}

def sign_test(differences):
    n = sum(1 for d in differences if d != 0)
    k = sum(1 for d in differences if d > 0)
    tail = sum(math.comb(n, i) for i in range(0, min(k, n - k) + 1)) / 2 ** n
    return min(1.0, 2 * tail), k, n

print(f'{len(pairs)} paired seeds: {[seed for seed, *_ in pairs]}')
print('| Measure | Real (mean) | Shuffled (mean) | Real − shuffled | Real higher | Sign test p | Paired t |')
print('| --- | ---: | ---: | ---: | ---: | ---: | ---: |')
for name, get in metrics.items():
    real = [get(a) for _, a, _ in pairs]
    shuffled = [get(b) for _, _, b in pairs]
    differences = [a - b for a, b in zip(real, shuffled)]
    mean = sum(differences) / len(differences)
    sd = math.sqrt(sum((d - mean) ** 2 for d in differences) / max(1, len(differences) - 1))
    t = mean / (sd / math.sqrt(len(differences))) if sd > 0 else float('inf')
    p, k, n = sign_test(differences)
    print(f'| {name} | {sum(real)/len(real):.2f} | {sum(shuffled)/len(shuffled):.2f} | {mean:+.2f} | {k}/{n} | {p:.3f} | {t:.2f} |')
for seed, a, b in pairs:
    print(seed, round(a['schoolT08']['total']*10, 2), round(b['schoolT08']['total']*10, 2), round(a['shippedT08']['total']*10, 2), round(b['shippedT08']['total']*10, 2), file=sys.stderr)
