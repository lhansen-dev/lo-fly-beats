# Funny things to do with a fly brain

Researched September 12, 2026.

The premise: give a fruit fly the responsibilities of a human adult. It has an extraordinary nervous system and absolutely no qualifications to chair a meeting.

**Best starting points:** build **LinkedInsect** for an approachable first project, **The Michelin-Starred Banana** for a funny simulation grounded in published research, or **Drosophila DMV** for a spectator game.

## What we actually have

“Google's fly brain map” could refer to several collaborations. The recent announcement is **MaleCNS**, a collaboration involving HHMI Janelia, the University of Cambridge, the MRC Laboratory of Molecular Biology, and Google Research. It maps an adult male fruit fly's brain and ventral nerve cord, with more than **166,000 neurons and approximately 125 million synaptic connections**. Google's article appeared September 3, 2026; the project's release history dates the public **v1.0 dataset to June 8, 2026**. [Google Research announcement](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/), [MaleCNS project and release history](https://male-cns.janelia.org/).

The earlier **FlyWire** resource maps an adult female brain. Its October 2024 flagship publication includes **139,255 proofread neurons**. It is a different specimen and dataset; its neuron identifiers and brain coverage should not be mixed with MaleCNS. [FlyWire project](https://home.flywire.ai/).

The useful ingredients are neuron annotations, directed connectivity, synapse counts, predicted neurotransmitters, and neuron geometry. MaleCNS offers queries through neuPrint and bulk downloads; the full connection table alone is listed at about **1.1 GB**. A small exported circuit is a sensible starting point for a web toy. [MaleCNS download documentation](https://male-cns.janelia.org/download/).

A connectome records anatomy. Running a simulation also requires assumptions about neuronal dynamics, effective connection strengths, sensory inputs, and outputs. Synapse counts are not measured physiological weights, and a wiring map does not supply a ready-made learning rule. Shiu and colleagues demonstrated a simplified spiking model for specific feeding and grooming circuits, while documenting limitations including omitted internal state and neuromodulation. This gives us a useful starting point for narrow experiments. [Shiu et al., Nature, 2024](https://doi.org/10.1038/s41586-024-07763-9).

There is already playful precedent: **DOOMFLY** connects a MaleCNS simulation to Doom, and **Fly64** connects one to Super Mario 64. DOOMFLY's current documentation explicitly reports that its experimental candidate has not demonstrated learned survival. These are useful engineering references, with substantial assumptions in their sensory and control interfaces. Our opportunity is a premise that stays funny when the controller performs badly. [DOOMFLY repository](https://github.com/nftechie/doomfly), [Fly64 repository](https://github.com/ornata/fly).

## How to read the ideas

These are proposed experiences. The dialogue, job titles, motivations, and personalities are comedy we add.

| Approach | How the connectome contributes | Main work |
| --- | --- | --- |
| **Graph** | Actual neurons, connections, annotations, or geometry determine the experience. | Data preparation and interface design. |
| **Model** | Simulated activity propagates through wiring taken from a specified dataset or circuit. | Neural dynamics, stimulus selection, and interpretable outputs. |
| **World** | A model receives inputs from a game and influences its actions. | Everything above, plus a sensory encoder and an engineered action interface. |
| **Body** | A controller interacts with a physics model or robot. | Mapping neural outputs to actuators and closing the sensory feedback loop. |

Effort labels below are relative estimates for small prototypes. A **Graph** project can meaningfully use the real map without simulating neural activity. A **Model** prototype can initially replay computed trials. Whole-brain simulation and realistic body control are separate increases in scope.

## Ideas

### 1. LinkedInsect

**Graph · Low effort · Best first build**

A professional networking site where every member is an actual neuron. Profiles display real connection counts, cell types, and locations alongside titles such as “Senior Associate, Banana Acquisition.”

- **The joke:** a neuron announces, “Humbled to share that I have made another connection.” Its entire career consists of making connections.
- **Use of the map:** connection partners populate the network; annotations populate profiles; a chosen graph metric determines featured members.
- **Smallest version:** a curated directory, one profile template, strongest incoming and outgoing partners, and an exportable profile card. Fictional job titles sit beside the scientific labels.
- **Extra bit:** premium membership lets you see who synapsed with you.

### 2. Six Degrees of Kevin Banana

**Graph · Low effort**

A journey planner through the brain. Pick two neurons and get a transit itinerary through their connections.

- **The joke:** “Your route includes three transfers and an unexplained stop at Grooming.”
- **Use of the map:** compute directed paths on a documented subset, showing the synapse count for each connection. These are structural routes; the itinerary does not establish how signals actually travel.
- **Smallest version:** ten curated endpoints, shortest paths, and a subway-style display. An unreachable destination produces a very apologetic transit notice.
- **Extra bit:** “Signal replacement bus service” appears when a user hides an edge.

### 3. IKEA Brain Assembly

**Graph · Low to medium effort**

An assembly puzzle where players reconnect a small real circuit using instructions of steadily declining usefulness.

- **The joke:** the instruction booklet's final step is “Attach remaining consciousness.” There is one synapse left over.
- **Use of the map:** the original connectivity is the puzzle's answer key. Neuron shape and connection counts provide clues.
- **Smallest version:** show a circuit of roughly a dozen neurons, remove a few connections, and let the player restore them. Success means matching the selected graph.
- **Extra bit:** all replacement parts are named things like SYNÅPS.

### 4. Fruitfly FM

**Graph · Medium effort**

A musical instrument built from the wiring graph. Click a neuron to launch a musical traversal; branches become harmonies and revisits become loops.

- **The joke:** its debut album is *Songs to Find a Banana To*. Every track eventually becomes the same bassline.
- **Use of the map:** connectivity determines which notes can follow which; synapse counts and regions influence volume and instrumentation through explicit artistic rules.
- **Smallest version:** one circuit, a bounded traversal, three instruments, and a record button. Describe it as sonification of structure.
- **Extra bit:** the DJ keeps interrupting its own set to clean its antennae.

### 5. Zillow for Neurons

**Graph · Medium effort**

Browse neuron morphologies as increasingly desperate real-estate listings.

- **The joke:** “Cozy arbor. Excellent connectivity. Shared neuropil. No parking.” A neuron with many incoming partners is advertised as “perfect for entertaining.”
- **Use of the map:** actual skeletons or meshes become property tours; locations, cable geometry, and partner counts determine listing features.
- **Smallest version:** twenty selected neurons, rotating geometry, filters, and templated descriptions.
- **Extra bit:** every listing is “steps from the mushroom body,” even when the map visibly disagrees. Put that claim in the fictional agent's copy, while the actual location stays visible.

### 6. The Michelin-Starred Banana

**Model · Medium effort · Best science/comedy balance**

A restaurant critic evaluates elaborate virtual dishes that reduce to a few taste stimuli.

- **The joke:** “The chef's tasting menu lacked ambition. The drop of sugar water was transcendent.”
- **Use of the map:** vary stimulation of identified taste inputs and display a feeding-related model readout. The published Shiu model supplies a concrete taste-processing starting point. [Paper and experimental scope](https://doi.org/10.1038/s41586-024-07763-9).
- **Smallest version:** sugar and bitter input sliders, a response plot, a simple proboscis animation, and reviews selected from response bands. Begin with the reference model's dataset and settings.
- **Extra bit:** the tasting menu costs 400 imaginary dollars; the fly recommends the table spill.

### 7. Banana Boardroom

**Model · Medium effort**

Present business proposals to a board whose voting system is a feeding-circuit simulation.

- **The joke:** the board rejects international expansion and unanimously approves “banana, but closer.” The meeting minutes contain the word “banana” 37 times.
- **Use of the map:** each proposal visibly maps to chosen stimulus settings; model responses determine a fictional board vote. The proposal text is for the audience, and the model receives those numerical inputs.
- **Smallest version:** four proposal cards and the taste-response engine from idea 6. Show the input mapping and actual response beneath the verdict.
- **Extra bit:** an annual report celebrates “strong growth in adjacent fruit.”

### 8. FlyOps: Banana Production Is Down

**Model · Medium effort**

A control room treats a small neural simulation like a production service. Stimulate a circuit and watch its activity dashboard erupt into fictional incident reports.

- **The joke:** “SEV-1: Sugar detected. All other priorities suspended.” The incident commander is also the incident.
- **Use of the map:** the dependency view comes from real connectivity; charts come from simulated activity; incident text follows predefined thresholds.
- **Smallest version:** one repeatable stimulus, a few readout groups, and an incident replay timeline.
- **Extra bit:** the postmortem's corrective action is “move banana closer.”

### 9. Antenna ASMR

**Model · Medium effort**

A miniature spa where users brush a virtual antenna and watch a grooming-related circuit respond.

- **The joke:** “Welcome to your 90-minute antenna reset.” Every treatment is the same tiny brush, with a different price.
- **Use of the map:** turn brush movement into artificial stimulation of selected mechanosensory inputs, then read grooming-related outputs. Shiu et al. investigated an antennal grooming circuit, making this a focused extension to explore. [Grooming model research](https://doi.org/10.1038/s41586-024-07763-9).
- **Smallest version:** one input-strength control, computed response traces, and an authored grooming animation driven by a response threshold.
- **Extra bit:** a five-star review reads, “Antenna.”

### 10. CAPTCHA: Prove You Are Not a Fruit Fly

**Model · Medium effort**

A party game presents pairs of responses: one from the chosen circuit model and one from a random or simple scripted baseline. Players guess which used the connectome.

- **The joke:** the challenge is “Select all squares that contain an opportunity to abandon your responsibilities for sugar.”
- **Use of the map:** a recorded stimulus and model response generate one side of each round. The comparison makes the wiring's contribution something players can investigate.
- **Smallest version:** ten recorded trials with response plots, an answer reveal, and aggregate scores. Use it as a game, with no claim of authentication security.
- **Extra bit:** repeated failure earns the message “We suspect you are several flies in a coat.”

### 11. Bug Bounty

**Model · Medium to high effort**

A debugging game: a known stimulus-response experiment stops working, and players must identify which modeled neuron or connection was disabled.

- **The joke:** the ticket says, “Steps to reproduce: banana. Expected: banana. Actual: nothing.”
- **Use of the map:** compare a baseline simulation with a controlled perturbation, using actual connectivity to investigate the change.
- **Smallest version:** precompute a working circuit and a handful of perturbations with observable effects. Let players inspect traces and restore the hidden change.
- **Extra bit:** closing a ticket awards a certification in Advanced Bug Debugging.

### 12. Drosophila DMV

**World · High effort · Best spectator game**

A fly-controlled vehicle takes a driving test: stay in a lane, avoid cones, and resist a distracting virtual fruit stand.

- **The joke:** “Automatic failure: attempted to park inside the examiner's lunch.”
- **Use of the map:** a selected circuit model receives coarse visual or synthetic sensory signals. A documented readout maps activity to steering and throttle; that mapping needs calibration.
- **Smallest version:** one short 2D course, two control outputs, collision detection, and an examiner who narrates observable mistakes. The fruit stand emits an explicitly artificial attraction cue.
- **Extra bit:** a printable license says “Restrictions: fruit.”

### 13. Cookie Consent Speedrun

**World · High effort**

A model controls a cursor through a fake website full of popups, moving buttons, and one enormous cookie image.

- **The joke:** after twelve minutes, the fly accepts the cookie photograph and declines the entire internet.
- **Use of the map:** simplified screen stimuli enter a selected model; decoded activity moves a cursor. Button meaning exists in the game rules, so performance is about the engineered interface.
- **Smallest version:** a standalone three-screen parody with a small action set and a timed replay.
- **Extra bit:** the final boss is a close button that relocates whenever the cursor approaches.

### 14. Twitch Feeds a Fly

**World · High effort**

A shared spectator arena where the audience places stimuli and watches one controller attempt an extremely modest objective.

- **The joke:** hundreds of people hold an emergency vote on whether to move a banana three pixels to the left.
- **Use of the map:** votes modify the environment's input signals; the circuit model and its action adapter determine movement.
- **Smallest version:** a local audience-control panel, one 2D arena, one food cue, and fixed-length rounds. Add shared online voting after the loop works.
- **Extra bit:** the commentator treats the first successful turn as a historic sporting achievement.

### 15. Untitled Fly Game

**World · High effort**

A tiny domestic nuisance simulator. The model controls a fly while the game scores landing on a sandwich, crossing someone's screen, and escaping a glass.

- **The joke:** “Objective completed: be briefly mistaken for a dead pixel.”
- **Use of the map:** scene features become sensory inputs; model activity influences movement. The mischievous objectives are authored scoring rules.
- **Smallest version:** one tabletop, a sandwich, a glass, and a small controller. A player moves objects to help the fly rack up nuisance points.
- **Extra bit:** the ultimate achievement is “Entered room. Forgot why. Stayed.”

### 16. Fly vs. Fly vs. If Statement

**World · High effort**

The world's least prestigious robot Olympics: a connectome-derived controller competes against a random walker and a tiny hand-coded policy.

- **The joke:** the announcer introduces the biological architecture with orchestral music, then introduces its opponent: “if banana_left: turn_left.”
- **Use of the map:** one contestant uses the selected wiring; all contestants receive equivalent observations and action options.
- **Smallest version:** a repeatable 2D cue-following course, a score table, and replays. Repeat across seeds before interpreting a win.
- **Extra bit:** the trophy is an aging grape. This also supplies useful baselines for the other game ideas.

### 17. A Fly on the Wall

**Model · Medium effort**

A meeting companion listens to a prerecorded audio clip and produces a tiny, spectacularly unhelpful reaction reel.

- **The joke:** its meeting summary is “Noise happened. Consider fruit.”
- **Use of the map:** map the audio envelope to declared artificial input pulses, then use model responses to choose reactions. This mapping is an artistic input scheme, with no claim that the fly recognizes speech.
- **Smallest version:** one included audio sample, an input pulse display, circuit traces, and a few reaction animations.
- **Extra bit:** a “strategic alignment” meter is simply a clearly labeled activity readout wearing a tie.

### 18. OnlyFlies

**Graph first; Model as a research extension · Medium to very high effort**

A dating-show interface for exploring annotated courtship-related circuitry. Contestant introductions are neuron profiles; connections determine who can send a signal to whom.

- **The joke:** “My love language is unilateral wing vibration.” Every contestant lists “fruit” among their interests.
- **Use of the map:** curate documented cell types and connections, with links to the relevant research. MaleCNS includes resources for investigating sex-related circuit differences. [Google's account of the research](https://research.google/blog/a-connectomics-milestone-mapping-the-complete-male-fruit-fly-brain/).
- **Smallest version:** an illustrated circuit tour with fictional dating-show commentary. A courtship simulation would require its own functional model and validation.
- **Extra bit:** the reunion episode is a connectivity matrix.

### 19. A Roomba with Strong Opinions

**Body · Very high effort**

A simulated floor robot uses a fly-derived controller and receives an artificial food cue where the crumbs are.

- **The joke:** the vacuum submits a workplace grievance when someone empties its delicious dustbin.
- **Use of the map:** derive a controller from a selected sensory circuit, then explicitly map its outputs to the robot's wheels. The robot chassis and controller adapter are our engineering additions.
- **Smallest version:** a differential-drive robot in a simple simulated room, with two sensors and two motors. Establish useful behavior there before considering hardware.
- **Extra bit:** its cleaning report says, “Removed zero crumbs. Formed a meaningful relationship with seven.”

### 20. Microsoft Flight Stimulator

**Body · Very high effort**

A lavish flight simulator devoted to the journey from one side of a kitchen to the other. Boarding begins immediately; the pilot is distracted by a bowl.

- **The joke:** “We are currently cruising at an altitude of 14 centimeters.” The safety card explains how to exit through the window that is already open.
- **Use of the map:** investigate a connectome-derived controller coupled to a fly body simulation. The research software `flybody` provides flight and walking environments; connecting neural outputs to its actuators is additional work. [Turaga Lab's flybody](https://github.com/TuragaLab/flybody).
- **Smallest version:** establish the body environment with a reference controller, then replace one steering input with a calibrated circuit readout and compare behavior.
- **Extra bit:** passenger complaints are all submitted by the same fly.

### 21. Lofly - Beats to Buzz to

**Graph first; Model for later variations · Medium effort**

A lofi beats creator hosted by an animated fly in oversized headphones, studying beside an overripe banana while rain runs down the kitchen window.

- **The joke:** “Beats to relax / repeatedly fly into the same window to.” The fly has six sleeves on its hoodie and is still behind on its homework.
- **Use of the map:** traverse a small real circuit to choose bass and chord motifs, using connection weights to influence the next step. Fit those choices to a musical scale and beat grid, then add swung drums, warm keys, and vinyl crackle. A later simulation could modulate filters and drum density with modeled activity; the musical mapping is our composition system.
- **Smallest version:** one circuit, play/pause, tempo and variation controls, three instrument layers, and a short audio export. Presets include “Rainy Windowsill,” “Overripe at 2 AM,” and “Fruit Bowl Finals.”
- **Extra bit:** the debut single is *No Thoughts, Only Fruit*. Every few minutes, the fly pauses its homework to rub its hands together like it has finally understood jazz.

## What I would build first

| Pick | Why it stands out | First milestone | Main uncertainty |
| --- | --- | --- | --- |
| **LinkedInsect** | The map supplies the joke directly, and a single profile is easy to share. | Render a real neuron's profile and verified connection partners from MaleCNS. | Selecting readable annotations and useful examples. |
| **The Michelin-Starred Banana** | A very small interaction connects absurd reviews to a published sensory-processing model. | Reproduce a reference taste-response result and attach one animated review. | Reproducing the model and preserving its dataset assumptions. |
| **Drosophila DMV** | Success and failure both produce a good spectator moment. | Complete a short driving scene with a baseline controller, then measure what the circuit interface changes. | Whether the sensory and action mappings produce usable control. |

**Recommended sequence:** start with LinkedInsect and use its neuron inspector inside later projects. Build the restaurant critic around reproduced taste trials next; Banana Boardroom and FlyOps can reuse that work. Treat DMV as the larger experiment once stimulus encoding and model readouts are understood.

For the first graph prototype, export a curated set of MaleCNS annotations and connections, retain their original identifiers, and ship a small static dataset with source attribution. For the first neural prototype, use the Shiu reference implementation's own data before attempting a MaleCNS port. Record the dataset release, selected neurons, model assumptions, and authored action mappings so the joke has something concrete behind it.

## Useful starting resources

| Resource | What to use it for |
| --- | --- |
| [MaleCNS project](https://male-cns.janelia.org/) | Dataset identity, collaborators, release history, and exploration links. |
| [MaleCNS downloads](https://male-cns.janelia.org/download/) | Annotations, connection tables, geometry, and programmatic access. neuPrint API access requires an account and token; bulk files are linked separately. |
| [FlyWire](https://home.flywire.ai/) and [its Connectome Data Explorer](https://codex.flywire.ai/) | Explore the earlier female-brain resource and its annotations. |
| [Shiu et al. paper](https://doi.org/10.1038/s41586-024-07763-9) and [reference implementation](https://github.com/philshiu/Drosophila_brain_model) | Reproduce a focused feeding or grooming model before adapting it. |
| [DOOMFLY](https://github.com/nftechie/doomfly) and [Fly64](https://github.com/ornata/fly) | Study existing game integrations, their explicit assumptions, and their limitations. |
| [flybody](https://github.com/TuragaLab/flybody) | Explore a physics body and locomotion tasks for the most ambitious ideas. |

The strongest recurring joke is a very serious interface reporting a very small problem: **“All systems operational. Banana unavailable.”**
