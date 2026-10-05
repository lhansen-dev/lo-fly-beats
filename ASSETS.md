# Assets

| Asset | Kind | Source and license | Path |
|---|---|---|---|
| Scene SVG components | Original artwork made for this project, drawn as React SVG components; no external images or fonts. | Original project artwork. | `src/scene/Scene.tsx`, `src/scene/SceneFrame.tsx`, `src/scene/fly/Fly.tsx`, `src/scene/layers/Banana.tsx`, `src/scene/layers/Desk.tsx`, `src/scene/layers/Lighting.tsx`, `src/scene/layers/Rain.tsx`, `src/scene/layers/Wall.tsx`, `src/scene/layers/Window.tsx` |
| Audio | Drum (kick, snare, hat), rain, and crackle buffers generated in code; instruments from Tone synthesizers. No samples or recordings. | Generated in code; Tone synthesizers. | `src/audio/buffers.ts`, `src/audio/rig.ts` |
| Data | MaleCNS v1.0 files: `body-annotations-male-cns-v1.0-minconf-0.5.feather` and `connectome-weights-male-cns-v1.0-minconf-0.5.feather`. Licensed CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/). Citation: Berg, S., Beckett, I. R., Costa, M., Schlegel, P., Januszewski, M., et al. (2025). Sexual dimorphism in the complete connectome of the Drosophila male central nervous system. bioRxiv. https://doi.org/10.1101/2025.10.09.680999. Filtering rules: every neuron with status Traced, across all classes in the brain and ventral nerve cord; connections between selected bodies; self-connections removed; at least 3 synapses. No edge sampling or caps. | `public/data/circuits/whole-cns-v1/neurons.json.gzip`, `public/data/circuits/whole-cns-v1/adjacency.bin.gzip`, `public/data/circuits/whole-cns-v1/manifest.json`; previous `mbon-v1` data remains for regression checks. |
| Fonts | System fonts only; no font files. | System fonts. | None |

Update this file whenever an asset is added.

The listening room also includes original vector books, plants, a clock, and a turntable in `src/scene/layers/RoomDetails.tsx`. Interface icons in `src/components/Icon.tsx` and the network visualization in `src/components/scanner/` use original SVG and canvas. The scanner uses the credited MaleCNS connectivity data above with a deterministic schematic layout; it contains no anatomical imagery. The overview plots every traced neuron, with representative background links; playback and highlighted paths use the complete retained graph. All typography continues to use system fonts.
