# Experiment 02: the fly composes from its song circuit

October 11, 2026. The fly now composes every layer of the music itself: drums, bass, chords, keys, a new lead melody, and when to loop. Its choices are read from a simulated network built from the male fly's real ear-to-song wiring. It learned from an original lofi tutor (school), then practiced alone against a banana critic (practice), and it keeps practicing gently while people listen. Automated measurements are below; **human listening has not been done yet**. The author of this report cannot hear audio.

Rendered tapes (six-phrase songs) and their scores are in [docs/demos](../demos/). `scripts/brain/audio-qa.py` checks them for clipping, clicks, DC offset, spectral balance, and stereo width. All are clean, with peaks at or below −0.5 dBFS after export peak guarding. Each `.txt` file shows exactly what the fly played, step by step.

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
  - Section (brain version 2 and later): groove, breakdown, or intro, chosen at the start of each phrase. The fly hears its own choice. As an authored rule, a breakdown rests the drums for the first four bars and an intro keeps the kick to downbeats there, like a producer muting a channel.
- **Habituation** (version 3): an input that grows with each consecutive groove phrase and resets on a change of section. Without it, the fly had no way to know a breakdown was due.

## Training

1. **School:** 1,500 phrases. The fly hears an original stochastic lofi tutor ([`tutor.ts`](../../src/brain/tutor.ts)) with teacher forcing and learns to anticipate each choice. The loss is cross-entropy on the readout only, using Adam.
2. **Practice:** 3,000 batches of 6 phrases, 18,000 phrases in total. The fly plays alone at temperature 1. The banana critic ([`critic.ts`](../../src/brain/critic.ts)) scores every bar of drums, bass, keys, and lead, plus phrase-level chords, melody shape, form, and novelty. Each decision is credited mostly by the bar it shaped (policy gradient against running baselines), with a small entropy bonus and a 0.3-weight school anchor. A repertoire term discourages opening every song with the same progression.
3. **Listening:** in the browser, every phrase that actually plays gets one gentle practice step, and a listener's banana reinforces the choices in that phrase. The fly is saved per browser in IndexedDB.

The anatomy and recurrent weights never change; only the readout learns. Reproduce with `node --import tsx scripts/brain/train.ts --school 1500 --practice 3000 --publish`, then continue with `--resume --practice 2000 --publish` (the shipped fly had two such rounds). `scripts/brain/evaluate.ts` measures any readout without training it. The run took about 22 minutes on a Ryzen 7 5800X while two control runs trained alongside it.

## Results

Version 1 (all layers, no sections) is described by the first table. The shipped fly is **version 3**, with sections and habituation: trained with the same 1,500 lessons and 3,000 practice batches, then given 4,000 more practice batches from a resumed checkpoint as the critic learned what a real section is (42,000 practice phrases in total).

**Bananas** are the critic's total score on a 0–10 scale. **Original** is the share of the fly's sounding drum, bass, and lead bars that never occur in 1,800 tutor phrases.

### Shipped fly (version 3), 30 sessions × 6 phrases, three presets

These measurements were taken after a final 1,500-batch lesson on hat accents, prompted by the independent judge below. That lesson traded about 0.1 banana for more idiomatic hats and more progressions (from 8 to 11), so the critic was version 6 at measurement time.

| Player | Bananas | Distinct progressions | Original drums / bass / lead | Sections (groove / breakdown / intro) | Sections realized |
| --- | ---: | ---: | --- | --- | ---: |
| Tutor | 9.36 | 11 | 0 / 0 / 23% | 67 / 17 / 17% | 100% |
| **Shipped fly, temperature 0.8 (default Variation 0.5)** | **9.35** | 11 | 69 / 59 / 93% | 67 / 17 / 17% | 100% |
| Shipped fly, temperature 1 | 9.27 | 13 | 80 / 67 / 96% | 67 / 17 / 17% | 100% |
| Shipped fly, temperature 0.6 | 9.36 | 9 | 61 / 50 / 89% | 67 / 17 / 17% | 100% |

The fly opens each session with an intro, plays three grooves, and drops into a breakdown before the groove returns. That shape came from the tutor, but the fly chooses it, and he times it from his own habituation sense. Harmonic variety now matches the tutor's.

### How song form was learned

