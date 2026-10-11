"""Build the Lo-Fly Radio listening page from the shipped fly, its report, and the demo tapes."""
import json, re, shutil, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
out = Path(sys.argv[1])
(out / 'tapes').mkdir(parents=True, exist_ok=True)
checkpoint = json.loads((ROOT / 'public/data/brains/fly-v1/checkpoint.json').read_text())
report = json.loads((ROOT / 'artifacts/brain/report-anatomical.json').read_text())
controls = {}
for name in ['source-permuted', 'zero']:
    path = ROOT / f'artifacts/brain/report-{name}.json'
    if path.exists():
        controls[name] = json.loads(path.read_text())['results']['shippedT08']
TAPES = [
    ('rainy-windowsill', 'Rainy Windowsill', 'D minor', 'Side A. Rain on glass, a warm cup.'),
    ('overripe-2am', 'Overripe at 2 AM', 'C minor', 'Side B. Late nights, dusty records.'),
    ('fruit-bowl-finals', 'Fruit Bowl Finals', 'A Dorian', 'Side C. Golden light, a little focus.'),
    ('rainy-windowsill-adventurous', 'Rainy Windowsill, adventurous', 'D minor', 'Bonus. Same rain, variation turned all the way up.'),
]
tapes = []
for slug, title, key, blurb in TAPES:
    text = (ROOT / f'docs/demos/{slug}.txt').read_text()
    header = text.splitlines()[0]
    bpm = int(re.search(r'at (\d+) BPM', header).group(1))
    phrases = []
    for block in text.split('\n\n')[1:]:
        lines = block.strip().splitlines()
        if not lines or not lines[0].startswith('phrase'):
            continue
        bananas = float(re.search(r': ([\d.]+) bananas', lines[0]).group(1))
        note = re.search(r'\((.*)\)$', lines[0])
        grid = {line[:5].strip(): line[5:] for line in lines[3:9]}
        phrases.append({'bananas': bananas, 'note': note.group(1) if note else '', 'chords': lines[1].removeprefix('chords: '), 'grid': grid})
    shutil.copy(ROOT / f'docs/demos/{slug}.mp3', out / 'tapes' / f'{slug}.mp3')
    tapes.append({'slug': slug, 'title': title, 'key': key, 'blurb': blurb, 'bpm': bpm, 'phrases': phrases})
data = {
    'history': checkpoint['history'], 'experience': checkpoint['experience'],
    'results': {k: {'bananas': round(v['total'] * 10, 2), 'progressions': v['progressions'], 'original': v['originality'], 'parts': v['parts']} for k, v in report['results'].items()},
    'controls': {k: {'bananas': round(v['total'] * 10, 2), 'progressions': v['progressions'], 'original': v['originality']} for k, v in controls.items()},
    'tapes': tapes,
}
template = (Path(__file__).with_name('radio-template.html')).read_text()
(out / 'index.html').write_text(template.replace('/*DATA*/null', json.dumps(data, separators=(',', ':'))))
print('wrote', out / 'index.html')
