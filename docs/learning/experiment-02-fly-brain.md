# Experiment 02: the fly composes from its song circuit

October 11, 2026. The fly now composes every layer of the music itself: drums, bass, chords, keys, a new lead melody, and when to loop. Its choices are read from a simulated network built from the male fly's real ear-to-song wiring. It learned from an original lofi tutor (school), then practiced alone against a banana critic (practice), and it keeps practicing gently while people listen. Automated measurements are below; **human listening has not been done yet**. The author of this report cannot hear audio.

Rendered tapes and their scores are in [docs/demos](../demos/). Each `.txt` file shows exactly what the fly played, step by step.

## The circuit: `song-v1`

[`scripts/data/extract_song_circuit.py`](../../scripts/data/extract_song_circuit.py) selects a subcircuit from the committed whole-CNS assets and the upstream body neurotransmitter predictions. The selection is deterministic, and the config is [`song-v1.json`](../../scripts/data/config/song-v1.json).

| Role | Neurons | Selection |
| --- | ---: | --- |
| Ear | 138 | Every JO-A and JO-B neuron, the sound-sensitive Johnston's organ subgroups |
| Wing sense | 150 | Nerve-cord sensory neurons sending the most synapses onto the song set: wing campaniform sensilla (ADMN) and haltere afferents |
| Auditory | 596 | Two hops of the strongest synaptic targets of the ear (AMMC, SAD, WED, AVLP, …) |
| Premotor | 516 | Two hops of the strongest synaptic inputs to the song set |
| Song | 345 | Courtship-song types (pC1, pIP10, vPR6, vPR9, dPR1, TN1, vMS, dMS, aSP, vpoEN/IN, pMP2, DNp13, CL062) |
| Wing motor | 26 | The direct and indirect wing motor neurons (b1–b3, i1–i2, hg1–hg4, ps1, tp1–tp2, …) |

There are 1,771 neurons, 78,710 connections of at least 3 synapses, and 1,481,953 synapses. Transmitters come from `consensus_nt`: acetylcholine excites; GABA, glutamate, and histamine inhibit; monoamines weakly excite. The compressed asset is 196 KB and is verified by SHA-256 before use.

## The model

- **Dynamics.** One synchronous rate update per sixteenth note: `x ← (1−a)x + a·tanh(Wx + b + W_in·u)`. Each incoming row of `W` holds `sign · log1p(synapses)`, normalized to unit L2 norm. The whole matrix is then rescaled to a spectral radius of 1, the echo-state convention. Leak rates `a` are log-uniform in [0.3, 0.95], and biases and input weights are seeded. The anatomical matrix has a raw spectral radius of 0.85, against 0.32 for source-permuted wiring: the real connectome has far stronger recurrent loops. Both are scaled to 1.
- **Senses.** Only ear and wing-sense neurons receive input: a clock (an eighth-note tick plus the phases of 4, 8, 16, 32, 64, and 128 sixteenths), what the fly played on the previous sixteenth, and the current chord.
- **Decisions.** The decoder reads **only the 887 premotor, song, and wing motor neurons**, standardized against a calibration run. Sound must cross real synapses to reach them. Each choice is read through a phase-tuned pool: one per sixteenth of the bar for step decisions, one per bar for loop decisions, and one per slot for chords. This mirrors how steering muscles fire at fixed phases of the wingbeat, but it is an engineering choice: it gives the decoder explicit timing.
- **Vocabulary.**
  - Kick, snare, and hat: off, soft, or hard.
  - Bass: hold, stop, root, fifth, octave, third, seventh, or approach, relative to the chord.
  - Keys: hold, strike, strike the top two notes, or release.
  - Lead: hold, rest, same, up or down by 1–4 scale steps, or move to the nearest chord tone.
  - Chord: one of the six chords in the preset's ring, every two bars.
  - Loops: per layer and bar, play fresh or repeat the bar 1, 2, or 4 bars back.

## Training

1. **School:** 1,500 phrases. The fly hears an original stochastic lofi tutor ([`tutor.ts`](../../src/brain/tutor.ts)) with teacher forcing and learns to anticipate each choice. The loss is cross-entropy on the readout only, using Adam.
2. **Practice:** 3,000 batches of 6 phrases, 18,000 phrases in total. The fly plays alone at temperature 1. The banana critic ([`critic.ts`](../../src/brain/critic.ts)) scores every bar of drums, bass, keys, and lead, plus phrase-level chords, melody shape, form, and novelty. Each decision is credited mostly by the bar it shaped (policy gradient against running baselines), with a small entropy bonus and a 0.3-weight school anchor. A repertoire term discourages opening every song with the same progression.
3. **Listening:** in the browser, every phrase that actually plays gets one gentle practice step, and a listener's banana reinforces the choices in that phrase. The fly is saved per browser in IndexedDB.

