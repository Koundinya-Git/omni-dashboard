# Omni-Dashboard (Omni-Core) 🧠⚡

> **Omni-Dashboard isn't a to-do list. It's a localized, autonomous AI operating system for your life.**

Welcome to the bleeding edge of personal productivity. We are done with bloated, cloud-dependent SaaS apps that harvest your data, charge monthly subscriptions, and offer nothing but glorified spreadsheets. 

Omni-Core is a hyper-fast, brutally efficient executive suite built on **Tauri and Rust**. It gives you a team of 10 distinct AI personas powered locally by **Ollama**, equipped with a custom-built, indestructible neural bridge that allows the AI to *actually execute actions* on your machine. Your data, your models, your schedule—100% offline, 100% yours.

---

## 🔥 The Revolution: Why This Changes Everything

### 🤖 Autonomous Agentic Actions
Most local LLMs just talk. Omni-Core **acts**. Built with a custom Rust-based fuzzy-parsing bridge, the AI doesn't just give you advice—it autonomously writes to your local SQLite database. If you tell it to "Schedule a 2-hour physics block tomorrow at 3 PM," the AI generates a highly reliable zero-math `[ACT:CALENDAR...]` tag, and the Rust backend instantly injects it into your schedule. It creates tasks, manages matrices, and starts Pomodoro timers without you ever touching the UI.

### 🛡️ Absolute Zero-Cloud Privacy
No OpenAI API keys. No Google tracking. No data harvesting.

Your entire life—chat logs, class notes, deep-work metrics, and calendar blocks—is stored in a single, locally encrypted `omni_core.db` file. The AI models run on your GPU via Ollama. The Voice Synthesis runs entirely offline via Piper TTS. Total digital sovereignty.

### 🧠 RAG Knowledge Engine
Import massive PDF textbooks directly into the app. Omni-Core processes the text locally, allowing you to seamlessly attach entire books, specific page ranges, or targeted extracts directly into your Neural Chat. The AI reads the material and cites specific pages in its responses. 

### 🎧 Built-In Flow State Environment
Say goodbye to opening Spotify tabs that destroy your focus. Omni-Core features a deeply integrated Music Engine using `yt-dlp`. Search YouTube Music natively, build playlists, or download tracks directly into an offline audio vault, playing seamlessly alongside your Pomodoro timers.

---

## ✨ Core Modules

* **Neural Chat Vault:** 10 distinct AI personas ranging from a brutal Drill Sergeant ("Victor") to a hyper-energetic Chaos Gremlin ("Nova"). Context from your entire database is dynamically injected into their system prompts in real-time.
* **Eisenhower Task Matrix:** Visualize and conquer tasks based on Urgency and Importance (Do First, Schedule, Delegate, Eliminate).
* **Peak Calendar Scheduling:** A gorgeous, custom-rendered Time-Blocking interface designed for aggressive daily optimization.
* **Deep Work Pomodoro:** Native focus timers linked directly to specific matrix tasks, logging your deep work telemetry over time.
* **Offline Piper TTS:** Every AI persona has a dynamically assigned offline voice model. It talks to you natively.

---

## 🏗️ The Tech Stack

Omni-Core is engineered for maximum performance and minimal memory footprint.

* **Frontend:** React, TypeScript, Tailwind CSS, Lucide Icons (Insanely fluid, dark-mode first UI).
* **Backend:** Rust & Tauri (Memory-safe, lightning-fast OS-level execution).
* **Database:** `rusqlite` (Embedded, serverless database architecture).
* **AI Engine:** Ollama API (Local Llama 3, Phi, Qwen integration).
* **Audio / TTS:** Piper TTS (Local ONNX models) & `yt-dlp` (Audio stream extraction).

---

## 🚀 Initiation Protocol (Getting Started)

### Prerequisites
You need the holy trinity of modern local development installed on your machine:
1. [Node.js](https://nodejs.org/) (v18+)
2. [Rust & Cargo](https://www.rust-lang.org/tools/install)
3. [Ollama](https://ollama.com/) (Ensure this is running in the background!)

### Installation & Development
Open your terminal and run the following commands to get the system online:

```bash
# 1. Clone the repository
git clone [https://github.com/YOUR_USERNAME/omni-dashboard.git](https://github.com/YOUR_USERNAME/omni-dashboard.git)

# 2. Navigate into the directory
cd omni-dashboard

# 3. Install frontend dependencies
npm install

# 4. Ignite the development server
npm run tauri dev