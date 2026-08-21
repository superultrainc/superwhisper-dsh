import { execFileSync } from 'node:child_process'

export function sessionMetadata(agent) {
  const cwd = agent.session.header.cwd ?? ''
  let root = ''
  let branch = ''
  if (cwd.length > 0) {
    try {
      root = execFileSync('/usr/bin/git', ['-C', cwd, 'rev-parse', '--show-toplevel'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
      branch = execFileSync('/usr/bin/git', ['-C', root, 'branch', '--show-current'], {
        encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
      }).trim()
    } catch {}
  }
  const projectPath = root.length > 0 ? root : cwd
  const project = projectPath.split('/').filter(Boolean).at(-1) ?? ''
  return { sessionId: String(agent.session.header.id), cwd, project, branch }
}

export function lastAssistantText(agent) {
  for (let index = agent.session.events.length - 1; index >= 0; index -= 1) {
    const event = agent.session.events[index]
    if (event?.type !== 'assistant/message') continue
    const text = event.data.message.content
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('\n')
      .trim()
    if (text.length > 0) return text
  }
  return 'DSH finished this turn.'
}

export function approvalDetails(agent, callId) {
  if (callId === undefined) return ''
  for (let index = agent.session.events.length - 1; index >= 0; index -= 1) {
    const event = agent.session.events[index]
    if (event?.type === 'tool/call' && String(event.data.callId) === callId) return event.data.arguments
  }
  return ''
}
