# @superwhisper/dsh

Private preview of the native Superwhisper integration for DSH.

The bundle listens directly to DSH's typed Cordis extension points. It surfaces completed turns and approval requests in Superwhisper, and sends a Superwhisper reply back through `agent.steer()` without using the Claude or Codex hook bridges.

## Private installation

Access to `superultrainc/superwhisper-dsh` is required while the repository is private.

```sh
dsh plugin --profile web add github:superultrainc/superwhisper-dsh
```

Restart the `web` profile after installation. Install the bundle separately for any other profile that should use Superwhisper.

Remove it with:

```sh
dsh plugin --profile web remove @superwhisper/dsh
```

## Native integration points

- `agent/turn-stopping`: presents the current assistant response and steers a spoken reply into the next step.
- `agent/pre-step`: dismisses stale Superwhisper UI as new work begins.
- `approval/request`: answers one-shot tool approvals, falling through to the next DSH answerer when Superwhisper is dismissed or unavailable.

DSH currently allows only one `userQuestions` provider. The Web host owns it, so `ask_user_question` remains in the DSH Web UI until the upstream seam becomes composable.

## Distribution

The repository commits prebuilt `lib/` artifacts so private Git installation does not require an install-time build allowance. Before public release, remove `private: true`, add release automation, and publish the same bundle as `@superwhisper/dsh`.
