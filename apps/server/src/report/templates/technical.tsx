import type { ReportContext } from '../context.js'
import { Appendices, SectionConclusion, SectionNextSteps, SectionOperations, SectionRisks, SectionRoi } from '../sections/closing.js'
import { Section4 } from '../sections/detection.js'
import { Section5 } from '../sections/mitre.js'
import { ArchitecturePage, Cover, Section1, Section2, Section3 } from '../sections/overview.js'
import { CaptionLists } from '../ui.js'

/**
 * Template 1 — Technical: the Executive Template's section order, plus the architecture page and the response flow,
 * and the lists of figures and tables after the cover.
 */
export function TechnicalTemplate({ rc, archImage }: { rc: ReportContext; archImage: string | null }) {
  return (
    <main className="report technical">
      <Cover rc={rc} />
      <CaptionLists rc={rc} />
      <Section1 rc={rc} />
      <Section2 rc={rc} />
      <ArchitecturePage rc={rc} image={archImage} />
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
