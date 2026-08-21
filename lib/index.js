import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { approvalDetails, lastAssistantText, sessionMetadata } from './session.js'
import { SuperwhisperTransport } from './transport.js'

export const name = 'superwhisper-dsh'

export function apply(ctx, config = {}) {
  const transport = new SuperwhisperTransport({
    scheme: config.scheme ?? 'superwhisper',
    timeoutMs: config.timeoutMs ?? 30 * 60 * 1_000,
  })
  ctx.on('agent/pre-step', async ({ agent }, next) => {
    try { await transport.dismiss(String(agent.session.header.id)) }
    catch (error) { ctx.logger.warn(`superwhisper-dsh: failed to dismiss session: ${String(error)}`) }
    return next()
  })
  ctx.on('agent/turn-stopping', async ({ agent, signal }) => {
    const metadata = sessionMetadata(agent)
    try {
      const response = await transport.request({
        ...metadata, status: 'completed', summary: 'Task complete',
        message: lastAssistantText(agent), key: 'stop', signal,
      })
      if (response?.trim()) {
        agent.steer(createUserMessage({
          content: [{ type: 'text', text: response }],
          source: { kind: 'plugin', plugin: name },
        }))
      }
    } catch (error) {
      ctx.logger.warn(`superwhisper-dsh: completion transport failed: ${String(error)}`)
    }
  })
  if (ctx.get('approval') !== undefined) {
    ctx.on('approval/request', async (request, next) => {
      const metadata = sessionMetadata(request.agent)
      const summary = request.reason?.trim() || `Allow ${request.toolName}?`
      const message = JSON.stringify({
        toolName: request.toolName,
        summary,
        details: approvalDetails(request.agent, request.callId === undefined ? undefined : String(request.callId)),
        suggestions: [
          { label: 'Yes', behavior: 'allow', tool: request.toolName },
          { label: 'No', behavior: 'deny', tool: request.toolName },
        ],
      })
      try {
        const response = await transport.request({
          ...metadata, status: 'permission', summary, message, signal: request.signal,
        })
        if (response === undefined || response.trim().length === 0) return next()
        return response.trim().toLowerCase() === 'allow' ? 'allowed-once' : 'rejected'
      } catch (error) {
        ctx.logger.warn(`superwhisper-dsh: approval transport failed: ${String(error)}`)
        return next()
      }
    }, { prepend: true })
  }
}
