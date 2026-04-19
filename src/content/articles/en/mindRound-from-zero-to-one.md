---
description: "A local desktop app that lets you put the authors of books you've read into a contact list, chat one-on-one or gather several of them at a roundtable. This is the full MVP retrospective: what the real problem was, why I split it this way, which fancy options I skipped at every step, and what traps I hit."
pubDate: 2026-04-18
tags:
  - Product Design
  - Tauri
  - Agent
  - Open Source
  - Retrospective
cover: https://images.jinla.fun/images/20260419-d424bb49-知道何时停手-MindRound-从0到1的工程实践.webp
slugZh: mindRound-from-zero-to-one
title: "Knowing When to Stop: MindRound's Engineering Journey from Zero to One"
---

My name is King. After eight years as an engineer, I've realized that **most system complexity is self-imposed by engineers, not demanded by users.**

MindRound is a local desktop application that lets you "converse" with the authors of any book—not just Q&A, but dialogues that let you experience their thought processes.

Before building it, I observed how strong industry inertia is. When starting any project, the first thoughts are usually: *What database should we use? Should we go with microservices? How do we set up CI/CD pipelines?* **Rarely does anyone first ask: \*How complex does this thing truly need to be?\***

I decided to answer this question with a small project.

## **The Moment the Storage Model Collapsed**

Two things made this feasible in 2026:

- **Skill Protocol** (open-sourced by Anthropic in late 2025): Upgrades prompts into structured file packages
- **Nüwa.skill** (Uncle Hua's project): Distills any person's thought process into a .skill package

The moment I saw these, I realized: **"Character cards" are essentially just folders with a Markdown file.** The entire storage model collapsed into simplicity.

The Skill Protocol gave me the stage. **But choosing \*not\* to use a database, \*not\* to implement RAG, and \*not\* to build a plugin marketplace—that was my decision.**

## **Three Principles of Boundaries**

Before starting, I didn't outline a feature roadmap—only three boundaries:

1. **Never burden users with complexity.**
   The UI mimics WeChat: contact list on the left, conversations on the right, click a profile for one-on-one chat. **When users open a chat tool, they think "I want to talk to this person," not "I need to figure out the interaction logic."**
2. **Use technology appropriately and with restraint—never for technology's sake.**
   I ruled out certain things from the start—not because I couldn't do them, but because they weren't necessary. Character cards are folders with Markdown; chat logs are JSON files per conversation. In the MVP phase, a local contact list doesn't need ACID transactions, full-text indexing, or a 200MB installation package.
3. **Agents shouldn't make decisions for users.**
   Tools can search, scrape web pages, read/write files, execute commands—but **"making users trust it won't run wild" is ten times more important than "how many tools it can call."** This principle is why this product can be open-sourced.

## **Two Turning Points That Truly Taught Me Something**

### **Turning Point 1: Roundtable Role Confusion**

After adding the roundtable feature (letting multiple authors respond to the same question), a bug appeared: occasionally, Author B would speak in Author A's voice right after A finished.

My first reaction was to tweak the prompt. **It didn't work.**

The root cause was in product definition: I treated group chat as "shared context," feeding the full conversation history to the current model. With "You are A" and "A said..." in the context, confusion was inevitable.

**Solution: Redefine the product.**
Group chat isn't "collaborative table-sharing"—it's "taking turns to speak independently while seeing each other's responses."

- For each call, the system message only includes the current speaker's SKILL.md
- Other authors' responses enter the conversation history as plain text
- Tool execution traces aren't shared across speakers

**Bugs that prompts can't fix always stem from flawed product definitions.**

### **Turning Point 2: Removing "Round" Labels**

The first version of the roundtable had "Round N" labels. Technically correct, practically useless—it created cognitive load users didn't need.

I removed them. Internal state tracking remained, but users no longer saw it.

**Key Insight: Adding features requires justification; removing them requires even more.**

A good product should first solve your own problem, then be built quickly, and refined based on feedback—not get stuck for months debating technical decisions. If I had started with a database, RAG, or custom permission protocols, this project would likely still be stuck in backend development. **Boundaries precede implementation.** Once you clarify your constraints, the right approach naturally emerges.

> **If you need an engineer who can choose "think clearly before acting" over "features keep growing while the system keeps deteriorating," let's talk.**