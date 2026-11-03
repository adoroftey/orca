import { z } from 'zod'

export const ItsaplanId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
export const ItsaplanProjectRef = z
  .string()
  .min(1)
  .max(500)
  .refine((value) => value !== '.' && value !== '..')
export const ItsaplanProjectSchema = z
  .object({
    id: ItsaplanId,
    key: z.string(),
    ref: z.string(),
    name: z.string(),
    teamName: z.string().nullable().optional(),
    archivedAt: z.string().nullable().optional()
  })
  .passthrough()

export const ItsaplanProjectDetailsSchema = z
  .object({
    project: ItsaplanProjectSchema,
    columns: z.array(
      z
        .object({
          id: ItsaplanId,
          name: z.string(),
          stateType: z.string(),
          color: z.string(),
          position: z.number()
        })
        .passthrough()
    ),
    assignees: z.array(
      z
        .object({
          userId: z.string(),
          name: z.string(),
          email: z.string().optional(),
          username: z.string().nullable().optional(),
          kind: z.enum(['member', 'agent'])
        })
        .passthrough()
    ),
    viewer: z
      .object({ role: z.string().optional(), timeZone: z.string().optional() })
      .passthrough()
      .optional(),
    permissions: z.record(z.string(), z.record(z.string(), z.boolean())).optional()
  })
  .passthrough()

export const ItsaplanIssueSummarySchema = z
  .object({
    id: ItsaplanId,
    sequenceNumber: z.number().int(),
    identifier: z.string(),
    title: z.string(),
    columnId: ItsaplanId,
    assigneeUserId: z.string().nullable(),
    priority: z.string().nullable(),
    archived: z.boolean().optional(),
    typeId: ItsaplanId.nullable().optional(),
    initiativeId: ItsaplanId.nullable().optional(),
    initiative: z
      .object({ id: ItsaplanId, title: z.string(), status: z.string() })
      .passthrough()
      .nullable()
      .optional(),
    cycle: z
      .object({ id: ItsaplanId, name: z.string().optional(), status: z.string() })
      .passthrough()
      .nullable()
      .optional(),
    cycleId: ItsaplanId.nullable().optional(),
    delegateUserId: z.string().nullable().optional(),
    parentId: ItsaplanId.nullable().optional(),
    labelIds: z.array(ItsaplanId).optional(),
    fieldValues: z
      .array(
        z
          .object({
            fieldId: ItsaplanId,
            value: z.unknown(),
            valueEnd: z.string().nullable().optional(),
            optionIds: z.array(ItsaplanId)
          })
          .passthrough()
      )
      .optional(),
    startDate: z.string().nullable().optional(),
    dueDate: z.string().nullable().optional(),
    completedAt: z.string().nullable().optional(),
    statusSince: z.string().nullable().optional(),
    archivedAt: z.string().nullable().optional(),
    estimatePoints: z.number().nullable().optional(),
    estimateMinutes: z.number().nullable().optional(),
    loggedMinutes: z.number().nullable().optional()
  })
  .passthrough()

export const ItsaplanIssueSchema = ItsaplanIssueSummarySchema.extend({
  projectId: ItsaplanId,
  description: z.string(),
  createdAt: z.string(),
  updatedAt: z.string()
})

export const ItsaplanIssueCreateSchema = z
  .object({
    title: z.string().trim().min(1).max(10_000),
    columnId: ItsaplanId,
    description: z.string().max(50_000).optional(),
    assigneeUserId: z.string().max(500).nullable().optional(),
    priority: z.enum(['urgent', 'high', 'medium', 'low']).nullable().optional(),
    initiativeId: ItsaplanId.nullable().optional(),
    typeId: ItsaplanId.nullable().optional(),
    parentId: ItsaplanId.nullable().optional(),
    delegateUserId: z.string().max(500).nullable().optional(),
    cycleId: ItsaplanId.nullable().optional(),
    startDate: z.string().max(100).nullable().optional(),
    dueDate: z.string().max(100).nullable().optional(),
    labelIds: z.array(ItsaplanId).optional(),
    estimatePoints: z.number().nullable().optional(),
    estimateMinutes: z.number().nullable().optional()
  })
  .strict()

export const ItsaplanIssueUpdateSchema = ItsaplanIssueCreateSchema.partial().refine(
  (value) => Object.values(value).some((entry) => entry !== undefined),
  'An issue update must change at least one field.'
)

export const ItsaplanCommentCursorSchema = z
  .object({ ts: z.string().max(100), id: ItsaplanId })
  .strict()
export const ItsaplanCommentOptionsSchema = z
  .object({
    cursor: ItsaplanCommentCursorSchema.optional(),
    limit: z.number().int().min(1).max(100).optional()
  })
  .strict()

export const ItsaplanCommentSchema = z
  .object({
    id: ItsaplanId,
    issueId: ItsaplanId,
    kind: z.string(),
    replyToId: ItsaplanId.nullable(),
    actorName: z.string().nullable(),
    body: z.string().nullable(),
    createdAt: z.string()
  })
  .passthrough()

export const ItsaplanCommentPageSchema = z
  .object({
    items: z.array(ItsaplanCommentSchema),
    nextCursor: ItsaplanCommentCursorSchema.nullable()
  })
  .passthrough()

const ItsaplanConnectBase = z.object({
  baseUrl: z.string().min(1).max(2_048),
  webBaseUrl: z.string().max(2_048).optional()
})
export const ItsaplanConnectSchema = z.union([
  ItsaplanConnectBase.extend({ authMethod: z.literal('oauth') }).strict(),
  ItsaplanConnectBase.extend({
    authMethod: z.literal('apiKey').optional(),
    apiKey: z
      .string()
      .trim()
      .min(1)
      .max(16_384)
      .refine((value) => !/[\r\n]/.test(value))
  }).strict()
])
