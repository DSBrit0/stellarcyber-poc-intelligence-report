import type { ReportContext } from '../context.js'
import { Appendices, SectionConclusion, SectionNextSteps, SectionOperations, SectionRisks, SectionRoi } from '../sections/closing.js'
import { Section4 } from '../sections/detection.js'
import { Section5 } from '../sections/mitre.js'
import { Cover, Section1, Section2, Section3 } from '../sections/overview.js'

/** Template 2 — Executive: Risks right after MITRE; sections are numbered by render order. */
export function ExecutiveTemplate({ rc }: { rc: ReportContext }) {
  return (
    <main className="report executive">
      <Cover rc={rc} />
      <Section1 rc={rc} />
      <Section2 rc={rc} />
      <Section3 rc={rc} />
      <Section4 rc={rc} />
      <Section5 rc={rc} />
      <SectionRisks rc={rc} />
      <SectionOperations rc={rc} />
      <SectionRoi rc={rc} />
      <SectionNextSteps rc={rc} />
      <SectionConclusion rc={rc} />
      <Appendices rc={rc} />
    </main>
  )
}
