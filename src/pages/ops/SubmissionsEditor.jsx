import { OpsHeader } from './OperationsCentre'
import ApprovalsQueue from '../../components/ApprovalsQueue'

// RHQ approval queue. Company Commanders submit intel changes here; RHQ approves
// them as-is or edits first, then publishes to the live `intel` slice.
//
// The queue itself lives in components/ApprovalsQueue so that an 'RHQ Staff'
// account gets the identical surface inside the Staff Centre — this file is
// only the Ops Centre's chrome around it.
export default function SubmissionsEditor() {
  return <ApprovalsQueue Header={OpsHeader} />
}
