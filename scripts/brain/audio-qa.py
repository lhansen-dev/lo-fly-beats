"""Objective checks on rendered tapes: clipping, DC, clicks, spectral balance, stereo, dynamics."""
import sys, wave
import numpy as np

def load(path):
    with wave.open(path) as w:
        data = np.frombuffer(w.readframes(w.getnframes()), dtype='<i2').astype(np.float64) / 32768
        return data.reshape(-1, w.getnchannels()), w.getframerate()

for path in sys.argv[1:]:
    x, rate = load(path)
    mono = x.mean(axis=1)
    peak = np.abs(x).max()
    clipped = int((np.abs(x) > 0.999).sum())
    dc = float(np.abs(x.mean(axis=0)).max())
    # Clicks: second difference spikes far above the local level.
    d2 = np.abs(np.diff(mono, 2))
    local = np.convolve(np.abs(mono), np.ones(441) / 441, mode='same')[1:-1] + 1e-4
    clicks = int((d2 > 0.5 * np.maximum(local, 0.02) + 0.15).sum())
    spectrum = np.abs(np.fft.rfft(mono * np.hanning(len(mono)))) ** 2
    freqs = np.fft.rfftfreq(len(mono), 1 / rate)
    bands = [(20, 60), (60, 250), (250, 1000), (1000, 4000), (4000, 10000), (10000, 20000)]
    total = spectrum[(freqs >= 20) & (freqs < 20000)].sum()
    shares = [spectrum[(freqs >= lo) & (freqs < hi)].sum() / total * 100 for lo, hi in bands]
    side = (x[:, 0] - x[:, 1]) / 2
    width = np.sqrt((side ** 2).mean()) / (np.sqrt((mono ** 2).mean()) + 1e-12)
    frames = mono[: len(mono) // 4410 * 4410].reshape(-1, 4410)
    rms = 20 * np.log10(np.sqrt((frames ** 2).mean(axis=1)) + 1e-9)
    crest = 20 * np.log10(peak / (np.sqrt((mono ** 2).mean()) + 1e-12))
    print(f'{path.split("/")[-1]}: peak {20*np.log10(peak):.1f} dBFS, clipped {clipped}, DC {dc:.4f}, click candidates {clicks}, crest {crest:.1f} dB, '
          f'loudness range p10–p95 {np.percentile(rms,10):.1f}..{np.percentile(rms,95):.1f} dB, side/mid {width:.2f}')
    print('   energy % sub/bass/lowmid/mid/presence/air: ' + ' / '.join(f'{s:.1f}' for s in shares))

def octaves(path):
    x, rate = load(path)
    mono = x.mean(axis=1)
    spectrum = np.abs(np.fft.rfft(mono * np.hanning(len(mono)))) ** 2
    freqs = np.fft.rfftfreq(len(mono), 1 / rate)
    centers = [31.5 * 2 ** i for i in range(10)]
    levels = [10 * np.log10(spectrum[(freqs >= c / 2 ** 0.5) & (freqs < c * 2 ** 0.5)].sum() + 1e-12) for c in centers]
    top = max(levels)
    return centers, [l - top for l in levels]

if '--octaves' in sys.argv[1:2]:
    pass
