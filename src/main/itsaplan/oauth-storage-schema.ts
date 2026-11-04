import { z } from 'zod'

export const OAuthSession = z
  .object({
    issuer: z.string(),
    resource: z.string(),
    clientId: z.string(),
    tokenEndpoint: z.string(),
    accessToken: z.string().min(1),
    refreshToken: z.string().optional(),
    expiresAt: z.number(),
    scope: z.string().optional()
  })
  .strict()
export const StoredConnection = z.union([
  z.object({ baseUrl: z.string(), webBaseUrl: z.string(), apiKey: z.string().min(1) }).strict(),
  z
    .object({
      baseUrl: z.string(),
      webBaseUrl: z.string(),
      auth: z.object({ type: z.literal('oauth'), session: OAuthSession }).strict()
    })
    .strict()
])
