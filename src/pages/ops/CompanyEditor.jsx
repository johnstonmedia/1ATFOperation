import { useState } from 'react'
import { useData } from '../../context/DataContext'
import { useAudit } from '../../hooks/useAudit'
import { OpsHeader, useSaved } from './OperationsCentre'
import { Field } from './NarrativeEditor'
import { COMPANIES } from '../../firebase/seed'

// Edits the per-company pages users see in their hamburger menu: role, standing
// duties and standing tasks.
export default function CompanyEditor() {
  const { state, updateSlice } = useData()
  const audit = useAudit()
  const [pages, setPages] = useState(state.companyPages)
  const [letter, setLetter] = useState('A')
  const [saved, flash] = useSaved()

  const page = pages[letter] || { name: '', role: '', duties: [], tasks: [] }
  const setPage = (patch) => setPages({ ...pages, [letter]: { ...page, ...patch } })
  const save = () => { updateSlice('companyPages', pages); audit('Updated company pages', `${letter}-COY`); flash() }

  const listField = (key) => ({
    value: (page[key] || []).join('\n'),
    onChange: (e) => setPage({ [key]: e.target.value.split('\n').filter((s) => s.trim()) }),
  })

  return (
    <div>
      <OpsHeader title="Company Pages" sub="TASKING // PER-COMPANY" updatedAt={state.contentMeta?.companyPages?.updatedAt}>
        <button className="primary" onClick={save}>{saved ? 'Saved ✓' : 'Save'}</button>
      </OpsHeader>

      <div className="row" style={{ gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {COMPANIES.map((c) => (
          <button
            key={c.letter}
            className={letter === c.letter ? 'primary' : 'ghost'}
            onClick={() => setLetter(c.letter)}
            style={letter === c.letter ? { borderColor: c.accent } : {}}
          >
            {c.name} ({c.letter})
          </button>
        ))}
      </div>

      <div className="panel panel-pad col" style={{ maxWidth: 700 }}>
        <Field label="Role in the operation"><textarea rows={3} value={page.role || ''} onChange={(e) => setPage({ role: e.target.value })} /></Field>
        <Field label="Standing duties (one per line)"><textarea rows={4} {...listField('duties')} /></Field>
        <Field label="Standing tasks (one per line)"><textarea rows={4} {...listField('tasks')} /></Field>
        <div className="mono dim" style={{ fontSize: 11 }}>
          Distributed Digital Activities targeting this company appear automatically alongside these.
        </div>
      </div>
    </div>
  )
}