1. Adding the section head (version 2) gave intros but **no breakdowns**: early breakdowns scored poorly, so practice stopped trying them.
2. Pressure toward a change after three grooves did not help, because nothing told the fly how long it had been grooving. Habituation (version 3) fixed that.
3. Then the fly **reward-hacked**: it labelled phrases "breakdown" for the form bonus but kept the drums playing. Only 54% of its intros and breakdowns sounded like one. The critic now credits a section only when the music realizes it.
4. Truthful breakdowns were then too hard to execute, because emptying four bars takes about 50 consecutive "off" decisions. The fly avoided them again (3%). Making the section choice gate the drums, as above, gave 100% realized sections at the tutor's proportions.

### More practice has plateaued

A further 4,000 resumed batches from the shipped fly left bananas flat (9.34 against 9.35). The judge improved slightly overall (0.69 against 0.73 bits), but kick and bass became less idiomatic and distinct progressions fell from 11 to 8. It was not shipped. The shipping rule is that the critic and the independent judge must both improve without losing variety.

### A second, independent judge

The critic is what the fly optimized, so it cannot also certify the result. [`scripts/brain/judge.ts`](../../scripts/brain/judge.ts) fits a position-aware trigram model per layer on 1,800 tutor phrases from seeds the fly never trained on. It reports how surprising each player's choices are in bits per decision; lower means more idiomatic. Scores are averaged over 30 sessions × 6 phrases.

| Player | Kick | Snare | Hat | Bass | Keys | Lead | Mean |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Tutor, held-out seeds | 0.27 | 0.28 | 0.17 | 0.46 | 0.24 | 0.72 | 0.36 |
| Fly before the hat lesson, temperature 0.8 | 0.36 | 0.33 | 1.08 | 0.87 | 0.25 | 1.89 | 0.80 |
| **Shipped fly, temperature 0.8** | 0.37 | 0.31 | 0.68 | 0.75 | 0.33 | 1.93 | **0.73** |
| Shipped fly, temperature 1 | 0.42 | 0.35 | 0.78 | 0.84 | 0.39 | 2.21 | 0.83 |
| Anchor-free over-optimized fly | 0.52 | 0.56 | 2.30 | 1.03 | 0.22 | 3.00 | 1.27 |
| Untrained fly | 1.55 | 2.08 | 2.43 | 3.42 | 3.03 | 3.90 | 2.73 |

The hat lesson was added to the critic because this judge showed hats as the least idiomatic layer. That makes the judge less independent for hats from here on; the other layers are unaffected. By this independent measure the shipped fly plays far closer to the idiom than noise, and its departures sit mostly in melody, where originality is expected, and in hat patterns. The judge independently flags the critic-gamed fly as less idiomatic, so the critic and the judge disagree exactly where reward hacking was suspected.

### Version 1 (no sections), model seed 1, 30 sessions × 4 phrases

| Player | Bananas | Distinct progressions | Original drums / bass / lead |
| --- | ---: | ---: | --- |
| Tutor | 9.00 | 11 | 0 / 0 / 22% |
| Untrained fly | 3.46 | 30 | (noise) |
| After school, temperature 0.8 | 8.43 | 5 | 75 / 37 / 83% |
| Fly after practice, temperature 0.8 | 9.35 | 11 | 88 / 65 / 92% |
| Source-permuted wiring, temperature 0.8 | 9.31 | 8 | 78 / 50 / 92% |
| Zero recurrent wiring, temperature 0.8 | 8.41 | 26 | 87 / 65 / 100% |

The app plays at temperature 0.6 + 0.4 × Variation. Every measurement uses the int8 readout the browser loads.

### What these numbers do and do not show

- Practice clearly helps: school alone reaches about 8.2–8.4 bananas, and practice takes the fly above the tutor it learned from. Most of what it plays is not in the tutor's repertoire.
- The critic and the tutor share authors and ideas about lofi, so a high score means "matches our proxies", not "sounds good". The reward hack above shows how easily the proxies can be gamed. **Listening is pending.**
- **Wiring:** removing recurrent connections costs about 0.7–1 banana; the decoder then sees only seeded spontaneous offsets. Shuffled wiring imitates the tutor better and ties after practice. See the paired comparison below.

### Real versus shuffled wiring: six paired runs

Each pair uses the same model seed and the same budget: 1,500 lessons and 3,000 practice batches, at temperature 0.8.

| Version | Seed | School: real / shuffled | After practice: real / shuffled | Original drums: real / shuffled |
| --- | --- | --- | --- | --- |
| 1 | 1 | 8.43 / 8.52 | 9.35 / 9.31 | 88 / 78% |
| 1 | 2 | 8.30 / 8.92 | 9.20 / 9.19 | 90 / 79% |
| 1 | 3 | 8.30 / 8.73 | 9.34 / 9.33 | 97 / 81% |
| 3 | 1 | 8.18 / 8.99 | 9.36 / 9.30 | 86 / 71% |
| 3 | 2 | 8.29 / 9.16 | 9.33 / 9.24 | 74 / 68% |
| 3 | 3 | 8.55 / 8.94 | 9.34 / 9.22 | 75 / 73% |

