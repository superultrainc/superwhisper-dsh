import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

const AGENT = 'deepseek-harness'
const inboxDirectory = () => join(homedir(), 'Library', 'Application Support', 'superwhisper', 'agent', 'inbox')
const temporaryDirectory = () => join(tmpdir(), 'superwhisper-agent')
const bypassPermissionsPath = sessionId => join(temporaryDirectory(), `${sessionId}-bypass-perms`)

async function writeInbox(payload) {
  const directory = inboxDirectory()
  await mkdir(directory, { recursive: true })
  const id = randomUUID()
  const temporary = join(directory, `${id}.json.tmp`)
  await writeFile(temporary, `${JSON.stringify(payload)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, join(directory, `${id}.json`))
}

function wake(scheme) {
  const child = spawn('/usr/bin/open', ['-g', `${scheme}://agent-wake`], { detached: true, stdio: 'ignore' })
  child.unref()
}

async function exists(path) {
  try { await access(path, constants.F_OK); return true } catch { return false }
}

export async function bypassPermissionsEnabled(sessionId) {
  return exists(bypassPermissionsPath(sessionId))
}

export async function enableBypassPermissions(sessionId) {
  const directory = temporaryDirectory()
  await mkdir(directory, { recursive: true })
  await writeFile(bypassPermissionsPath(sessionId), '', { encoding: 'utf8', mode: 0o600 })
}

function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) { reject(signal.reason); return }
    const timer = setTimeout(done, milliseconds)
    function done() { signal?.removeEventListener('abort', aborted); resolve() }
    function aborted() { clearTimeout(timer); reject(signal?.reason) }
    signal?.addEventListener('abort', aborted, { once: true })
  })
}

export class SuperwhisperTransport {
  constructor(config) { this.config = config }
  async dismiss(sessionId) { await writeInbox({ kind: 'dismiss', sessionId }) }
  async request(input) {
    const directory = temporaryDirectory()
    await mkdir(directory, { recursive: true })
    const key = input.key ?? randomUUID()
    const requestId = `${input.sessionId}-${key}`
    const base = join(directory, requestId)
    const messageFile = `${base}-message.txt`
    const responseFile = `${base}-response.txt`
    await writeFile(messageFile, input.message, { encoding: 'utf8', mode: 0o600 })
    await rm(responseFile, { force: true })
    await writeInbox({
      kind: 'update', sessionId: input.sessionId, requestId, agent: AGENT,
      status: input.status, summary: input.summary, messageFile, responseFile,
      cwd: input.cwd, project: input.project, branch: input.branch,
    })
    wake(this.config.scheme)
    const deadline = Date.now() + this.config.timeoutMs
    try {
      while (Date.now() < deadline) {
        if (await exists(responseFile)) {
          const response = await readFile(responseFile, 'utf8')
          if (input.key === undefined) await Promise.all([rm(messageFile, { force: true }), rm(responseFile, { force: true })])
          return response
        }
        await delay(Date.now() + 1_000 < deadline ? 1_000 : Math.max(1, deadline - Date.now()), input.signal)
      }
    } catch (error) {
      if (input.signal?.aborted !== true) throw error
    }
    await this.dismiss(input.sessionId)
    if (input.key === undefined) await rm(messageFile, { force: true })
    return undefined
  }
}
