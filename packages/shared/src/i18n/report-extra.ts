import type { Locale } from '../domain.js'

// Report texts that did not exist in the previous tool (Auto Triage, alert access, interactive mode).
const en = {
  aiTitle: 'Auto Triage',
  aiIntro:
    'During the PoC, Stellar Cyber Auto Triage was evaluated: the platform reviews each case and gives a verdict (True Positive, False Positive, Benign or Inconclusive). The figures below come from the Auto Triage API for the analysed cases of the period.',
  aiUnavailable: 'Auto Triage was marked as tested, but this Instance does not expose Auto Triage verdicts through the API (available on Stellar Cyber 7.x).',
  aiNone: 'Auto Triage was marked as tested, but no analysed case of the period has an AI verdict yet.',
  aiCoverage: 'AI verdict on {n} of {t} analysed cases ({p}%) · {ch} of {cht} Critical/High.',
  aiSummary: '{fp}% of the cases with an AI verdict were classified as False Positive or Benign: work the team does not need to investigate.',
  aiSmallSample: 'Small sample: only {n} case(s) have an AI verdict, so these percentages are an indication only.',
  aiChart: 'AI verdicts (analysed cases)',
  aiTableTitle: 'Critical and High cases with an AI verdict',
  aiColVerdict: 'AI verdict',
  aiNote: 'Verdicts as returned by the Auto Triage API at collection time. Cases without a verdict were not triaged by the AI.',
  licAutoTriageTitle: '7.5 Auto Triage License',
  licAutoTriage:
    'Auto Triage was evaluated in this PoC. It is licensed separately (add-on), on top of the asset or volume license. To keep the AI triage of alerts in production, include the Auto Triage license in the proposal. A trial license is available for evaluation.',
  alertAccess:
    'The alerts of {n} case(s) could not be read with the credential used for collection (no permission); their tactics and techniques are not included.',
  removed: 'removed',
  presentFullscreen: 'Full screen',
  presentPrev: 'Previous section',
  presentNext: 'Next section',
  presentPrint: 'Print / PDF',
  verNewSync: 'New data collection ({start}–{end})',
  tipOfTotal: '{p}% of the total',
  tipTacticDetected: '{c} cases · {a} alerts',
  tipTacticNone: 'No alert of this tactic in the period',
  tipHeat: '{d} {h}:00–{h}:59 UTC · {n} Critical/High case(s)',
  tipPoint: 'score {s} · {a} alerts · {q}',
  kpiTipCases: 'All cases created in the period across every severity, as reported by the API.',
  kpiTipMitre: 'MITRE ATT&CK Enterprise tactics with at least one alert in the analysed cases, out of 14.',
  kpiTipAssets: 'Daily licensed asset count (devices and users) averaged over the period.',
  kpiTipConnectors: 'Configured connectors that are active, out of all configured connectors.',
  kpiTipOpen: 'Cases still with status New or Open.',
  kpiTipVolume: 'Daily licensing volume (after enrichment and compression) summed over the period.',
}
type Extra = typeof en

const ptBR: Extra = {
  aiTitle: 'Auto Triage',
  aiIntro:
    'Durante a PoC foi avaliado o Auto Triage da Stellar Cyber: a plataforma analisa cada case e dá um veredito (Verdadeiro Positivo, Falso Positivo, Benigno ou Inconclusivo). Os números abaixo vêm da API do Auto Triage para os cases analisados no período.',
  aiUnavailable: 'O Auto Triage foi marcado como testado, mas esta instância não disponibiliza os vereditos da IA pela API (disponível na Stellar Cyber 7.x).',
  aiNone: 'O Auto Triage foi marcado como testado, mas nenhum case analisado no período tem veredito da IA ainda.',
  aiCoverage: 'Veredito da IA em {n} de {t} cases analisados ({p}%) · {ch} de {cht} Críticos/Altos.',
  aiSummary: '{fp}% dos cases com veredito da IA foram classificados como Falso Positivo ou Benigno: trabalho que a equipe não precisa investigar.',
  aiSmallSample: 'Amostra pequena: só {n} case(s) têm veredito da IA; leia esses percentuais apenas como indicação.',
  aiChart: 'Vereditos da IA (cases analisados)',
  aiTableTitle: 'Cases Críticos e Altos com veredito da IA',
  aiColVerdict: 'Veredito da IA',
  aiNote: 'Vereditos como retornados pela API do Auto Triage no momento da coleta. Cases sem veredito não foram triados pela IA.',
  licAutoTriageTitle: '7.5 Licença Auto Triage',
  licAutoTriage:
    'O Auto Triage foi avaliado nesta PoC. É um recurso licenciado à parte (add-on), adicional à licença de ativos ou de volume. Para manter a triagem automática dos alertas pela IA em produção, inclua a licença Auto Triage na proposta. Há licença de avaliação (trial) disponível.',
  alertAccess:
    'Os alertas de {n} case(s) não puderam ser lidos com a credencial usada na coleta (sem permissão); táticas e técnicas desses cases não estão incluídas.',
  removed: 'removido',
  presentFullscreen: 'Tela cheia',
  presentPrev: 'Seção anterior',
  presentNext: 'Próxima seção',
  presentPrint: 'Imprimir / PDF',
  verNewSync: 'Nova coleta de dados ({start}–{end})',
  tipOfTotal: '{p}% do total',
  tipTacticDetected: '{c} cases · {a} alertas',
  tipTacticNone: 'Nenhum alerta desta tática no período',
  tipHeat: '{d} {h}:00–{h}:59 UTC · {n} case(s) Crítico(s)/Alto(s)',
  tipPoint: 'score {s} · {a} alertas · {q}',
  kpiTipCases: 'Todos os cases criados no período, de todas as severidades, conforme a API.',
  kpiTipMitre: 'Táticas do MITRE ATT&CK Enterprise com ao menos um alerta nos cases analisados, de 14.',
  kpiTipAssets: 'Contagem diária de ativos licenciados (dispositivos e usuários), média do período.',
  kpiTipConnectors: 'Connectors configurados que estão ativos, sobre o total configurado.',
  kpiTipOpen: 'Cases ainda com status Novo ou Aberto.',
  kpiTipVolume: 'Volume diário de licenciamento (após enriquecimento e compressão) somado no período.',
}

