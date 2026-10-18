import {
  AnswerInput,
  ApproveInput,
  BriefingInput,
  CreateExperienceInput,
  CustomerQuestionInput,
  GoToStageInput,
  LabAccessInput,
  PhaseInput,
  ReplyInput,
  SceneState,
  STAGE_IDS,
  StageId,
  UpdateExperienceInput,
  ViewInput,
  answerSchema,
  hasQuestion,
  applyView,
  clearFocus,
  viewOf,
  mergeAnswers,
  stageById,
  stagesForProfile,
  type AnswerValue,
  type DataSourcesValue,
} from '@poc-intel/shared'
import { and, asc, eq, inArray, sql as dsql } from 'drizzle-orm'
import type { FastifyInstance, FastifyRequest } from 'fastify'
import { z } from 'zod'
import { requireAuth } from '../auth/guards.js'
import type { AuthContext } from '../auth/session.js'
import { db } from '../db/client.js'
import { experienceAnswers, experienceParticipants, experienceQuestions, experiences, experienceStageResults, pocDataSources, users, type Experience, type Poc } from '../db/schema.js'
import { audit } from '../lib/audit.js'
import { HttpError, notFound, parse } from '../lib/http.js'
import { canJoinExperience, canRunExperience, loadPocAccess } from '../pocs/access.js'
import { getCatalogState } from '../catalog/refresh.js'
import { canGoTo, canTransition, stageAfterSelection } from './flow.js'

const IdParam = z.object({ id: z.uuid() })
const ExpParams = z.object({ id: z.uuid(), expId: z.uuid() })
const StageParams = ExpParams.extend({ stageId: StageId })
const QuestionParams = ExpParams.extend({ questionId: z.uuid() })

interface Access {
  poc: Poc
  canRun: boolean
}

/** The PoC, if the caller takes part in its Stellar Experiences (`run`: may also lead them). Anyone else gets a 404. */
async function loadAccess(auth: AuthContext, pocId: string, mode: 'join' | 'run' = 'join'): Promise<Access> {
  const { poc, followerId } = await loadPocAccess(auth, pocId)
  if (!canJoinExperience(auth, poc, followerId)) throw notFound()
  const canRun = canRunExperience(auth, poc, followerId)
  if (mode === 'run' && !canRun) throw new HttpError(403, 'forbidden')
  return { poc, canRun }
}

async function loadExperience(pocId: string, expId: string): Promise<Experience> {
  const [exp] = await db
    .select()
    .from(experiences)
    .where(and(eq(experiences.id, expId), eq(experiences.pocId, pocId)))
    .limit(1)
  if (!exp) throw notFound()
  return exp
}

const requireActive = (exp: Experience) => {
  if (exp.status !== 'active') throw new HttpError(409, 'experience_not_active')
}

/** Participants answer and approve only the Stage the Presenter is on, once its question is open. */
const requireCurrent = (exp: Experience, stageId: StageId, phase?: 'question') => {
  if (exp.currentStage !== stageId) throw new HttpError(409, 'stage_not_current')
  // A presenting-only Stage has no question to open, answer or approve.
  if (phase && !hasQuestion(stageId)) throw new HttpError(409, 'no_question')
  if (phase && exp.currentPhase !== phase) throw new HttpError(409, 'question_not_open')
}

const isUniqueViolation = (e: unknown): boolean => {
  const err = e as { code?: string; cause?: unknown }
  return err?.code === '23505' || (err?.cause != null && isUniqueViolation(err.cause))
}

const touch = (expId: string) => db.update(experiences).set({ updatedAt: dsql`now()` }).where(eq(experiences.id, expId))

