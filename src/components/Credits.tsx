import { LOADING_TEXT } from '../app/copy'
import { useAppState } from '../app/store'
import { MAPPING_VERSION } from '../music/versions'

export default function Credits() {
  const manifest = useAppState(state => state.circuit.manifest)
  const citationDoi = manifest?.source.citation.match(/https:\/\/doi\.org\/\S+/)?.[0]

  return <section id="credits" data-testid="credits" className="credits">
    <h2>Credits</h2>
    {manifest === null ? <p>{LOADING_TEXT}</p> : <>
      <p>Data: <a href={manifest.source.homepage}>{manifest.source.dataset}</a> {manifest.source.release}</p>
      <p>Created by the MaleCNS collaboration: FlyEM at HHMI Janelia, the University of Cambridge Department of Zoology, the MRC Laboratory of Molecular Biology, and Google Research.</p>
      <p>{manifest.source.citation}</p>
      {citationDoi && <a data-testid="credits-doi" href={citationDoi}>{citationDoi}</a>}
      <p><a href={manifest.source.paperUrl}>Published paper</a></p>
      <p><a data-testid="credits-license" href={manifest.license.url}>{manifest.license.name}</a></p>
      <p data-testid="credits-attribution">{manifest.license.attribution}</p>
      <ul>{manifest.extraction.rules.map((rule, index) => <li key={index}>{rule}</li>)}</ul>
    </>}
    <p>The musical mapping (version {MAPPING_VERSION}) is authored and does not simulate neural activity.</p>
  </section>
}
