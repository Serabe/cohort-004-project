import { run, codex } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

const [prd, plan] = process.argv.slice(2);

if (!prd || !plan) {
  console.error("Usage: main.ts <prd> <plan>");
  process.exit(1);
}

await run({
  agent: codex("gpt-5.5"),
  sandbox: docker({
    mounts: [
      {
        hostPath: "~/.codex/auth.json",
        sandboxPath: "/home/agent/.codex/auth.json",
        readonly: true,
      },
    ],
  }),
  promptFile: "./.sandcastle/prompt.md",
  maxIterations: 3,
  completionSignal: "<promise>NO MORE TASKS</promise>",
  promptArgs: {
    PRD_LOCATION: prd,
    PLAN_LOCATION: plan,
  },
});