/** Approved Data Sources join the PoC Notebook's Data Sources, so they are entered once (ADR 0010). */
async function addToNotebook(pocId: string, userId: string, value: DataSourcesValue) {
  const existing = await db.select({ catalogId: pocDataSources.catalogId, kind: pocDataSources.kind, name: pocDataSources.name }).from(pocDataSources).where(eq(pocDataSources.pocId, pocId))
  const has = (s: DataSourcesValue['sources'][number]) =>
    existing.some((e) => (s.catalogId != null && e.catalogId === s.catalogId) || (e.kind === s.kind && e.name.toLowerCase() === s.name.toLowerCase()))
  for (const s of value.sources.filter((s) => !has(s))) {
    await db.insert(pocDataSources).values({
      pocId,
      kind: s.kind,
      catalogId: s.catalogId,
      name: s.name,
      updatedBy: userId,
      position: dsql`coalesce((SELECT max(position) FROM poc_data_sources WHERE poc_id = ${pocId}), 0) + 1`,
    })
  }
}

export async function experienceRoutes(app: FastifyInstance): Promise<void> {
  app.get('/pocs/:id/experiences', async (req) => {
    const auth = requireAuth(req)
    const { poc, canRun } = await loadAccess(auth, parse(IdParam, req.params).id)
    const rows = await db
      .select({
        id: experiences.id,
        name: experiences.name,
        profile: experiences.profile,
        status: experiences.status,
        stages: experiences.stages,
        createdAt: experiences.createdAt,
        finishedAt: experiences.finishedAt,
        settled: dsql<number>`(SELECT count(*)::int FROM experience_stage_results r WHERE r.experience_id = experiences.id)`,
        // Subqueries name the outer column in full: drizzle writes it unqualified, which the inner table would capture.
        // Customer Questions with neither a Reply nor "answered live": the SE's follow-up list.
        pendingQuestions: dsql<number>`(SELECT count(*)::int FROM experience_questions q WHERE q.experience_id = experiences.id AND q.reply IS NULL AND NOT q.answered_live)`,
      })
      .from(experiences)
      .where(eq(experiences.pocId, poc.id))
      .orderBy(asc(experiences.createdAt))
    // A Customer User sees only what has started: a Disabled Experience is the Presenter's draft.
    return { experiences: canRun ? rows : rows.filter((r) => r.status !== 'disabled'), canRun }
  })

  app.post('/pocs/:id/experiences', async (req, reply) => {
    const auth = requireAuth(req)
    const { poc } = await loadAccess(auth, parse(IdParam, req.params).id, 'run')
    const input = parse(CreateExperienceInput, req.body)
    const stages = stagesForProfile(input.profile)
    const [row] = await db
      .insert(experiences)
      .values({ pocId: poc.id, name: input.name, profile: input.profile, stages, currentStage: stages[0]!, createdBy: auth.user.id })
      .returning({ id: experiences.id })
    return reply.code(201).send(row)
  })

  app.patch('/pocs/:id/experiences/:expId', async (req) => {
    const auth = requireAuth(req)
    const { id, expId } = parse(ExpParams, req.params)
    const { poc } = await loadAccess(auth, id, 'run')
    const exp = await loadExperience(poc.id, expId)
    const input = parse(UpdateExperienceInput, req.body)
    const set: Partial<typeof experiences.$inferInsert> = { updatedAt: dsql`now()` as unknown as Date }
    if (input.name !== undefined) set.name = input.name
    if (input.stages !== undefined) {
      if (exp.status === 'finished') throw new HttpError(409, 'experience_finished')
      set.stages = input.stages
      set.currentStage = stageAfterSelection(STAGE_IDS, input.stages, exp.currentStage)
      if (set.currentStage !== exp.currentStage) {
        set.currentPhase = 'briefing'
        set.briefingOpen = []
        set.scene = { model: exp.scene.model, target: null }
      }
    }
    if (input.status !== undefined && input.status !== exp.status) {
      if (!canTransition(exp.status, input.status)) throw new HttpError(409, 'invalid_transition')
      set.status = input.status
      set.finishedAt = input.status === 'finished' ? (dsql`now()` as unknown as Date) : null
    }
    try {
      await db.update(experiences).set(set).where(eq(experiences.id, exp.id))
    } catch (e) {
      if (isUniqueViolation(e)) throw new HttpError(409, 'experience_already_active')
      throw e
    }
    if (input.status !== undefined && input.status !== exp.status) {
      const action = input.status === 'finished' ? 'experience.finished' : exp.status === 'finished' ? 'experience.reopened' : 'experience.activated'
      await audit({ action, userId: auth.user.id, target: poc.id, ip: req.ip, meta: { experienceId: exp.id, name: input.name ?? exp.name } })
    }
    return { ok: true }
  })

  // The live state every participant polls each second while the Experience is Active (ADR 0014).
  // Its own limit: a meeting room shares one IP, and ten people polling would exhaust the global one.
  app.get('/pocs/:id/experiences/:expId', { config: { rateLimit: { max: 1500, timeWindow: '1 minute' } } }, async (req) => {
    const auth = requireAuth(req)
    const { id, expId } = parse(ExpParams, req.params)
    const { poc, canRun } = await loadAccess(auth, id)
    const exp = await loadExperience(poc.id, expId)
    if (!canRun && exp.status === 'disabled') throw notFound()
    // Polling marks the caller present; written at most every five seconds per participant.
    if (exp.status === 'active') {
      await db
        .insert(experienceParticipants)
        .values({ experienceId: exp.id, userId: auth.user.id })
        .onConflictDoUpdate({
          target: [experienceParticipants.experienceId, experienceParticipants.userId],
          set: { lastSeenAt: dsql`now()` },
          setWhere: dsql`${experienceParticipants.lastSeenAt} < now() - interval '5 seconds'`,
        })
    }
    const [answers, results, questions, catalog, participants] = await Promise.all([
      db
        .select({ id: experienceAnswers.id, stageId: experienceAnswers.stageId, userId: experienceAnswers.userId, userName: users.name, value: experienceAnswers.value, updatedAt: experienceAnswers.updatedAt })
        .from(experienceAnswers)
        .innerJoin(users, eq(users.id, experienceAnswers.userId))
        .where(eq(experienceAnswers.experienceId, exp.id))
        .orderBy(asc(experienceAnswers.updatedAt)),
      db
        .select({ stageId: experienceStageResults.stageId, outcome: experienceStageResults.outcome, value: experienceStageResults.value, answerIds: experienceStageResults.answerIds, decidedAt: experienceStageResults.decidedAt })
        .from(experienceStageResults)
        .where(eq(experienceStageResults.experienceId, exp.id)),
      db
        .select({
          id: experienceQuestions.id,
          stageId: experienceQuestions.stageId,
          userId: experienceQuestions.userId,
          userName: users.name,
          text: experienceQuestions.text,
          reply: experienceQuestions.reply,
          answeredLive: experienceQuestions.answeredLive,
          createdAt: experienceQuestions.createdAt,
        })
        .from(experienceQuestions)
        .leftJoin(users, eq(users.id, experienceQuestions.userId))
        .where(eq(experienceQuestions.experienceId, exp.id))
        .orderBy(asc(experienceQuestions.createdAt)),
      getCatalogState(),
      // Who is in the session now (seen in the last 30 s), and anyone who confirmed their lab access.
      db
        .select({
          userId: experienceParticipants.userId,
          name: users.name,
          email: users.email,
          role: users.role,
          online: dsql<boolean>`${experienceParticipants.lastSeenAt} > now() - interval '30 seconds'`,
          labConfirmedAt: experienceParticipants.labConfirmedAt,
        })
        .from(experienceParticipants)
        .innerJoin(users, eq(users.id, experienceParticipants.userId))
        .where(and(eq(experienceParticipants.experienceId, exp.id), dsql`(${experienceParticipants.lastSeenAt} > now() - interval '30 seconds' OR ${experienceParticipants.labConfirmedAt} IS NOT NULL)`))
        .orderBy(asc(users.name)),
    ])
    return {
      experience: {
        id: exp.id,
        name: exp.name,
        profile: exp.profile,
        status: exp.status,
        stages: exp.stages,
        currentStage: exp.currentStage,
        currentPhase: exp.currentPhase,
        briefingOpen: exp.briefingOpen,
        scene: exp.scene,
        view: viewOf(exp.view),
        finishedAt: exp.finishedAt,
      },
      questions: questions.map((q) => ({ ...q, mine: q.userId === auth.user.id })),
      customerName: poc.details.customerName,
      // The documentation version the Briefings link to, the same one the Data Source Catalog reads.
      docsVersion: catalog.version?.segment ?? null,
      answers: answers.map((a) => ({ ...a, mine: a.userId === auth.user.id })),
      // E-mails only for whoever runs the session (to invite people to the lab) and for one's own row.
      participants: participants.map((p) => ({
        userId: p.userId,
        name: p.name,
        email: canRun || p.userId === auth.user.id ? p.email : null,
        customer: p.role === 'customer',
        online: p.online,
        labConfirmed: p.labConfirmedAt != null,
        mine: p.userId === auth.user.id,
      })),
      results,
      canRun,
      canAnswer: exp.status === 'active',
      // A Customer User may approve too; skipping and moving are the Presenter's.
      canApprove: exp.status === 'active',
    }
  })

  app.put('/pocs/:id/experiences/:expId/stages/:stageId/answer', async (req) => {
    const auth = requireAuth(req)
    const { id, expId, stageId } = parse(StageParams, req.params)
    const { poc } = await loadAccess(auth, id)
    const exp = await loadExperience(poc.id, expId)
    requireActive(exp)
    requireCurrent(exp, stageId, 'question')
    const { value: raw } = parse(AnswerInput, req.body)
    const value = parse(answerSchema(stageById(stageId).question), raw) as AnswerValue
    const [row] = await db
      .insert(experienceAnswers)
      .values({ experienceId: exp.id, stageId, userId: auth.user.id, value })
      .onConflictDoUpdate({ target: [experienceAnswers.experienceId, experienceAnswers.stageId, experienceAnswers.userId], set: { value, updatedAt: dsql`now()` } })
      .returning({ id: experienceAnswers.id })
    await touch(exp.id)
    return row
  })

  app.post('/pocs/:id/experiences/:expId/stages/:stageId/approve', async (req) => {
    const auth = requireAuth(req)
    const { id, expId, stageId } = parse(StageParams, req.params)
    const { poc } = await loadAccess(auth, id)
    const exp = await loadExperience(poc.id, expId)
    requireActive(exp)
    requireCurrent(exp, stageId, 'question')
    const { answerIds } = parse(ApproveInput, req.body)
    const chosen = await db
      .select({ id: experienceAnswers.id, value: experienceAnswers.value })
      .from(experienceAnswers)
      .where(and(eq(experienceAnswers.experienceId, exp.id), eq(experienceAnswers.stageId, stageId), inArray(experienceAnswers.id, answerIds)))
    if (chosen.length !== new Set(answerIds).size) throw notFound()
    // Merge in the order the approver picked them.
    const ordered = answerIds.map((a) => chosen.find((c) => c.id === a)!.value)
    const question = stageById(stageId).question
    const value = mergeAnswers(question, ordered)
    if (!value) throw new HttpError(400, 'approval_not_allowed')
    await db
      .insert(experienceStageResults)
      .values({ experienceId: exp.id, stageId, outcome: 'approved', value, answerIds, decidedBy: auth.user.id })
      .onConflictDoUpdate({
        target: [experienceStageResults.experienceId, experienceStageResults.stageId],
        set: { outcome: 'approved', value, answerIds, decidedBy: auth.user.id, decidedAt: dsql`now()` },
      })
    if (question.kind === 'data_sources') await addToNotebook(poc.id, auth.user.id, value as DataSourcesValue)
    await touch(exp.id)
    return { ok: true }
  })

  app.post('/pocs/:id/experiences/:expId/stages/:stageId/skip', async (req) => {
    const auth = requireAuth(req)
    const { id, expId, stageId } = parse(StageParams, req.params)
    const { poc } = await loadAccess(auth, id, 'run')
    const exp = await loadExperience(poc.id, expId)
    requireActive(exp)
    requireCurrent(exp, stageId)
    if (!hasQuestion(stageId)) throw new HttpError(409, 'no_question')
    await db
      .insert(experienceStageResults)
      .values({ experienceId: exp.id, stageId, outcome: 'skipped', value: null, answerIds: [], decidedBy: auth.user.id })
      .onConflictDoUpdate({
        target: [experienceStageResults.experienceId, experienceStageResults.stageId],
        set: { outcome: 'skipped', value: null, answerIds: [], decidedBy: auth.user.id, decidedAt: dsql`now()` },
      })
    await touch(exp.id)
    return { ok: true }
  })

  // The Presenter moves everyone: back to any Stage, forward only past settled ones.
  app.post('/pocs/:id/experiences/:expId/go', async (req: FastifyRequest) => {
    const auth = requireAuth(req)
    const { id, expId } = parse(ExpParams, req.params)
    const { poc } = await loadAccess(auth, id, 'run')
    const exp = await loadExperience(poc.id, expId)
    requireActive(exp)
    const { stageId } = parse(GoToStageInput, req.body)
    const settled = await db.select({ stageId: experienceStageResults.stageId }).from(experienceStageResults).where(eq(experienceStageResults.experienceId, exp.id))
    if (!canGoTo(exp.stages, new Set(settled.map((s) => s.stageId)), exp.currentStage, stageId)) throw new HttpError(409, 'stage_not_settled')
    // Every Stage opens on its Briefing.
    await db
      .update(experiences)
      .set({ currentStage: stageId, currentPhase: 'briefing', briefingOpen: [], scene: { model: exp.scene.model, target: null }, view: clearFocus(viewOf(exp.view)), updatedAt: dsql`now()` })
      .where(eq(experiences.id, exp.id))
    return { ok: true }
  })

  // The Presenter opens the Stage's question, or returns to its Briefing.
  app.post('/pocs/:id/experiences/:expId/phase', async (req) => {
    const auth = requireAuth(req)
    const { id, expId } = parse(ExpParams, req.params)
    const { poc } = await loadAccess(auth, id, 'run')
    const exp = await loadExperience(poc.id, expId)
    requireActive(exp)
    const { phase } = parse(PhaseInput, req.body)
    if (phase === 'question' && !hasQuestion(exp.currentStage)) throw new HttpError(409, 'no_question')
    await db.update(experiences).set({ currentPhase: phase, view: clearFocus(viewOf(exp.view)), updatedAt: dsql`now()` }).where(eq(experiences.id, exp.id))
    return { ok: true }
  })

  // The Presenter opens (or folds) Briefing topics; everyone's view follows.
  app.post('/pocs/:id/experiences/:expId/briefing', async (req) => {
    const auth = requireAuth(req)
    const { id, expId } = parse(ExpParams, req.params)
    const { poc } = await loadAccess(auth, id, 'run')
    const exp = await loadExperience(poc.id, expId)
    requireActive(exp)
    const { open } = parse(BriefingInput, req.body)
    // The topic just opened is what everyone looks at; folding it lets go of the Spotlight.
    const opened = open.at(-1)
    await db
      .update(experiences)
      .set({ briefingOpen: [...new Set(open)], view: { ...viewOf(exp.view), spot: opened ? `brief:${opened}` : null }, updatedAt: dsql`now()` })
      .where(eq(experiences.id, exp.id))
    return { ok: true }
  })

  // The Presenter switches the interaction model or enters (or leaves) an object; everyone follows.
  app.post('/pocs/:id/experiences/:expId/scene', async (req) => {
    const auth = requireAuth(req)
    const { id, expId } = parse(ExpParams, req.params)
    const { poc } = await loadAccess(auth, id, 'run')
    const exp = await loadExperience(poc.id, expId)
    requireActive(exp)
    const scene = parse(SceneState, req.body)
    await db.update(experiences).set({ scene, view: clearFocus(viewOf(exp.view)), updatedAt: dsql`now()` }).where(eq(experiences.id, exp.id))
    return { ok: true }
  })

  // The Presenter folds or opens the panel, points at an item (the Spotlight), replays the trace, hovers a
  // layer or scrolls; everyone follows. Hover and scroll arrive several times a second: their own limit.
  app.post('/pocs/:id/experiences/:expId/view', { config: { rateLimit: { max: 900, timeWindow: '1 minute' } } }, async (req) => {
    const auth = requireAuth(req)
    const { id, expId } = parse(ExpParams, req.params)
    const { poc } = await loadAccess(auth, id, 'run')
    const exp = await loadExperience(poc.id, expId)
    requireActive(exp)
    const view = applyView(viewOf(exp.view), parse(ViewInput, req.body))
    await db.update(experiences).set({ view, updatedAt: dsql`now()` }).where(eq(experiences.id, exp.id))
    return { ok: true }
  })

  // A participant confirms their own access to the lab (the Closing's Lab Stage), or withdraws it.
  app.post('/pocs/:id/experiences/:expId/lab-access', async (req) => {
    const auth = requireAuth(req)
    const { id, expId } = parse(ExpParams, req.params)
    const { poc } = await loadAccess(auth, id)
    const exp = await loadExperience(poc.id, expId)
    requireActive(exp)
    const { confirmed } = parse(LabAccessInput, req.body)
    const labConfirmedAt = confirmed ? dsql`now()` : null
    await db
      .insert(experienceParticipants)
      .values({ experienceId: exp.id, userId: auth.user.id, labConfirmedAt })
      .onConflictDoUpdate({ target: [experienceParticipants.experienceId, experienceParticipants.userId], set: { labConfirmedAt, lastSeenAt: dsql`now()` } })
    return { ok: true }
  })

  // Any participant asks a Customer Question about the Stage on screen.
  app.post('/pocs/:id/experiences/:expId/stages/:stageId/questions', async (req, reply) => {
    const auth = requireAuth(req)
    const { id, expId, stageId } = parse(StageParams, req.params)
    const { poc } = await loadAccess(auth, id)
    const exp = await loadExperience(poc.id, expId)
    requireActive(exp)
    requireCurrent(exp, stageId)
    const { text } = parse(CustomerQuestionInput, req.body)
    const [row] = await db.insert(experienceQuestions).values({ experienceId: exp.id, stageId, userId: auth.user.id, text }).returning({ id: experienceQuestions.id })
    await touch(exp.id)
    return reply.code(201).send(row)
  })

  // The Sales Engineer replies in writing or marks it answered live, during the session or after it.
  app.patch('/pocs/:id/experiences/:expId/questions/:questionId', async (req) => {
    const auth = requireAuth(req)
    const { id, expId, questionId } = parse(QuestionParams, req.params)
    const { poc } = await loadAccess(auth, id, 'run')
    const exp = await loadExperience(poc.id, expId)
    const input = parse(ReplyInput, req.body)
    const reply = input.reply === undefined ? undefined : input.reply || null
    const [row] = await db
      .update(experienceQuestions)
      .set({
        ...(reply !== undefined ? { reply } : {}),
        ...(input.answeredLive !== undefined ? { answeredLive: input.answeredLive } : {}),
        repliedBy: auth.user.id,
        repliedAt: dsql`now()`,
      })
      .where(and(eq(experienceQuestions.id, questionId), eq(experienceQuestions.experienceId, exp.id)))
      .returning({ id: experienceQuestions.id })
    if (!row) throw notFound()
    await touch(exp.id)
    return { ok: true }
  })
}
