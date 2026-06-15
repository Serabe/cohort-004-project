FROM node:22-bookworm

# Install system dependencies
RUN apt-get update && apt-get install -y \
  git \
  curl \
  jq \
  && rm -rf /var/lib/apt/lists/*

# Install GitHub CLI
RUN curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
  | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg \
  && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
  | tee /etc/apt/sources.list.d/github-cli.list > /dev/null \
  && apt-get update && apt-get install -y gh \
  && rm -rf /var/lib/apt/lists/*

# Build-args for UID/GID alignment: sandcastle docker build-image
# defaults these to the host user's UID/GID so image-built files
# and bind-mounted files share an owner without runtime chown.
ARG AGENT_UID=1000
ARG AGENT_GID=1000

# Rename the base image's "node" user to "agent" and align UID/GID.
RUN groupmod -o -g $AGENT_GID node && usermod -o -u $AGENT_UID -g $AGENT_GID -d /home/agent -m -l agent node
USER ${AGENT_UID}:${AGENT_GID}

# Install Codex CLI
ARG CODEX_VERSION=0.138.0
RUN set -eux; \
  case "$(uname -m)" in \
    aarch64|arm64) target="aarch64-unknown-linux-musl" ;; \
    x86_64|amd64) target="x86_64-unknown-linux-musl" ;; \
    *) echo "unsupported arch: $(uname -m)" >&2; exit 1 ;; \
  esac; \
  asset="codex-package-${target}.tar.gz"; \
  digest="$(curl -fsSL "https://api.github.com/repos/openai/codex/releases/tags/rust-v${CODEX_VERSION}" \
    | jq -r --arg name "$asset" '.assets[] | select(.name == $name) | .digest' \
    | sed 's/^sha256://')"; \
  test -n "$digest"; \
  curl -fsSL "https://github.com/openai/codex/releases/download/rust-v${CODEX_VERSION}/${asset}" -o /tmp/codex.tar.gz; \
  echo "$digest  /tmp/codex.tar.gz" | sha256sum -c -; \
  mkdir -p /home/agent/.local/codex /home/agent/.local/bin; \
  tar -xzf /tmp/codex.tar.gz -C /home/agent/.local/codex; \
  ln -sf /home/agent/.local/codex/bin/codex /home/agent/.local/bin/codex; \
  /home/agent/.local/bin/codex --version

# Add Codex to PATH
ENV PATH="/home/agent/.local/bin:$PATH"

WORKDIR /home/agent

# In worktree sandbox mode, Sandcastle bind-mounts the git worktree at /home/agent/workspace
# and overrides the working directory to /home/agent/workspace at container start.
# Structure your Dockerfile so that /home/agent/workspace can serve as the project root.
ENTRYPOINT ["sleep", "infinity"]
