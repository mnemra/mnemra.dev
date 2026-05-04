---
title: "Hello, Mnemra"
date: 2026-04-28
summary: "Mnemra is a context layer for MCP — a memory server for agents. This post introduces the project, the architecture, and what comes next."
tags: ["mnemra", "mcp", "rust"]
hero: ./_assets/hello-hero.png
draft: false
---

Mnemra is a memory server for agents.

MCP carries context in. Postgres carries it out. In between: Rust, pgvector, per-tenant isolation, and row-level security. Self-hosted or managed — your choice.

The project exists because agents forget. Every session starts cold. Every tool call loses the prior conversation. Mnemra changes that: a persistent, queryable context layer that plugs directly into the MCP transport your agents already use.

## The data flow

Each agent session connects to Mnemra over MCP. Observations — tool results, reasoning traces, user inputs — are written to the store. On the next session, the agent queries the relevant context and resumes where it left off.

![MCP data flow diagram](./_assets/mcp-flow.png)

The schema is simple: a context entry has a tenant ID, a session ID, a timestamp, a content embedding (pgvector), and the raw text. Queries use cosine similarity. The top-k results come back as MCP resources.

## What's next

The alpha is in development; beta will follow. If you want early access, join the waitlist on the landing page.

The source is Apache-2.0. The repo is at [github.com/mnemra](https://github.com/mnemra).