const es: Extra = {
  aiTitle: 'Auto Triage',
  aiIntro:
    'Durante la PoC se evaluó el Auto Triage de Stellar Cyber: la plataforma analiza cada caso y emite un veredicto (Verdadero Positivo, Falso Positivo, Benigno o Inconcluso). Las cifras provienen de la API de Auto Triage para los casos analizados del período.',
  aiUnavailable: 'El Auto Triage se marcó como probado, pero esta instancia no expone los veredictos de la IA por API (disponible en Stellar Cyber 7.x).',
  aiNone: 'El Auto Triage se marcó como probado, pero ningún caso analizado del período tiene veredicto de la IA todavía.',
  aiCoverage: 'Veredicto de la IA en {n} de {t} casos analizados ({p}%) · {ch} de {cht} Críticos/Altos.',
  aiSummary: 'El {fp}% de los casos con veredicto de la IA se clasificó como Falso Positivo o Benigno: trabajo que el equipo no necesita investigar.',
  aiSmallSample: 'Muestra pequeña: solo {n} caso(s) tienen veredicto de la IA; lea estos porcentajes solo como indicación.',
  aiChart: 'Veredictos de la IA (casos analizados)',
  aiTableTitle: 'Casos Críticos y Altos con veredicto de la IA',
  aiColVerdict: 'Veredicto de la IA',
  aiNote: 'Veredictos tal como los devolvió la API de Auto Triage en el momento de la recolección. Los casos sin veredicto no fueron triados por la IA.',
  licAutoTriageTitle: '7.5 Licencia Auto Triage',
  licAutoTriage:
    'El Auto Triage se evaluó en esta PoC. Es un recurso con licencia aparte (add-on), adicional a la licencia de activos o de volumen. Para mantener el triaje automático de alertas por la IA en producción, incluya la licencia Auto Triage en la propuesta. Hay licencia de evaluación (trial) disponible.',
  alertAccess:
    'Las alertas de {n} caso(s) no pudieron leerse con la credencial usada en la recolección (sin permiso); sus tácticas y técnicas no están incluidas.',
  removed: 'eliminado',
  presentFullscreen: 'Pantalla completa',
  presentPrev: 'Sección anterior',
  presentNext: 'Sección siguiente',
  presentPrint: 'Imprimir / PDF',
  verNewSync: 'Nueva recolección de datos ({start}–{end})',
  tipOfTotal: '{p}% del total',
  tipTacticDetected: '{c} casos · {a} alertas',
  tipTacticNone: 'Ninguna alerta de esta táctica en el período',
  tipHeat: '{d} {h}:00–{h}:59 UTC · {n} caso(s) Crítico(s)/Alto(s)',
  tipPoint: 'score {s} · {a} alertas · {q}',
  kpiTipCases: 'Todos los casos creados en el período, de todas las severidades, según la API.',
  kpiTipMitre: 'Tácticas de MITRE ATT&CK Enterprise con al menos una alerta en los casos analizados, de 14.',
  kpiTipAssets: 'Conteo diario de activos licenciados (dispositivos y usuarios), promedio del período.',
  kpiTipConnectors: 'Conectores configurados que están activos, sobre el total configurado.',
  kpiTipOpen: 'Casos aún con estado Nuevo o Abierto.',
  kpiTipVolume: 'Volumen diario de licenciamiento (tras enriquecimiento y compresión) sumado en el período.',
}

export type ExtraKey = keyof Extra
const catalogues: Record<Locale, Extra> = { en, 'pt-BR': ptBR, es }
export const reportExtra = (locale: Locale): Extra => catalogues[locale]

/** AI verdict labels per language. */
export const AI_VERDICT_LABELS: Record<Locale, Record<string, string>> = {
  en: { 'True Positive': 'True Positive', 'False Positive': 'False Positive', 'Benign True Positive': 'Benign True Positive', Benign: 'Benign', Inconclusive: 'Inconclusive' },
  'pt-BR': { 'True Positive': 'Verdadeiro Positivo', 'False Positive': 'Falso Positivo', 'Benign True Positive': 'Verdadeiro Positivo Benigno', Benign: 'Benigno', Inconclusive: 'Inconclusivo' },
  es: { 'True Positive': 'Verdadero Positivo', 'False Positive': 'Falso Positivo', 'Benign True Positive': 'Verdadero Positivo Benigno', Benign: 'Benigno', Inconclusive: 'Inconcluso' },
}