In all six of those pairs the shuffled brain imitated the tutor better, and the real fly finished slightly ahead. That second pattern **did not replicate**.

**Seven clean pairs under the final configuration** (brain version 3 with gated sections and the truthful critic; seeds 1–7; same budget) are produced by `python3 scripts/brain/compare-wiring.py`:

| Measure | Real (mean) | Shuffled (mean) | Real − shuffled | Real higher | Sign test p | Paired t (df 6) |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| School bananas | 8.65 | 9.09 | −0.44 | 0/7 | 0.016 | −7.19 |
| Practiced bananas | 9.38 | 9.35 | +0.03 | 3/7 | 1.000 | 0.84 |
| Original drum bars | 81.5% | 72.8% | +8.7 pts | 5/7 | 0.45 | 2.20 |
| Original lead bars | 90.0% | 89.2% | +0.8 pts | 4/7 | 1.000 | 0.76 |
| Distinct progressions | 8.7 | 7.4 | +1.3 | 5/6 (one tie) | 0.22 | 1.72 |

What holds up: **the shuffled circuit is a consistently better copier of the tutor**. After practice the two are equal. The real circuit's drums are somewhat more often its own, but that falls short of conventional significance. The connectome's structured recurrence measurably changes how the song neurons learn by imitation, and it does not by itself make better music by this critic. Before rescaling, the real circuit's spectral radius is 0.85 against 0.32 for the shuffled one.

## Learning inside the circuit (stage 2): a first, negative result

The original plan's stage 2 lets selected internal connections learn from reward, inspired by dopamine-gated plasticity. [`plasticityStep`](../../src/brain/learn.ts) gives each of the 18,341 premotor→song, song→song, and premotor/song→wing-motor synapses a gain in [0.5, 1.5] on its anatomical weight. Each gain moves by a three-factor rule: the covariance of presynaptic rate (one step earlier) with postsynaptic rate over the phrase, times the phrase's normalized critic advantage, times the synapse's sign. Anatomy itself never changes. [`scripts/brain/plasticity.ts`](../../scripts/brain/plasticity.ts) runs the experiment from the shipped fly.

**Readout frozen, 1,500 batches.** Bananas are measured over 24 sessions × 6 phrases at temperature 0.8.

| Condition | Before | After |
| --- | ---: | ---: |
| Real reward, rate 0.002 | 9.43 | **7.09** |
| Real reward, rate 0.006 | 9.43 | 5.79 |
| Shuffled-sign reward (control), rate 0.002 | 9.43 | 9.46 |

Reward-driven plasticity made the fly worse, while random reward left it unchanged. The real reward pushes gains coherently, with their spread growing steadily to 0.32. That reshapes the dynamics the frozen readout depends on, and the falling scores then feed negative advantages back into further change, a positive-feedback collapse. **Joint learning, 1,500 batches.** The readout keeps practicing at half the usual rate while the gains learn slowly (rate 0.0005).

| Condition | Before | After |
| --- | ---: | ---: |
| Readout practice + reward plasticity | 9.43 | 9.41 |
| Readout practice only | 9.43 | 9.83 |
| Readout practice + shuffled-reward plasticity | 9.43 | 9.83 |

The 9.83 for readout-only practice is not a better fly. That practice has no school anchor, and the fly reaches the score by collapsing to 3 chord progressions and repeating nearly the same loop phrase after phrase. This shows directly that the critic can be over-optimized, which is why shipped training keeps the anchor and the repertoire term. Even when the readout can follow, this plasticity rule cancels the gains from practice, while random plasticity of the same size is harmless. The phrase-level covariance rule is too blunt: one critic score per phrase cannot tell which of 18,341 synapses helped. Per-bar credit, eligibility filtered to the decisions a synapse feeds, or a slower separate timescale are the obvious next attempts. The app does not use internal plasticity.

## Browser coverage

`tests/browser/brain.spec.ts` covers composing, critique, bananas, reload persistence, the classic walk, and playing before the connectome loads. It passes in Chromium and Firefox. WebKit could not be launched in the build sandbox, so Safari remains unverified.

## Listening status

Not done. Listening needs a person. Please compare the [demo tapes](../demos/) with the classic connectome walk (`/?composer=walk`), and record who listened and what they heard here.
