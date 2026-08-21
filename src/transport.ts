import { randomUUID } from 'node:crypto'
import { constants } from 'node:fs'
import { access, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawn } from 'node:child_process'
import type { SessionMetadata } from './session.js'

interface InboxPayload {
  readonly kind: 'update' | 'dismiss'
  readonly sessionId: string
  readonly requestId?: string
  readonly agent?: string
  readonly status?: string
  readonly summary?: string
  readonly messageFile?: string
  readonly responseFile?: string
  readonly cwd?: string
  readonly project?: string
  readonly branch?: string
}

export interface RequestInput extends SessionMetadata {
  readonly status: 'completed' | 'permission'
  readonly summary: string
  readonly message: string
  readonly key?: string
  readonly signal?: AbortSignal
}

export interface TransportConfig {
  readonly scheme: string
  readonly timeoutMs: number
}

const AGENT = 'deepseek-harness'

function inboxDirectory(): string {
  return join(homedir(), 'Library', 'Application Support', 'superwhisper', 'agent', 'inbox')
}

function temporaryDirectory(): string {
  return join(tmpdir(), 'superwhisper-agent')
}

async function writeInbox(payload: InboxPayload): Promise<void> {
  const directory = inboxDirectory()
  await mkdir(directory, { recursive: true })
  const id = randomUUID()
  const temporary = join(directory, `${id}.json.tmp`)
  const destination = join(directory, `${id}.json`)
  await writeFile(temporary, `${JSON.stringify(payload)}\n`, { encoding: 'utf8', mode: 0o600 })
  await rename(temporary, destination)
}

function wake(scheme: string): void {
  const child = spawn('/usr/bin/open', ['-g', `${scheme}://agent-wake`], {
    detached: true,
    stdio: 'ignore',
  })
  child.unref()
}

async function exists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK)
    return true
  } catch {
    return false
  }
}

function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted === true) {
      reject(signal.reason)
      return
    }
    const timer = setTimeout(done, milliseconds)
    function done(): void {
      signal?.removeEventListener('abort', aborted)
      resolve()
    }
    function aborted(): void {
      clearTimeout(timer)
      reject(signal?.reason)
    }
    signal?.addEventListener('abort', aborted, { once: true })
  })
}

export class SuperwhisperTransport {
  constructor(private readonly config: TransportConfig) {}

  async dismiss(sessionId: string): Promise<void> {
    await writeInbox({ kind: 'dismiss', sessionId })
  }

  async request(input: RequestInput): Promise<string | undefined> {
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
      kind: 'update',
      sessionId: input.sessionId,
      requestId,
      agent: AGENT,
      status: input.status,
      summary: input.summary,
      messageFile,
      responseFile,
      cwd: input.cwd,
      project: input.project,
      branch: input.branch,
    })
    wake(this.config.scheme)

    const deadline = Date.now() + this.config.timeoutMs
    try {
      while (Date.now() < deadline) {
        if (await exists(responseFile)) {
          const response = await readFile(responseFile, 'utf8')
          if (input.key === undefined) {
            await Promise.all([rm(messageFile, { force: true }), rm(responseFile, { force: true })])
          }
          return response
        }
        await delay(Date.now() + 1_000 < deadline ? 1_000 : Math.max(1, deadline - Date.now()), input.signal)
      }
    } catch (error: unknown) {
      if (input.signal?.aborted !== true) throw error
    }

    await this.dismiss(input.sessionId)
    if (input.key === undefined) await rm(messageFile, { force: true })
    return undefined
  }
}
