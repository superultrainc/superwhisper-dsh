#!/bin/bash
set -e

if command -v dsh &>/dev/null; then
    dsh plugin --profile web add --workspace-root github:superultrainc/superwhisper-dsh
else
    npx --yes @deepseek-ai/dsh plugin --profile web add --workspace-root github:superultrainc/superwhisper-dsh
fi

echo "Superwhisper plugin installed. Restart the DSH web profile to activate."

open "superwhisper://agent-installed?agent=deepseek-harness"
