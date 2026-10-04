# Assets

| Asset | Kind | Source and license | Path |
|---|---|---|---|
| Scene SVG components | Original artwork made for this project, drawn as React SVG components; no external images or fonts. | Original project artwork. | `src/scene/Scene.tsx`, `src/scene/SceneFrame.tsx`, `src/scene/fly/Fly.tsx`, `src/scene/layers/Banana.tsx`, `src/scene/layers/Desk.tsx`, `src/scene/layers/Lighting.tsx`, `src/scene/layers/Rain.tsx`, `src/scene/layers/Wall.tsx`, `src/scene/layers/Window.tsx` |
| Audio | Drum (kick, snare, hat), rain, and crackle buffers generated in code; instruments from Tone synthesizers. No samples or recordings. | Generated in code; Tone synthesizers. | `src/audio/buffers.ts`, `src/audio/rig.ts` |
| Data | MaleCNS v1.0 files: `body-annotations-male-cns-v1.0-minconf-0.5.feather` and `connectome-weights-male-cns-v1.0-minconf-0.5.feather`. Licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Citation: Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2025). Sexual dimorphism in the complete connectome of the Drosophila male central nervous system. bioRxiv. https://doi.org/10.1101/2025.10.09.680999. Filtering rules: class MBON neurons; connections between selected bodies; self-connections removed; at least 3 synapses. | `public/data/circuits/mbon-v1/circuit.json`, `public/data/circuits/mbon-v1/manifest.json` |
| Fonts | System fonts only; no font files. | System fonts. | None |

Update this file whenever an asset is added.
