import { run, codex } from "@ai-hero/sandcastle";
import { docker } from "@ai-hero/sandcastle/sandboxes/docker";

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
});
