import type { ReportContext } from '../context.js'
import { Appendices, SectionConclusion, SectionNextSteps, SectionOperations, SectionRisks, SectionRoi } from '../sections/closing.js'
import { Section4 } from '../sections/detection.js'
import { Section5 } from '../sections/mitre.js'
import { ArchitecturePage, Cover, Section1, Section2, Section3 } from '../sections/overview.js'

/** Template 1 — Technical: the previous tool's section order (spec §1). */
export function TechnicalTemplate({ rc, archImage }: { rc: ReportContext; archImage: string | null }) {
  return (
    <main className="report technical">
      <Cover rc={rc} />
      <Section1 rc={rc} />
      <Section2 rc={rc} />
      <ArchitecturePage rc={rc} image={archImage} />
      <Section3 rc={rc} />
      <Section4 rc={rc} />
      <Section5 rc={rc} />
      <SectionOperations rc={rc} />
      <SectionRoi rc={rc} />
      <SectionRisks rc={rc} />
      <SectionNextSteps rc={rc} />
      <SectionConclusion rc={rc} />
      <Appendices rc={rc} />
    </main>
  )
}
