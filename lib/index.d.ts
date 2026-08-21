import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-agent'
import type {} from '@deepseek-ai/dsh-user-approval'
import Schema from '@deepseek-ai/schemastery'

export declare const name = "superwhisper-dsh"

export interface Config {
  readonly scheme?: string
  readonly timeoutMs?: number
}

export declare const Config: Schema<Config>

export declare function apply(ctx: Context, config?: Config): void
