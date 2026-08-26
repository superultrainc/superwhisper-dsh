# Superwhisper for DSH

Superwhisper voice integration plugin for [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness).

The plugin listens directly to DSH's typed Cordis extension points. It surfaces completed turns and approval requests in Superwhisper, and sends a Superwhisper reply back through `agent.steer()` without using the Claude or Codex hook bridges.

## Requirements

- Node.js 22.15 or newer. Node.js 24 is recommended.
- DSH 0.1.1-rc.2 or a compatible newer release.

## Installation

```sh
dsh plugin --profile web add --workspace-root github:superultrainc/superwhisper-dsh
```

Restart the `web` profile after installation. Install the bundle separately for any other profile that should use Superwhisper.

Remove it with:

```sh
dsh plugin --profile web remove --workspace-root @superwhisper/dsh
```

## Native integration points

- `agent/turn-stopping`: presents the current assistant response and steers a spoken reply into the next step.
- `agent/pre-step`: dismisses stale Superwhisper UI as new work begins.
- `approval/request`: answers one-shot tool approvals, supports session-wide permission bypass, and falls through to the next DSH answerer when Superwhisper is dismissed or unavailable.

DSH currently allows only one `userQuestions` provider. The Web host owns it, so `ask_user_question` remains in the DSH Web UI until the upstream seam becomes composable.

## Privacy

The plugin communicates locally with the Superwhisper macOS app. It does not make network requests or read API credentials. To provide its features, it passes the following data to the local app:

- the completed assistant response;
- approval summaries and tool-call arguments;
- the DSH session identifier; and
- the current working directory, project name, and Git branch.

Temporary message files are created with owner-only permissions, and temporary message and response files are removed after each request. Local configuration files, credentials, and DSH session data are excluded by `.gitignore`.

## Development

The repository commits prebuilt `lib/` artifacts so Git installation does not require an install-time build allowance. The package remains marked `private` to prevent accidental publication to the npm registry.

Security issues should be reported according to [SECURITY.md](.github/SECURITY.md).
