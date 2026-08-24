import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { ApprovalOutcome } from '@deepseek-ai/dsh-user-approval'
import type {} from '@deepseek-ai/dsh-user-approval'
import Schema from '@deepseek-ai/schemastery'
import { approvalDetails, lastAssistantText, sessionMetadata } from './session.js'
import {
  bypassPermissionsEnabled,
  enableBypassPermissions,
  SuperwhisperTransport,
} from './transport.js'

export const name = 'superwhisper-dsh'

export interface Config {
  readonly scheme?: string
  readonly timeoutMs?: number
}

export const Config: Schema<Config> = Schema.object({
  scheme: Schema.string().default('superwhisper'),
  timeoutMs: Schema.number().min(1_000).default(30 * 60 * 1_000),
})

export function apply(ctx: Context, config: Config = {}): void {
  const transport = new SuperwhisperTransport({
    scheme: config.scheme ?? 'superwhisper',
    timeoutMs: config.timeoutMs ?? 30 * 60 * 1_000,
  })

  ctx.on('agent/pre-step', async ({ agent }, next) => {
    try {
      await transport.dismiss(String(agent.session.header.id))
    } catch (error: unknown) {
      ctx.logger.warn(`superwhisper-dsh: failed to dismiss session: ${String(error)}`)
    }
    return next()
  })

  ctx.on('agent/turn-stopping', async ({ agent, signal }) => {
    const metadata = sessionMetadata(agent)
    try {
      const response = await transport.request({
        ...metadata,
        status: 'completed',
        summary: 'Task complete',
        message: lastAssistantText(agent),
        key: 'stop',
        signal,
      })
      if (response?.trim()) {
        agent.steer(createUserMessage({
          content: [{ type: 'text', text: response }],
          source: { kind: 'plugin', plugin: name },
        }))
      }
    } catch (error: unknown) {
      ctx.logger.warn(`superwhisper-dsh: completion transport failed: ${String(error)}`)
    }
  })

  if (ctx.get('approval') !== undefined) {
    ctx.on('approval/request', async (request, next): Promise<ApprovalOutcome> => {
      const metadata = sessionMetadata(request.agent)

      if (await bypassPermissionsEnabled(metadata.sessionId)) {
        return 'allowed-once'
      }

      const summary = request.reason?.trim() || `Allow ${request.toolName}?`
      const message = JSON.stringify({
        toolName: request.toolName,
        summary,
        details: approvalDetails(request.agent, request.callId === undefined ? undefined : String(request.callId)),
        suggestions: [
          { label: 'Yes', behavior: 'allow', tool: request.toolName },
          {
            label: 'Bypass permissions for this session',
            behavior: 'bypass-perms',
            tool: request.toolName,
          },
          { label: 'No', behavior: 'deny', tool: request.toolName },
        ],
      })

      try {
        const response = await transport.request({
          ...metadata,
          status: 'permission',
          summary,
          message,
          signal: request.signal,
        })
        if (response === undefined || response.trim().length === 0) return next()

        const behavior = response.trim().toLowerCase()
        if (behavior === 'allow') return 'allowed-once'
        if (behavior === 'bypass' || behavior === 'bypass-perms') {
          await enableBypassPermissions(metadata.sessionId)
          return 'allowed-once'
        }
        return 'rejected'
      } catch (error: unknown) {
        ctx.logger.warn(`superwhisper-dsh: approval transport failed: ${String(error)}`)
        return next()
      }
    }, { prepend: true })
  }
}