The anatomy and recurrent weights never change; only the readout learns. Reproduce with `node --import tsx scripts/brain/train.ts --school 1500 --practice 3000 --publish`. The run took about 22 minutes on a Ryzen 7 5800X while two control runs trained alongside it.

## Results (model seed 1, 30 sessions × 4 phrases, three presets)

**Bananas** are the critic's total score on a 0–10 scale. **Original** is the share of the fly's sounding drum, bass, and lead bars that never occur in 1,800 tutor phrases.

| Player | Bananas | Distinct progressions | Original drums / bass / lead |
| --- | ---: | ---: | --- |
| Tutor | 9.00 | 11 | 0 / 0 / 22% |
| Untrained fly | 3.46 | 30 | (noise) |
| After school, temperature 0.8 | 8.43 | 5 | 75 / 37 / 83% |
| **Shipped fly, temperature 0.8** | **9.35** | 11 | 88 / 65 / 92% |
| Shipped fly, temperature 1 | 9.24 | 10 | 95 / 68 / 95% |
| Shipped fly, greedy | 8.83 | 7 (38% distinct phrases) | 71 / 38 / 66% |
| Source-permuted wiring, temperature 0.8 | 9.31 | 8 | 78 / 50 / 92% |
| Zero recurrent wiring, temperature 0.8 | 8.41 | 26 | 87 / 65 / 100% |

All 120 shipped phrases were distinct, and the shipped fly's per-part critic scores were all at least 0.84. The scores are measured after the int8 round trip the browser uses. The app plays at temperature 0.6 + 0.4 × Variation.

### What these numbers do and do not show

- Practice clearly helps: school alone reaches 8.4 bananas, and practice lifts it to 9.35, above the tutor it learned from. Most of what the fly plays is not in the tutor's repertoire.
- The critic and the tutor share authors and ideas about lofi, so a high score means "matches our proxies", not "sounds good". **Listening is pending.**
- **Wiring:** removing recurrent connections costs about one banana. The decoder then sees only seeded spontaneous offsets, and the phase pools play an average groove. Source-permuted wiring (same row counts and weights, scaled to the same spectral radius) ties the real wiring on bananas. See the seed comparison below.

### Real versus shuffled wiring across three model seeds

The same budget was used for each run: 1,500 lessons and 3,000 practice batches. The table reports the shipped readout at temperature 0.8, over 30 sessions × 4 phrases.

| Seed | Wiring | School bananas | Shipped bananas | Distinct progressions | Original drums / bass / lead |
| --- | --- | ---: | ---: | ---: | --- |
| 1 | Anatomical | 8.43 | 9.35 | 11 | 88 / 65 / 92% |
| 1 | Source-permuted | 8.52 | 9.31 | 8 | 78 / 50 / 92% |
| 2 | Anatomical | 8.30 | 9.20 | 15 | 90 / 60 / 92% |
| 2 | Source-permuted | 8.92 | 9.19 | 9 | 79 / 56 / 81% |
| 3 | Anatomical | 8.30 | 9.34 | 9 | 97 / 57 / 94% |
| 3 | Source-permuted | 8.73 | 9.33 | 7 | 81 / 64 / 89% |
| Mean | Anatomical | 8.34 | 9.30 | 11.7 | 92 / 61 / 93% |
| Mean | Source-permuted | 8.72 | 9.28 | 8.0 | 79 / 57 / 87% |

Bananas tie. In all three seed pairs, the anatomical fly imitated the tutor less closely after school, then practiced into more distinct chord progressions and more drum bars of its own. This is a consistent but small-sample pattern with no statistical test. It is a lead for a stronger experiment, not evidence that the fly's wiring is musically better. One plausible mechanism is the real circuit's structured recurrence: before rescaling, its spectral radius is 0.85 against 0.32 for the shuffled circuit. That structure could give the song neurons richer, less input-locked activity. This has not been tested.

## Listening status

Not done. Listening needs a person. Please compare the [demo tapes](../demos/) with the classic connectome walk (`/?composer=walk`), and record who listened and what they heard here.
