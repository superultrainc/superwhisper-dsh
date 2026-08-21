import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-user-approval'

export declare const name = "superwhisper-dsh"

export interface Config {
  readonly scheme?: string
  readonly timeoutMs?: number
}

export declare function apply(ctx: Context, config?: Config): void
