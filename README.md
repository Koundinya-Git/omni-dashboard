# **Omni-Dashboard (Omni-Core) 🧠⚡**

> \*\*Omni-Dashboard is an autonomous, local-first executive productivity operating system, an advanced AI telemetry engine, and a relentless, immutable behavior observer.\*\*

Omni-Dashboard (Omni-Core) is a high-performance, locally-hosted desktop platform meticulously designed to completely replace cloud-dependent productivity applications, predatory SaaS subscription models, and invasive corporate telemetry tracking. Built from the ground up using **Tauri v2** and **Rust**, it is specifically engineered for students, researchers, developers, and hyper-focused professionals who demand absolute data privacy, uncompromising speed, and a system that actively holds them accountable to their goals.

Crucially, Omni-Core acts as an **Immutable Observer**. It establishes a continuous, unalterable "Live Memory" of your entire day—silently tracking the applications you use, synthesizing automated flashcards from your active study materials, summarizing your meetings and lectures, and relentlessly contrasting your *stated goals* against your *actual actions* to drive unprecedented accountability and psychological friction against digital distraction.

## **📋 Table of Contents**

### **Part 1: General Overview \& Getting Started**

1. [Introduction: The Philosophy of Omni-Core](#bookmark=id.psrmfggqklg3)
2. [Core Features \& The Ultimate User Experience](#bookmark=id.by4nljbdipda)
3. [The Psychology of the Immutable Observer](#bookmark=id.44ffzja44j65)
4. [Comprehensive Setup \& Build Protocol](#bookmark=id.yb24gaatnet2)

### **Part 2: Technical \& Architectural Deep Dive**

5. [System Architecture \& Data Flow](#bookmark=id.b26ifkfonmhm)
6. [Deep Dive: Engineering Modules](#bookmark=id.uq7skx2cubxo)

   * [Autonomous Neural Action Bridge](#bookmark=id.xlziiwc5jmos)
   * [Local RAG \& PDF Textbook Engine](#bookmark=id.13702v1g1m6e)
   * [Immutable Observer \& Live Memory Pipeline](#bookmark=id.61ljfew3umhw)
   * [System Telemetry \& VRAM Management](#bookmark=id.pazwabkw1r09)
   * [Multimodal Audio, TTS \& Offline Music Architecture](#bookmark=id.qsuchkos4zg4)
7. [AI Persona Engine \& Cognitive Prompt Matrix](#bookmark=id.99wlh250l2uj)
8. [Relational Database Schema](#bookmark=id.648pepgfj693)
9. [Tauri IPC API Reference](#bookmark=id.x3ctrrxltvdo)
10. [Troubleshooting \& CS Engineering Notes](#bookmark=id.4h5pfh7d4atj)
11. [License \& Terms of Use](#bookmark=id.nyt0qtdc9op9)

# **PART 1: GENERAL OVERVIEW \& GETTING STARTED**

## **1. Introduction: The Philosophy of Omni-Core**

Modern productivity software is fundamentally broken. The industry standard relies on remote servers reading your private data, charging you endless monthly subscription fees, and offering absolutely no real accountability when you inevitably switch to a distracting tab. Existing tools are passive; they wait for you to organize them.

**Omni-Core flips the script. It is an active, omnipresent companion.** Omni-Core brings a multi-tiered Large Language Model (LLM) orchestration engine powered by Ollama, a deeply integrated local Retrieval-Augmented Generation (RAG) pipeline for your textbooks, a full-fledged offline music downloader, and an advanced Text-to-Speech (TTS) runtime directly onto your physical hardware.

**No Wi-Fi? No problem.** Your data never leaves your hard drive. Your AI responds at lightning speed. And most importantly, the system *watches your digital habits* to ensure you are actually studying and executing, not just planning to study. It bridges the gap between intention and reality.

## **2. Core Features \& The Ultimate User Experience**

Omni-Core is not just a to-do list; it is a unified operating environment. It replaces your calendar, task manager, Spotify/music app, flashcard app, and ChatGPT subscription in one cohesive, offline suite.

* 🧠 **The Balanced Set of LLMs (Smart Orchestration):** Omni-Core doesn't rely on one giant, slow model. It dynamically routes your requests to a "Balanced Set" of specialized local models depending on the task context:

  * llama3.2:3b: The backbone for general use cases, daily chatting, and rapid task management.
  * qwen3.5:4b: Automatically triggered for Multimodal Vision tasks whenever you upload or paste images into the chat.
  * nemotron-mini:latest: Highly tuned for maximum performance, particularly utilized for rapid document parsing and RAG queries.
  * phi4-mini:latest: Utilized for maximum efficiency, complex reasoning, and deep logical deductions.
  * qwen2.5-coder:3b: Instantly swapped in whenever coding, script generation, or software engineering tasks are detected.
* 🎭 **Deep Cognitive AI Personas (Not Just Voices):** Unlike basic apps that just change the text-to-speech voice, Omni-Core's Personas fundamentally alter how the AI *thinks*. Selecting "Victor" (the Drill Sergeant) injects an aggressive, accountability-driven system prompt into the LLM, changing its vocabulary, logic, and empathy levels. Selecting "Maya" transforms the underlying LLM into a patient, structured academic tutor. The AI adapts to your psychological needs in real-time.
* 🗣️ **Full Voice-Only Conversation Mode:** Step away from the keyboard. Omni-Core features a complete hands-free conversational mode. You can dictate your thoughts, brainstorm ideas aloud, and the AI will listen, process locally, and speak back to you with dynamic ONNX-powered voice models. It's a true local JARVIS experience.
* 🎵 **Offline YT-DLP Music Engine \& Downloader:** Studying requires focus, and ad-filled streaming services are designed to distract you. Omni-Core features a built-in music engine powered by yt-dlp. You can search for lo-fi beats, classical mixes, or podcasts, and **download them directly to your local drive**. Build completely offline playlists that play through a highly optimized internal audio pipeline without ever opening a web browser.
* 🗂️ **Deep Organizational Hierarchy:** A cluttered mind stems from a cluttered workspace. Omni-Core features a rigid, deeply structured organizational system. Everything you do can be tagged and compartmentalized:

  * **Course Tags:** Link specific notes, tasks, and textbooks to specific university courses or overarching projects.
  * **Booksets:** Group multiple massive PDF textbooks together so the AI can cross-reference information across an entire subject (e.g., "Organic Chemistry Fall 2026 Set").
  * **Playlists \& Workspaces:** Segment your audio and your visual dashboard based on whether you are coding, studying, or relaxing.
* ⚡ **Auto-Scheduling \& Neural Execution:** Don't just make a to-do list. Tell the AI, *"Schedule a 2-hour physics study block tomorrow at 3 PM and break it into Pomodoro sessions,"* and watch as the AI autonomously parses your request and updates your internal calendar, task matrix, and timers without you clicking a single button.
* 📚 **Private Study Vault (Local RAG):** Drag and drop gigabytes of PDF textbooks into the dashboard. The AI instantly reads, indexes, and allows you to chat directly with your textbooks, pulling exact definitions, citations, and formulas from the text.
* 📝 **Live Memory \& Auto-Flashcards:** As you study, read PDFs, and interact with the dashboard, the system quietly operates in the background, generating Spaced Repetition System (SRS) flashcards of key concepts you struggled with, and summarizing your daily study blocks into easy-to-digest recaps.

## **3. The Psychology of the Immutable Observer**

The undisputed crown jewel of Omni-Core is the **Immutable Observer Engine**. Human beings inherently suffer from a massive disconnect between their intentions (what they write in their planners) and their actions (what they actually do on their computers).

Omni-Core solves this through the "Observer Effect"—the psychological principle that human behavior drastically improves when it is actively being monitored.

* **Unforgiving Tracking:** The application silently and securely categorizes your active windows at the OS level. IDEs like Visual Studio Code, Word, and PDF viewers are classified as "Goods". Video games, Discord, and social media feeds are classified as "Bads".
* **Goal vs. Action Matrix:** The dashboard displays a live, real-time visual graph contrasting what you *said* you were going to do (your scheduled calendar blocks) versus what you are *actually* doing (your active screen time).
* **Immutable Logs:** You cannot edit, delete, massage, or fake your Live Memory logs. If you waste three hours on a scheduled study day, the system *will* know, the graphs *will* permanently reflect it, and your chosen AI persona *will* call you out on it in your next conversation. This creates a powerful, inescapable friction against procrastination.

## **4. Comprehensive Setup \& Build Protocol**

Because Omni-Core orchestrates heavy AI workloads entirely locally, your initial setup requires pulling multiple neural models and audio dependencies directly to your machine.

### **4.1 Host System Prerequisites**

Ensure your host machine meets the following software requirements:

* **Node.js:** v18.0.0+ (Required for the Vite/React frontend compilation).
* **Rust Toolchain:** Install via rustup (Ensure you have cargo and rustc edition 2021).
* **C++ Build Tools:** Visual Studio Build Tools (Windows) with the "Desktop development with C++" workload selected. This is absolutely mandatory for compiling the embedded SQLite databases and low-level Rust OS integrations.
* **Git LFS:** Required to fetch the large Piper TTS voice .onnx binaries. Run git lfs install in your terminal before cloning.
* **YT-DLP \& FFmpeg:** Required in your system PATH for the music downloader and audio conversion engine to function correctly.

### **4.2 Ollama Environment Setup**

Install [Ollama](https://ollama.com/) on your host machine. Once installed, open your terminal and pre-fetch the "Balanced Set" of neural weights. Omni-Core automatically routes tasks between these models to optimize battery life, VRAM, and response quality:

\# General / Default Tier (Everyday chatting, task management, scheduling)  
ollama pull llama3.2:3b

\# Coding \& Logic Tier (Advanced problem solving, script generation)  
ollama pull qwen2.5-coder:3b

\# High Efficiency Tier (Complex reasoning and logic puzzles)  
ollama pull phi4-mini:latest

\# Performance \& Document RAG Tier (Specifically tuned for reading your textbooks)  
ollama pull nemotron-mini:latest

\# Multimodal / Vision Tier (For parsing images, charts, and diagrams)  
ollama pull qwen3.5:4b

### **4.3 Piper TTS Runtime Setup**

The zero-cloud voice engine requires local .onnx acoustic models. Ensure your repository structure strictly follows this format within the src-tauri directory so the Rust backend can locate the executables:

src-tauri/  
└── piper/  
├── piper/  
│   └── piper.exe (or piper unix binary)  
└── voices/  
├── en\_US-ryan-high.onnx  
├── en\_US-amy-medium.onnx  
├── en\_US-bryce-medium.onnx  
└── ... (other persona models and their .json config files)

### **4.4 Compilation \& Building**

**Development Mode (Live Reloading):**

\# 1. Clone the repository  
git clone \[https://github.com/Koundinya-Git/omni-dashboard.git](https://github.com/Koundinya-Git/omni-dashboard.git)  
cd omni-dashboard

\# 2. Install Node dependencies  
npm install

\# 3. Launch Tauri Development Server  
npm run tauri dev

**Production Mode (Creating your standalone, optimized .exe):**

npm run tauri build

* **Standalone Binary:** Located at src-tauri/target/release/omni-dashboard.exe
* **MSI Installer Package:** Located at src-tauri/target/release/bundle/msi/omni-dashboard\_0.1.0\_x64\_en-US.msi

# **PART 2: TECHNICAL \& ARCHITECTURAL DEEP DIVE**

For software engineers, computer science students, and curious tinkerers, this section heavily details the underlying logic, data flows, theoretical algorithms, and constraints of the Omni-Core architecture.

## **5. System Architecture \& Data Flow**

Omni-Dashboard utilizes a strict, uncompromising **Local-First Architecture (LFA)**. There are absolutely no REST calls to OpenAI, AWS, Firebase, or external telemetry servers. The entire software stack exists securely within the IPC (Inter-Process Communication) boundaries of your host OS.

┌───────────────────────────────────────────────────────────────────────────────────┐  
│                                REACT / TS FRONTEND                                │  
│                (Vite, Tailwind CSS, Lucide Icons, Modern Dark UI)                 │  
│    Renders data grids, markdown chats, and real-time live memory visualizers.     │  
└────────────────────────────────────────┬──────────────────────────────────────────┘  
│  
│ Tauri IPC Bridge  
│ (`@tauri-apps/api/core`)  
│ Highly secure, typed Rust/JS bridge  
▼  
┌───────────────────────────────────────────────────────────────────────────────────┐  
│                                RUST TAURI CORE DAEMON                             │  
│  Acts as the central nervous system, managing threads, I/O, OS handles \& Audio.   │  
│                                                                                   │  
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐  │  
│  │    Context Hydrator   │  │  Fuzzy Action Parser  │  │   Live Memory \& OS    │  │  
│  │  (System Prompt Inject)│ │   (\[ACT:...] Loop)    │  │  Observer Telemetry   │  │  
│  └───────────┬───────────┘  └───────────┬───────────┘  └───────────┬───────────┘  │  
└──────────────┼──────────────────────────┼──────────────────────────┼──────────────┘  
│                          │                          │  
▼                          ▼                          ▼  
┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐  
│  EMBEDDED SQLITE DB      │  │  OLLAMA REST API         │  │  PIPER TTS \& RODIO       │  
│  (`omni\_core.db`)        │  │  (`127.0.0.1:11434`)     │  │  (ONNX Audio Runtime)    │  
│  Strict ACID compliance  │  │  Quantized LLM Engine    │  │  Local Voice Synthesis   │  
└──────────────────────────┘  └──────────────────────────┘  └──────────────────────────┘

### **5.1 The Chat Execution \& Routing Data Flow**

When a user interacts with the system, a highly complex pipeline of data hydration, dynamic model routing, and action parsing occurs asynchronously:

sequenceDiagram  
autonumber  
actor User  
participant Frontend as React UI  
participant Rust as Tauri Rust Core  
participant DB as SQLite DB  
participant Ollama as Local Ollama API

&#x20;   User-\\>\\>Frontend: Issues command ("Schedule 2hr Physics block tomorrow at 3 PM")  
    Frontend-\\>\\>Rust: invoke('ask\\\_ollama', { messages, persona, query\\\_type... })  
      
    note over Rust, DB: Phase 1: Cognitive Hydration \& Routing  
    Rust-\\>\\>DB: Fetch Active Tasks, Upcoming Calendar, Course Tags  
    Rust-\\>\\>DB: Fetch Live Memory (Recent app usage, goal scores)  
    Rust-\\>\\>Rust: Dynamically compile Master System Prompt based on Persona  
    Rust-\\>\\>Rust: Select Model (llama3.2 for scheduling, qwen for coding, etc.)  
      
    note over Rust, Ollama: Phase 2: AI Inference  
    Rust-\\>\\>Ollama: POST /api/chat (Injected Persona Prompt \\+ User Query)  
    Ollama--\\>\\>Rust: Raw Response String (e.g. "Done\\! \\\[ACT:CALENDAR:1:15:0:17:0:Physics\\]")  
      
    note over Rust, DB: Phase 3: Autonomous Action Execution  
    Rust-\\>\\>Rust: Multi-Tag Fuzzy Parser loops through string, extracts \\\[ACT:...\\] tokens  
    Rust-\\>\\>DB: INSERT INTO calendar\\\_events (Start: 15:00, End: 17:00, Title: "Physics")  
    Rust-\\>\\>Rust: Strip action tags from text for clean UI output  
      
    Rust--\\>\\>Frontend: Cleaned AI Markdown Response \\+ Action Executed Status  
    Frontend--\\>\\>User: Renders UI response \& updates Calendar View dynamically


## **6. Deep Dive: Engineering Modules**

### **6.1 Autonomous Neural Action Bridge**

The industry-standard approach to making an LLM execute interface actions is forcing it to output strict, heavily nested JSON schemas. However, highly compressed, quantized local models (like 3B parameter models) are notoriously bad at outputting perfect JSON—they hallucinate brackets, forget quotes, and inevitably crash strict parsers.

**The Omni-Core Solution:** Zero-Math Fuzzy Parsing via Action Tags.

The system prompt strictly instructs the LLM to output a specific tag syntax buried anywhere within its natural language response. The Rust backend utilizes a Regex-Free Tokenizer to window-slice the string and isolate these proprietary tags safely.

**Supported Tag Topologies:**

1. **Task Creation:** \[ACT:TASK:<QUADRANT\_1\_TO\_4>:<TITLE>]
2. **Calendar Scheduling:** \[ACT:CALENDAR:<OFFSET\_DAYS>:<START\_HOUR>:<START\_MIN>:<END\_HOUR>:<END\_MIN>:<TITLE>]
3. **Pomodoro Timer Ignition:** \[ACT:TIMER:<FOCUS\_MINUTES>:<BREAK\_MINUTES>]
4. **Record Deletion:** \[ACT:DELETE:<TABLE\_NAME>:<RECORD\_ID>]
5. **Task Completion:** \[ACT:COMPLETE:<TASK\_ID>]

**Execution Safety:** The Rust thread heavily locks the database during parsing. It cleans hallucinated AM/PM formats, converts them to rigid 24-hour time structures, applies a std::thread::sleep(Duration::from\_millis(2)) buffer to ensure Unix Epoch millisecond uniqueness for Database Primary Keys, and strips the tags from the final string so the frontend only renders a beautiful, conversational markdown response.

### **6.2 Local RAG \& PDF Textbook Engine**

Omni-Core completely replaces heavy, cloud-based vector databases (like Pinecone or Weaviate) with an embedded, brute-force frequency analysis engine explicitly tailored for local, low-end hardware.

1. **Extraction (lopdf):** When a massive PDF is loaded into a "Bookset", Rust utilizes the lopdf crate to navigate the raw internal PDF tree, extracting buffer strings page by page, completely bypassing the need for optical character recognition on text-native PDFs.
2. **Persistence:** The plain text is written directly into the textbook\_pages SQLite table, mapped to specific course\_id and set\_id tags.
3. **Retrieval Heuristic:** Traditional RAG uses cosine similarity on dense vectors. Because embedding models consume heavy VRAM, Omni-Core uses an optimized alphanumeric Keyword Scorer (a localized adaptation of TF-IDF principles). It isolates critical nouns/verbs in the user prompt, scores pages based on term occurrence, ranks them, and injects the top 5 highest-ranking page texts directly into nemotron-mini:latest's context window for high-performance reading comprehension.

### **6.3 Immutable Observer \& Live Memory Pipeline**

This module operates continuously in the background, utilizing system-level OS calls via Rust to monitor the active window state of the machine, creating an inescapable web of accountability.

* **The Polling Engine:** Every few seconds, Rust polls the OS (using native Win32 API handles on Windows, or X11/Wayland protocols on Linux) to retrieve the foreground application executable name and the specific window title.
* **Categorization Engine:** It cross-references this data against a static dictionary of "Productivity Apps" (Goods) versus "Entertainment Apps" (Bads).
* **Memory Roll-up:** Constantly feeding raw OS logs to an LLM would blow up the context window. Instead, Rust aggregates the data into small rolling summaries (e.g., LiveMemorySummary: "10:00AM-12:00PM: 85% VS Code, 15% Edge").
* **The Goal Score Algorithm:** The UI calculates: Score = (Time in Positive/Neutral State) / (Total Tracked Active Time) \* 100. This precise mathematical metric is injected directly into the LLM persona's prompt.
* **Auto-Flashcards \& Class Summaries:** As Live Summaries accumulate, a secondary background thread occasionally queries the high-efficiency phi4-mini model to extract definitions and facts from your reading summaries and auto-inserts them into the Spaced Repetition (SRS) database.

### **6.4 System Telemetry \& VRAM Management**

Running multiple LLMs and TTS systems locally can instantly crash an average machine via Out-Of-Memory (OOM) errors. Omni-Core mitigates this actively.

**Memory Diagnostics:**

The backend utilizes the sysinfo::System crate to poll exact physical RAM logic:

!\[](data:image/png;base64,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)**Active VRAM Purging:**

When the system needs to switch dynamically from the generic chatbot (llama3.2:3b) to a complex coding model (qwen2.5-coder:3b), it must first dump the VRAM. The Tauri flush\_vram IPC command executes a zero-keep-alive POST request:

{  
"model": "previous\_model\_name",  
"keep\_alive": 0  
}

This forces the Ollama C++ backend to instantly un-map the tensor weights from the GPU, clearing the runway for the newly requested model.

### **6.5 Multimodal Audio, TTS \& Offline Music Architecture**

* **Piper ONNX Engine:** High-speed, natural-sounding voice synthesis is achieved using localized ONNX binaries running on a spawned OS child process. Pacing is controlled mathematically:  
!\[](data:image/png;base64,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)
* **Rodio Streamer:** Instead of saving audio to a slow disk file and playing it via HTML5, the Rust backend intercepts the .wav buffer pipeline and streams it directly into a rodio::OutputStream sink. This drastically reduces UI lag for voice conversations.
* **YT-DLP Integrations \& Downloads:** For deep-focus study music, yt-dlp is spawned with --dump-json --flat-playlist flags to bypass visual rendering, fetching pure audio streams. If the user clicks "Download", FFmpeg handles the muxing, saving the MP3 directly into the music\_cache/ directory, allowing users to build offline Playlists tied directly to their Course Tags.

## **7. AI Persona Engine \& Cognitive Prompt Matrix**

Omni-Core is highly modular. Depending on your current psychological need, you can dynamically switch the AI's core behavior. **These are not just voice changes; they are deep system prompt injections.** The LLM is explicitly instructed to review your *Live Memory Summaries* and adjust its tone and disciplinary measures based on your actual data.

|Persona|Gender \& Style|Dynamic Voice Model|System Archetype \& Behavioral Objective (Prompt Injection)|
|-|-|-|-|
|**Victor**|Strict Male|en\_US-bryce-medium|Tactical drill-sergeant mentor. Will ruthlessly critique your "Bads" app usage based on data. Demands strict task accountability and outputs highly regimented plans.|
|**Morgan**|Strict Female|en\_US-amy-medium|Executive strategist and professor. Focuses on intellectual rigor, logic, and rapid execution. Uses Socratic questioning.|
|**Sam**|Normal Male|en\_US-ryan-high|Approachable roommate. Balanced guidance using clear analogies, friendly conversational tone, and gentle nudges for productivity.|
|**Maya**|Normal Female|en\_GB-semaine-medium|Empathetic study mentor. Structured learning support, clear organization, and highly articulate textbook explanations.|
|**Leo**|Quirky Male|en\_US-joe-medium|Sarcastic, hackathon-tier developer. Dry wit, deadpan humor, automatically triggers qwen2.5-coder for highly efficient code and problem solving.|
|**Felix**|Quirky Male|en\_GB-alan-medium|High-energy tech tinkerer. Uses analogies, pop-culture metaphors, and rapid structural breakdowns for complex systems.|
|**Ziggy**|Quirky Male|en\_US-danny-low|Indie radio philosopher. Deep conceptual curiosity, surrealist humor, and calm problem-solving for creative tasks.|
|**Nova**|Quirky Female|en\_GB-cori-high|High-octane hype-woman. Fast-paced banter, dramatic flair, intense positive motivation when your Goal Score is high.|
|**Aria**|Quirky Female|en\_GB-alba-medium|Theatrical mad scientist. Treats productivity, tasks, and notes as scientific experiments. Excellent for brainstorming.|
|**Chloe**|Quirky Female|en\_GB-jenny\_dioco-medium|Brutally honest sister figure. Calls out procrastination using your Live Memory data with zero-filter affectionate humor.|

## **8. Relational Database Schema**

The entire complex state of the application—from flashcards to system telemetry—is managed via a locally embedded SQLite database (omni\_core.db) rigidly bound by rusqlite.

\-- ==========================================  
-- CORE PRODUCTIVITY, SCHEDULING \& ORGANIZATION  
-- ==========================================  
CREATE TABLE IF NOT EXISTS courses (  
id TEXT PRIMARY KEY,  
code TEXT NOT NULL,  
name TEXT NOT NULL,  
description TEXT NOT NULL,  
color TEXT NOT NULL  
);

CREATE TABLE IF NOT EXISTS workspaces (  
id TEXT PRIMARY KEY,  
name TEXT NOT NULL,  
created\_at INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS tasks (  
id TEXT PRIMARY KEY,  
title TEXT NOT NULL,  
quadrant INTEGER NOT NULL, -- Eisenhower Matrix (1: Do First, 2: Schedule, 3: Delegate, 4: Eliminate)  
course\_id TEXT, -- Ties task to specific organization tag  
completed INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS calendar\_events (  
id TEXT PRIMARY KEY,  
title TEXT NOT NULL,  
description TEXT NOT NULL DEFAULT '',  
start\_time INTEGER NOT NULL, -- Unix Epoch ms  
end\_time INTEGER NOT NULL,   -- Unix Epoch ms  
event\_type TEXT NOT NULL,  
tags TEXT NOT NULL DEFAULT '\[]',  
color TEXT NOT NULL DEFAULT '#3b82f6',  
is\_all\_day INTEGER NOT NULL DEFAULT 0  
);

\-- ==========================================  
-- LOCAL RAG, KNOWLEDGE, TEXTBOOKS \& BOOKSETS  
-- ==========================================  
CREATE TABLE IF NOT EXISTS notes (  
id TEXT PRIMARY KEY,  
title TEXT NOT NULL,  
content TEXT NOT NULL,  
course\_id TEXT NOT NULL  
);

CREATE TABLE IF NOT EXISTS textbooks (  
id TEXT PRIMARY KEY,  
title TEXT NOT NULL,  
author TEXT NOT NULL,  
course\_id TEXT NOT NULL,  
file\_path TEXT NOT NULL,  
total\_pages INTEGER NOT NULL,  
created\_at INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS textbook\_pages (  
id TEXT PRIMARY KEY,  
textbook\_id TEXT NOT NULL,  
page\_number INTEGER NOT NULL,  
content TEXT NOT NULL  
);

CREATE TABLE IF NOT EXISTS book\_sets (  
id TEXT PRIMARY KEY,  
name TEXT NOT NULL,  
created\_at INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS book\_set\_items (  
set\_id TEXT NOT NULL,  
textbook\_id TEXT NOT NULL,  
PRIMARY KEY (set\_id, textbook\_id)  
);

\-- ==========================================  
-- IMMUTABLE OBSERVER \& LIVE MEMORY ENGINE  
-- (These tables are strictly READ-ONLY to the user UI)  
-- ==========================================  
CREATE TABLE IF NOT EXISTS app\_usage\_logs (  
id TEXT PRIMARY KEY,  
app\_name TEXT NOT NULL,  
window\_title TEXT NOT NULL,  
duration\_seconds INTEGER NOT NULL,  
category TEXT NOT NULL, -- Categorized dynamically as 'GOOD', 'BAD', or 'NEUTRAL'  
timestamp INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS live\_memory\_summaries (  
id TEXT PRIMARY KEY,  
summary\_type TEXT NOT NULL, -- Types: 'DAILY\_RECAP', 'CLASS\_MEETING', 'APP\_USAGE'  
content TEXT NOT NULL,  
timestamp INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS goal\_metrics (  
id TEXT PRIMARY KEY,  
date TEXT NOT NULL,  
productivity\_score INTEGER NOT NULL,  
time\_aligned\_with\_goals INTEGER NOT NULL,  
time\_wasted INTEGER NOT NULL  
);

\-- ==========================================  
-- AUTONOMOUS STUDY AIDS (Spaced Repetition)  
-- ==========================================  
CREATE TABLE IF NOT EXISTS flashcards (  
id TEXT PRIMARY KEY,  
source\_type TEXT NOT NULL, -- 'TEXTBOOK', 'MEETING', or 'MANUAL'  
front\_text TEXT NOT NULL,  
back\_text TEXT NOT NULL,  
next\_review\_epoch INTEGER NOT NULL,  
interval\_modifier REAL NOT NULL DEFAULT 1.0  
);

\-- ==========================================  
-- MEDIA, FOCUS STATE, MUSIC \& PLAYLISTS  
-- ==========================================  
CREATE TABLE IF NOT EXISTS focus\_sessions (  
id TEXT PRIMARY KEY,  
task\_id TEXT NOT NULL,  
duration\_minutes INTEGER NOT NULL,  
timestamp INTEGER NOT NULL,  
title TEXT  
);

CREATE TABLE IF NOT EXISTS playlists (  
id TEXT PRIMARY KEY,  
name TEXT NOT NULL,  
tags TEXT NOT NULL DEFAULT '\[]',  
songs TEXT NOT NULL DEFAULT '\[]', -- JSON array of song IDs  
created\_at INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS offline\_songs (  
id TEXT PRIMARY KEY,  
title TEXT NOT NULL,  
artist TEXT NOT NULL,  
duration TEXT NOT NULL,  
local\_path TEXT NOT NULL,  
thumbnail\_url TEXT NOT NULL,  
source TEXT NOT NULL  
);

## **9. Tauri IPC API Reference**

The React/TypeScript frontend is entirely decoupled from the OS. It interacts with the Rust backend daemon exclusively through highly secure, typed Inter-Process Communication (IPC) invocation commands.

### **System, Observer \& Live Memory Interfaces**

// Fetches physical RAM statistics for the diagnostic UI  
invoke("get\_telemetry"): Promise<{ ram\_total: string, ram\_used: string, ram\_percent: number }>;

// Force purges GPU VRAM allocations for LLM switching  
invoke("flush\_vram", { modelTier: string }): Promise<void>;

// Read-Only hooks for the Immutable Observer graphs  
invoke("get\_live\_memory\_summary", { dateStr: string }): Promise<string>;  
invoke("get\_goal\_vs\_action\_metrics", { dateStr: string }): Promise<GoalMetrics>;  
invoke("get\_app\_usage\_stats", { dateStr: string }): Promise<AppUsageLog\[]>;

### **AI, Chat, Audio Conversation \& Flashcard Interfaces**

// The main orchestration endpoint. Hydrates context, routes to correct LLM, and parses Actions.  
invoke("ask\_ollama", {  
messages: Array<{ role: string, content: string }>,  
persona: string,  
modelTier: string, // Drives selection of llama3.2, qwen3.5, nemotron, etc.  
searchWeb: boolean,  
attachedTextbook?: TextbookAttachment,  
currentDateStr: string,  
currentEpochMs: number,  
startOfTodayMs: number  
}): Promise<string>;

// Voice Chat Integrations  
invoke("start\_voice\_dictation"): Promise<void>;  
invoke("stop\_voice\_dictation\_and\_send"): Promise<string>;

// Spaced Repetition Hooks  
invoke("get\_due\_flashcards"): Promise<FlashcardItem\[]>;  
invoke("submit\_flashcard\_review", { id: string, performanceRating: number }): Promise<void>;

### **Core Productivity \& Organization Interfaces**

// Task Management \& Course Tagging  
invoke("get\_tasks"): Promise<TaskItem\[]>;  
invoke("add\_task", { id: string, title: string, quadrant: number, course\_id: string }): Promise<void>;  
invoke("delete\_task", { id: string }): Promise<void>;

// Neural Calendar Control  
invoke("add\_calendar\_event", {  
id: string, title: string, description: string, start\_time: number,  
end\_time: number, event\_type: string, tags: string\[], color: string, is\_all\_day: boolean  
}): Promise<void>;  
invoke("get\_calendar\_events\_in\_range", { start: number, end: number }): Promise<CalendarEventItem\[]>;  
invoke("delete\_calendar\_event", { id: string }): Promise<void>;

### **Advanced Data, Booksets \& Audio Interfaces**

// Local RAG PDF handling \& Booksets  
invoke("import\_pdf\_textbook", { filePath: string, title: string, author: string, courseId: string }): Promise<TextbookItem>;  
invoke("create\_bookset", { id: string, name: string, textbook\_ids: string\[] }): Promise<void>;  
invoke("get\_textbooks"): Promise<TextbookItem\[]>;  
invoke("delete\_textbook", { id: string }): Promise<void>;

// Piper TTS \& YT-DLP Offline Music control  
invoke("read\_aloud", { text: string, wpm: number, persona: string }): Promise<void>;  
invoke("stop\_reading"): Promise<void>;  
invoke("search\_yt\_music", { query: string }): Promise<SongResult\[]>;  
invoke("download\_yt\_song", { videoId: string, title: string, artist: string, duration: string, thumbnailUrl: string }): Promise<OfflineSongItem>;  
invoke("create\_playlist", { name: string, song\_ids: string\[] }): Promise<void>;

## **10. Troubleshooting \& CS Engineering Notes**

### **Rust Compiler Linker Fault (link.exe not found)**

* **Context:** Rust cannot find the Windows linker necessary to compile C dependencies (like SQLite bindings or Windows native audio sinks).
* **Fix:** Open your Visual Studio Installer !\[](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAZCAYAAADe1WXtAAAAq0lEQVR4XmNgGAWjYGCBsrKyrLy8fLeCggIHuhzZQElJiR9o6GYg1kSXowjIycmVgzC6OMVAUVHRTEZGRgVdHA5ERUV5gN6RJBUDXfsISCcBDedEN5MBGOgVIAWkYqCB/4H4FVB/PLqZZAFxcXFuoIF9WF1JJmABGjgVSDOiS5ALWIDeXQjEHugSZAOgd6WBrtwsJSUlgi5HNjA2NmYFGizEQEWvj4JRQAAAAF1pKp6Jr3nrAAAAAElFTkSuQmCC) Select "Workloads" !\[](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAZCAYAAADe1WXtAAAAq0lEQVR4XmNgGAWjYGCBsrKyrLy8fLeCggIHuhzZQElJiR9o6GYg1kSXowjIycmVgzC6OMVAUVHRTEZGRgVdHA5ERUV5gN6RJBUDXfsISCcBDedEN5MBGOgVIAWkYqCB/4H4FVB/PLqZZAFxcXFuoIF9WF1JJmABGjgVSDOiS5ALWIDeXQjEHugSZAOgd6WBrtwsJSUlgi5HNjA2NmYFGizEQEWvj4JRQAAAAF1pKp6Jr3nrAAAAAElFTkSuQmCC) Check the box for "Desktop development with C++" !\[](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAZCAYAAADe1WXtAAAAq0lEQVR4XmNgGAWjYGCBsrKyrLy8fLeCggIHuhzZQElJiR9o6GYg1kSXowjIycmVgzC6OMVAUVHRTEZGRgVdHA5ERUV5gN6RJBUDXfsISCcBDedEN5MBGOgVIAWkYqCB/4H4FVB/PLqZZAFxcXFuoIF9WF1JJmABGjgVSDOiS5ALWIDeXQjEHugSZAOgd6WBrtwsJSUlgi5HNjA2NmYFGizEQEWvj4JRQAAAAF1pKp6Jr3nrAAAAAElFTkSuQmCC) Click Modify/Install. Restart your terminal completely.

### **Ollama Connection Timeout (Network request failed)**

* **Context:** The Tauri IPC is attempting to send a POST request to switch models or generate text, but the local Ollama daemon is offline or port 11434 is heavily firewalled.
* **Fix:** Run ollama serve in a background terminal window. This initializes the REST service listener on 127.0.0.1:11434.

### **Git Push Failures (Files > 100MB)**

* **Context:** You are attempting to push the raw .onnx voice binary models directly to GitHub, violating size limits and crashing the push.
* **Fix:** You must use Git Large File Storage (LFS). Ensure your .gitattributes tracks \*.onnx and commit via git lfs track "\*.onnx".

### **FFmpeg Not Found Error (Audio Downloader)**

* **Context:** You attempt to download a song via yt-dlp but receive an error about muxing.
* **Fix:** yt-dlp requires FFmpeg to combine audio and video streams or convert formats to MP3/WAV. Download FFmpeg and add its bin folder to your system's Environment Variables PATH.

## **11. License \& Terms of Use**

This project is open-source software licensed under the **GNU General Public License v3 (GPLv3)** with explicit additional terms as permitted under **GPLv3 Section 7**. Please refer to "Terms\_and\_Conditions.md" for further details. By using this application, you agree to the said Terms and Conditions in the said "Terms\_and\_Conditions.md" file.

GNU GENERAL PUBLIC LICENSE  
Version 3, 29 June 2007

Copyright (C) 2026 Koundinya Gajulapalli

===============================================================================  
ADDITIONAL TERMS UNDER GPLv3 SECTION 7  
===============================================================================

1\. Mandatory Title Preservation (§7c):  
Any modified version, derivative work, or reproduction of this software that  
is distributed or published must explicitly retain and prominently display  
the phrase "Omni-Dashboard" within its primary title and naming identifiers.

2\. Visible User-Facing Attribution (§7b):  
Distributors and developers of modified versions must preserve and display  
clear, noticeable attribution to the original creator (Koundinya Gajulapalli) and provide  
a direct link to the original repository within the user-facing interface  
of the application (e.g., in the "About", "Settings", or "Dashboard" sections).

*Omni-Core Architecture Engine • Designed for Local Sovereignty • Built for Unyielding Accountability*

# **Omni-Dashboard (Omni-Core) 🧠⚡**

> \*\*Omni-Dashboard is an autonomous, local-first executive productivity operating system, an advanced AI telemetry engine, and a relentless, immutable behavior observer.\*\*

Omni-Dashboard (Omni-Core) is a high-performance, locally-hosted desktop platform meticulously designed to completely replace cloud-dependent productivity applications, predatory SaaS subscription models, and invasive corporate telemetry tracking. Built from the ground up using **Tauri v2** and **Rust**, it is specifically engineered for students, researchers, developers, and hyper-focused professionals who demand absolute data privacy, uncompromising speed, and a system that actively holds them accountable to their goals.

Crucially, Omni-Core acts as an **Immutable Observer**. It establishes a continuous, unalterable "Live Memory" of your entire day—silently tracking the applications you use, synthesizing automated flashcards from your active study materials, summarizing your meetings and lectures, and relentlessly contrasting your *stated goals* against your *actual actions* to drive unprecedented accountability and psychological friction against digital distraction.

## **📋 Table of Contents**

### **Part 1: General Overview \& Getting Started**

1. [Introduction: The Philosophy of Omni-Core](#bookmark=id.psrmfggqklg3)
2. [Core Features \& The Ultimate User Experience](#bookmark=id.by4nljbdipda)
3. [The Psychology of the Immutable Observer](#bookmark=id.44ffzja44j65)
4. [Comprehensive Setup \& Build Protocol](#bookmark=id.yb24gaatnet2)

### **Part 2: Technical \& Architectural Deep Dive**

5. [System Architecture \& Data Flow](#bookmark=id.b26ifkfonmhm)
6. [Deep Dive: Engineering Modules](#bookmark=id.uq7skx2cubxo)

   * [Autonomous Neural Action Bridge](#bookmark=id.xlziiwc5jmos)
   * [Local RAG \& PDF Textbook Engine](#bookmark=id.13702v1g1m6e)
   * [Immutable Observer \& Live Memory Pipeline](#bookmark=id.61ljfew3umhw)
   * [System Telemetry \& VRAM Management](#bookmark=id.pazwabkw1r09)
   * [Multimodal Audio, TTS \& Offline Music Architecture](#bookmark=id.qsuchkos4zg4)
7. [AI Persona Engine \& Cognitive Prompt Matrix](#bookmark=id.99wlh250l2uj)
8. [Relational Database Schema](#bookmark=id.648pepgfj693)
9. [Tauri IPC API Reference](#bookmark=id.x3ctrrxltvdo)
10. [Troubleshooting \& CS Engineering Notes](#bookmark=id.4h5pfh7d4atj)
11. [License \& Terms of Use](#bookmark=id.nyt0qtdc9op9)

# **PART 1: GENERAL OVERVIEW \& GETTING STARTED**

## **1. Introduction: The Philosophy of Omni-Core**

Modern productivity software is fundamentally broken. The industry standard relies on remote servers reading your private data, charging you endless monthly subscription fees, and offering absolutely no real accountability when you inevitably switch to a distracting tab. Existing tools are passive; they wait for you to organize them.

**Omni-Core flips the script. It is an active, omnipresent companion.** Omni-Core brings a multi-tiered Large Language Model (LLM) orchestration engine powered by Ollama, a deeply integrated local Retrieval-Augmented Generation (RAG) pipeline for your textbooks, a full-fledged offline music downloader, and an advanced Text-to-Speech (TTS) runtime directly onto your physical hardware.

**No Wi-Fi? No problem.** Your data never leaves your hard drive. Your AI responds at lightning speed. And most importantly, the system *watches your digital habits* to ensure you are actually studying and executing, not just planning to study. It bridges the gap between intention and reality.

## **2. Core Features \& The Ultimate User Experience**

Omni-Core is not just a to-do list; it is a unified operating environment. It replaces your calendar, task manager, Spotify/music app, flashcard app, and ChatGPT subscription in one cohesive, offline suite.

* 🧠 **The Balanced Set of LLMs (Smart Orchestration):** Omni-Core doesn't rely on one giant, slow model. It dynamically routes your requests to a "Balanced Set" of specialized local models depending on the task context:

  * llama3.2:3b: The backbone for general use cases, daily chatting, and rapid task management.
  * qwen3.5:4b: Automatically triggered for Multimodal Vision tasks whenever you upload or paste images into the chat.
  * nemotron-mini:latest: Highly tuned for maximum performance, particularly utilized for rapid document parsing and RAG queries.
  * phi4-mini:latest: Utilized for maximum efficiency, complex reasoning, and deep logical deductions.
  * qwen2.5-coder:3b: Instantly swapped in whenever coding, script generation, or software engineering tasks are detected.
* 🎭 **Deep Cognitive AI Personas (Not Just Voices):** Unlike basic apps that just change the text-to-speech voice, Omni-Core's Personas fundamentally alter how the AI *thinks*. Selecting "Victor" (the Drill Sergeant) injects an aggressive, accountability-driven system prompt into the LLM, changing its vocabulary, logic, and empathy levels. Selecting "Maya" transforms the underlying LLM into a patient, structured academic tutor. The AI adapts to your psychological needs in real-time.
* 🗣️ **Full Voice-Only Conversation Mode:** Step away from the keyboard. Omni-Core features a complete hands-free conversational mode. You can dictate your thoughts, brainstorm ideas aloud, and the AI will listen, process locally, and speak back to you with dynamic ONNX-powered voice models. It's a true local JARVIS experience.
* 🎵 **Offline YT-DLP Music Engine \& Downloader:** Studying requires focus, and ad-filled streaming services are designed to distract you. Omni-Core features a built-in music engine powered by yt-dlp. You can search for lo-fi beats, classical mixes, or podcasts, and **download them directly to your local drive**. Build completely offline playlists that play through a highly optimized internal audio pipeline without ever opening a web browser.
* 🗂️ **Deep Organizational Hierarchy:** A cluttered mind stems from a cluttered workspace. Omni-Core features a rigid, deeply structured organizational system. Everything you do can be tagged and compartmentalized:

  * **Course Tags:** Link specific notes, tasks, and textbooks to specific university courses or overarching projects.
  * **Booksets:** Group multiple massive PDF textbooks together so the AI can cross-reference information across an entire subject (e.g., "Organic Chemistry Fall 2026 Set").
  * **Playlists \& Workspaces:** Segment your audio and your visual dashboard based on whether you are coding, studying, or relaxing.
* ⚡ **Auto-Scheduling \& Neural Execution:** Don't just make a to-do list. Tell the AI, *"Schedule a 2-hour physics study block tomorrow at 3 PM and break it into Pomodoro sessions,"* and watch as the AI autonomously parses your request and updates your internal calendar, task matrix, and timers without you clicking a single button.
* 📚 **Private Study Vault (Local RAG):** Drag and drop gigabytes of PDF textbooks into the dashboard. The AI instantly reads, indexes, and allows you to chat directly with your textbooks, pulling exact definitions, citations, and formulas from the text.
* 📝 **Live Memory \& Auto-Flashcards:** As you study, read PDFs, and interact with the dashboard, the system quietly operates in the background, generating Spaced Repetition System (SRS) flashcards of key concepts you struggled with, and summarizing your daily study blocks into easy-to-digest recaps.

## **3. The Psychology of the Immutable Observer**

The undisputed crown jewel of Omni-Core is the **Immutable Observer Engine**. Human beings inherently suffer from a massive disconnect between their intentions (what they write in their planners) and their actions (what they actually do on their computers).

Omni-Core solves this through the "Observer Effect"—the psychological principle that human behavior drastically improves when it is actively being monitored.

* **Unforgiving Tracking:** The application silently and securely categorizes your active windows at the OS level. IDEs like Visual Studio Code, Word, and PDF viewers are classified as "Goods". Video games, Discord, and social media feeds are classified as "Bads".
* **Goal vs. Action Matrix:** The dashboard displays a live, real-time visual graph contrasting what you *said* you were going to do (your scheduled calendar blocks) versus what you are *actually* doing (your active screen time).
* **Immutable Logs:** You cannot edit, delete, massage, or fake your Live Memory logs. If you waste three hours on a scheduled study day, the system *will* know, the graphs *will* permanently reflect it, and your chosen AI persona *will* call you out on it in your next conversation. This creates a powerful, inescapable friction against procrastination.

## **4. Comprehensive Setup \& Build Protocol**

Because Omni-Core orchestrates heavy AI workloads entirely locally, your initial setup requires pulling multiple neural models and audio dependencies directly to your machine.

### **4.1 Host System Prerequisites**

Ensure your host machine meets the following software requirements:

* **Node.js:** v18.0.0+ (Required for the Vite/React frontend compilation).
* **Rust Toolchain:** Install via rustup (Ensure you have cargo and rustc edition 2021).
* **C++ Build Tools:** Visual Studio Build Tools (Windows) with the "Desktop development with C++" workload selected. This is absolutely mandatory for compiling the embedded SQLite databases and low-level Rust OS integrations.
* **Git LFS:** Required to fetch the large Piper TTS voice .onnx binaries. Run git lfs install in your terminal before cloning.
* **YT-DLP \& FFmpeg:** Required in your system PATH for the music downloader and audio conversion engine to function correctly.

### **4.2 Ollama Environment Setup**

Install [Ollama](https://ollama.com/) on your host machine. Once installed, open your terminal and pre-fetch the "Balanced Set" of neural weights. Omni-Core automatically routes tasks between these models to optimize battery life, VRAM, and response quality:

\# General / Default Tier (Everyday chatting, task management, scheduling)  
ollama pull llama3.2:3b

\# Coding \& Logic Tier (Advanced problem solving, script generation)  
ollama pull qwen2.5-coder:3b

\# High Efficiency Tier (Complex reasoning and logic puzzles)  
ollama pull phi4-mini:latest

\# Performance \& Document RAG Tier (Specifically tuned for reading your textbooks)  
ollama pull nemotron-mini:latest

\# Multimodal / Vision Tier (For parsing images, charts, and diagrams)  
ollama pull qwen3.5:4b

### **4.3 Piper TTS Runtime Setup**

The zero-cloud voice engine requires local .onnx acoustic models. Ensure your repository structure strictly follows this format within the src-tauri directory so the Rust backend can locate the executables:

src-tauri/  
└── piper/  
├── piper/  
│   └── piper.exe (or piper unix binary)  
└── voices/  
├── en\_US-ryan-high.onnx  
├── en\_US-amy-medium.onnx  
├── en\_US-bryce-medium.onnx  
└── ... (other persona models and their .json config files)

### **4.4 Compilation \& Building**

**Development Mode (Live Reloading):**

\# 1. Clone the repository  
git clone \[https://github.com/Koundinya-Git/omni-dashboard.git](https://github.com/Koundinya-Git/omni-dashboard.git)  
cd omni-dashboard

\# 2. Install Node dependencies  
npm install

\# 3. Launch Tauri Development Server  
npm run tauri dev

**Production Mode (Creating your standalone, optimized .exe):**

npm run tauri build

* **Standalone Binary:** Located at src-tauri/target/release/omni-dashboard.exe
* **MSI Installer Package:** Located at src-tauri/target/release/bundle/msi/omni-dashboard\_0.1.0\_x64\_en-US.msi

# **PART 2: TECHNICAL \& ARCHITECTURAL DEEP DIVE**

For software engineers, computer science students, and curious tinkerers, this section heavily details the underlying logic, data flows, theoretical algorithms, and constraints of the Omni-Core architecture.

## **5. System Architecture \& Data Flow**

Omni-Dashboard utilizes a strict, uncompromising **Local-First Architecture (LFA)**. There are absolutely no REST calls to OpenAI, AWS, Firebase, or external telemetry servers. The entire software stack exists securely within the IPC (Inter-Process Communication) boundaries of your host OS.

┌───────────────────────────────────────────────────────────────────────────────────┐  
│                                REACT / TS FRONTEND                                │  
│                (Vite, Tailwind CSS, Lucide Icons, Modern Dark UI)                 │  
│    Renders data grids, markdown chats, and real-time live memory visualizers.     │  
└────────────────────────────────────────┬──────────────────────────────────────────┘  
│  
│ Tauri IPC Bridge  
│ (`@tauri-apps/api/core`)  
│ Highly secure, typed Rust/JS bridge  
▼  
┌───────────────────────────────────────────────────────────────────────────────────┐  
│                                RUST TAURI CORE DAEMON                             │  
│  Acts as the central nervous system, managing threads, I/O, OS handles \& Audio.   │  
│                                                                                   │  
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌───────────────────────┐  │  
│  │    Context Hydrator   │  │  Fuzzy Action Parser  │  │   Live Memory \& OS    │  │  
│  │  (System Prompt Inject)│ │   (\[ACT:...] Loop)    │  │  Observer Telemetry   │  │  
│  └───────────┬───────────┘  └───────────┬───────────┘  └───────────┬───────────┘  │  
└──────────────┼──────────────────────────┼──────────────────────────┼──────────────┘  
│                          │                          │  
▼                          ▼                          ▼  
┌──────────────────────────┐  ┌──────────────────────────┐  ┌──────────────────────────┐  
│  EMBEDDED SQLITE DB      │  │  OLLAMA REST API         │  │  PIPER TTS \& RODIO       │  
│  (`omni\_core.db`)        │  │  (`127.0.0.1:11434`)     │  │  (ONNX Audio Runtime)    │  
│  Strict ACID compliance  │  │  Quantized LLM Engine    │  │  Local Voice Synthesis   │  
└──────────────────────────┘  └──────────────────────────┘  └──────────────────────────┘

### **5.1 The Chat Execution \& Routing Data Flow**

When a user interacts with the system, a highly complex pipeline of data hydration, dynamic model routing, and action parsing occurs asynchronously:

sequenceDiagram  
autonumber  
actor User  
participant Frontend as React UI  
participant Rust as Tauri Rust Core  
participant DB as SQLite DB  
participant Ollama as Local Ollama API

&#x20;   User-\\>\\>Frontend: Issues command ("Schedule 2hr Physics block tomorrow at 3 PM")  
    Frontend-\\>\\>Rust: invoke('ask\\\_ollama', { messages, persona, query\\\_type... })  
      
    note over Rust, DB: Phase 1: Cognitive Hydration \& Routing  
    Rust-\\>\\>DB: Fetch Active Tasks, Upcoming Calendar, Course Tags  
    Rust-\\>\\>DB: Fetch Live Memory (Recent app usage, goal scores)  
    Rust-\\>\\>Rust: Dynamically compile Master System Prompt based on Persona  
    Rust-\\>\\>Rust: Select Model (llama3.2 for scheduling, qwen for coding, etc.)  
      
    note over Rust, Ollama: Phase 2: AI Inference  
    Rust-\\>\\>Ollama: POST /api/chat (Injected Persona Prompt \\+ User Query)  
    Ollama--\\>\\>Rust: Raw Response String (e.g. "Done\\! \\\[ACT:CALENDAR:1:15:0:17:0:Physics\\]")  
      
    note over Rust, DB: Phase 3: Autonomous Action Execution  
    Rust-\\>\\>Rust: Multi-Tag Fuzzy Parser loops through string, extracts \\\[ACT:...\\] tokens  
    Rust-\\>\\>DB: INSERT INTO calendar\\\_events (Start: 15:00, End: 17:00, Title: "Physics")  
    Rust-\\>\\>Rust: Strip action tags from text for clean UI output  
      
    Rust--\\>\\>Frontend: Cleaned AI Markdown Response \\+ Action Executed Status  
    Frontend--\\>\\>User: Renders UI response \& updates Calendar View dynamically


## **6. Deep Dive: Engineering Modules**

### **6.1 Autonomous Neural Action Bridge**

The industry-standard approach to making an LLM execute interface actions is forcing it to output strict, heavily nested JSON schemas. However, highly compressed, quantized local models (like 3B parameter models) are notoriously bad at outputting perfect JSON—they hallucinate brackets, forget quotes, and inevitably crash strict parsers.

**The Omni-Core Solution:** Zero-Math Fuzzy Parsing via Action Tags.

The system prompt strictly instructs the LLM to output a specific tag syntax buried anywhere within its natural language response. The Rust backend utilizes a Regex-Free Tokenizer to window-slice the string and isolate these proprietary tags safely.

**Supported Tag Topologies:**

1. **Task Creation:** \[ACT:TASK:<QUADRANT\_1\_TO\_4>:<TITLE>]
2. **Calendar Scheduling:** \[ACT:CALENDAR:<OFFSET\_DAYS>:<START\_HOUR>:<START\_MIN>:<END\_HOUR>:<END\_MIN>:<TITLE>]
3. **Pomodoro Timer Ignition:** \[ACT:TIMER:<FOCUS\_MINUTES>:<BREAK\_MINUTES>]
4. **Record Deletion:** \[ACT:DELETE:<TABLE\_NAME>:<RECORD\_ID>]
5. **Task Completion:** \[ACT:COMPLETE:<TASK\_ID>]

**Execution Safety:** The Rust thread heavily locks the database during parsing. It cleans hallucinated AM/PM formats, converts them to rigid 24-hour time structures, applies a std::thread::sleep(Duration::from\_millis(2)) buffer to ensure Unix Epoch millisecond uniqueness for Database Primary Keys, and strips the tags from the final string so the frontend only renders a beautiful, conversational markdown response.

### **6.2 Local RAG \& PDF Textbook Engine**

Omni-Core completely replaces heavy, cloud-based vector databases (like Pinecone or Weaviate) with an embedded, brute-force frequency analysis engine explicitly tailored for local, low-end hardware.

1. **Extraction (lopdf):** When a massive PDF is loaded into a "Bookset", Rust utilizes the lopdf crate to navigate the raw internal PDF tree, extracting buffer strings page by page, completely bypassing the need for optical character recognition on text-native PDFs.
2. **Persistence:** The plain text is written directly into the textbook\_pages SQLite table, mapped to specific course\_id and set\_id tags.
3. **Retrieval Heuristic:** Traditional RAG uses cosine similarity on dense vectors. Because embedding models consume heavy VRAM, Omni-Core uses an optimized alphanumeric Keyword Scorer (a localized adaptation of TF-IDF principles). It isolates critical nouns/verbs in the user prompt, scores pages based on term occurrence, ranks them, and injects the top 5 highest-ranking page texts directly into nemotron-mini:latest's context window for high-performance reading comprehension.

### **6.3 Immutable Observer \& Live Memory Pipeline**

This module operates continuously in the background, utilizing system-level OS calls via Rust to monitor the active window state of the machine, creating an inescapable web of accountability.

* **The Polling Engine:** Every few seconds, Rust polls the OS (using native Win32 API handles on Windows, or X11/Wayland protocols on Linux) to retrieve the foreground application executable name and the specific window title.
* **Categorization Engine:** It cross-references this data against a static dictionary of "Productivity Apps" (Goods) versus "Entertainment Apps" (Bads).
* **Memory Roll-up:** Constantly feeding raw OS logs to an LLM would blow up the context window. Instead, Rust aggregates the data into small rolling summaries (e.g., LiveMemorySummary: "10:00AM-12:00PM: 85% VS Code, 15% Edge").
* **The Goal Score Algorithm:** The UI calculates: Score = (Time in Positive/Neutral State) / (Total Tracked Active Time) \* 100. This precise mathematical metric is injected directly into the LLM persona's prompt.
* **Auto-Flashcards \& Class Summaries:** As Live Summaries accumulate, a secondary background thread occasionally queries the high-efficiency phi4-mini model to extract definitions and facts from your reading summaries and auto-inserts them into the Spaced Repetition (SRS) database.

### **6.4 System Telemetry \& VRAM Management**

Running multiple LLMs and TTS systems locally can instantly crash an average machine via Out-Of-Memory (OOM) errors. Omni-Core mitigates this actively.

**Memory Diagnostics:**

The backend utilizes the sysinfo::System crate to poll exact physical RAM logic:

!\[](data:image/png;base64,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)**Active VRAM Purging:**

When the system needs to switch dynamically from the generic chatbot (llama3.2:3b) to a complex coding model (qwen2.5-coder:3b), it must first dump the VRAM. The Tauri flush\_vram IPC command executes a zero-keep-alive POST request:

{  
"model": "previous\_model\_name",  
"keep\_alive": 0  
}

This forces the Ollama C++ backend to instantly un-map the tensor weights from the GPU, clearing the runway for the newly requested model.

### **6.5 Multimodal Audio, TTS \& Offline Music Architecture**

* **Piper ONNX Engine:** High-speed, natural-sounding voice synthesis is achieved using localized ONNX binaries running on a spawned OS child process. Pacing is controlled mathematically:  
!\[](data:image/png;base64,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)
* **Rodio Streamer:** Instead of saving audio to a slow disk file and playing it via HTML5, the Rust backend intercepts the .wav buffer pipeline and streams it directly into a rodio::OutputStream sink. This drastically reduces UI lag for voice conversations.
* **YT-DLP Integrations \& Downloads:** For deep-focus study music, yt-dlp is spawned with --dump-json --flat-playlist flags to bypass visual rendering, fetching pure audio streams. If the user clicks "Download", FFmpeg handles the muxing, saving the MP3 directly into the music\_cache/ directory, allowing users to build offline Playlists tied directly to their Course Tags.

## **7. AI Persona Engine \& Cognitive Prompt Matrix**

Omni-Core is highly modular. Depending on your current psychological need, you can dynamically switch the AI's core behavior. **These are not just voice changes; they are deep system prompt injections.** The LLM is explicitly instructed to review your *Live Memory Summaries* and adjust its tone and disciplinary measures based on your actual data.

|Persona|Gender \& Style|Dynamic Voice Model|System Archetype \& Behavioral Objective (Prompt Injection)|
|-|-|-|-|
|**Victor**|Strict Male|en\_US-bryce-medium|Tactical drill-sergeant mentor. Will ruthlessly critique your "Bads" app usage based on data. Demands strict task accountability and outputs highly regimented plans.|
|**Morgan**|Strict Female|en\_US-amy-medium|Executive strategist and professor. Focuses on intellectual rigor, logic, and rapid execution. Uses Socratic questioning.|
|**Sam**|Normal Male|en\_US-ryan-high|Approachable roommate. Balanced guidance using clear analogies, friendly conversational tone, and gentle nudges for productivity.|
|**Maya**|Normal Female|en\_GB-semaine-medium|Empathetic study mentor. Structured learning support, clear organization, and highly articulate textbook explanations.|
|**Leo**|Quirky Male|en\_US-joe-medium|Sarcastic, hackathon-tier developer. Dry wit, deadpan humor, automatically triggers qwen2.5-coder for highly efficient code and problem solving.|
|**Felix**|Quirky Male|en\_GB-alan-medium|High-energy tech tinkerer. Uses analogies, pop-culture metaphors, and rapid structural breakdowns for complex systems.|
|**Ziggy**|Quirky Male|en\_US-danny-low|Indie radio philosopher. Deep conceptual curiosity, surrealist humor, and calm problem-solving for creative tasks.|
|**Nova**|Quirky Female|en\_GB-cori-high|High-octane hype-woman. Fast-paced banter, dramatic flair, intense positive motivation when your Goal Score is high.|
|**Aria**|Quirky Female|en\_GB-alba-medium|Theatrical mad scientist. Treats productivity, tasks, and notes as scientific experiments. Excellent for brainstorming.|
|**Chloe**|Quirky Female|en\_GB-jenny\_dioco-medium|Brutally honest sister figure. Calls out procrastination using your Live Memory data with zero-filter affectionate humor.|

## **8. Relational Database Schema**

The entire complex state of the application—from flashcards to system telemetry—is managed via a locally embedded SQLite database (omni\_core.db) rigidly bound by rusqlite.

\-- ==========================================  
-- CORE PRODUCTIVITY, SCHEDULING \& ORGANIZATION  
-- ==========================================  
CREATE TABLE IF NOT EXISTS courses (  
id TEXT PRIMARY KEY,  
code TEXT NOT NULL,  
name TEXT NOT NULL,  
description TEXT NOT NULL,  
color TEXT NOT NULL  
);

CREATE TABLE IF NOT EXISTS workspaces (  
id TEXT PRIMARY KEY,  
name TEXT NOT NULL,  
created\_at INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS tasks (  
id TEXT PRIMARY KEY,  
title TEXT NOT NULL,  
quadrant INTEGER NOT NULL, -- Eisenhower Matrix (1: Do First, 2: Schedule, 3: Delegate, 4: Eliminate)  
course\_id TEXT, -- Ties task to specific organization tag  
completed INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS calendar\_events (  
id TEXT PRIMARY KEY,  
title TEXT NOT NULL,  
description TEXT NOT NULL DEFAULT '',  
start\_time INTEGER NOT NULL, -- Unix Epoch ms  
end\_time INTEGER NOT NULL,   -- Unix Epoch ms  
event\_type TEXT NOT NULL,  
tags TEXT NOT NULL DEFAULT '\[]',  
color TEXT NOT NULL DEFAULT '#3b82f6',  
is\_all\_day INTEGER NOT NULL DEFAULT 0  
);

\-- ==========================================  
-- LOCAL RAG, KNOWLEDGE, TEXTBOOKS \& BOOKSETS  
-- ==========================================  
CREATE TABLE IF NOT EXISTS notes (  
id TEXT PRIMARY KEY,  
title TEXT NOT NULL,  
content TEXT NOT NULL,  
course\_id TEXT NOT NULL  
);

CREATE TABLE IF NOT EXISTS textbooks (  
id TEXT PRIMARY KEY,  
title TEXT NOT NULL,  
author TEXT NOT NULL,  
course\_id TEXT NOT NULL,  
file\_path TEXT NOT NULL,  
total\_pages INTEGER NOT NULL,  
created\_at INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS textbook\_pages (  
id TEXT PRIMARY KEY,  
textbook\_id TEXT NOT NULL,  
page\_number INTEGER NOT NULL,  
content TEXT NOT NULL  
);

CREATE TABLE IF NOT EXISTS book\_sets (  
id TEXT PRIMARY KEY,  
name TEXT NOT NULL,  
created\_at INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS book\_set\_items (  
set\_id TEXT NOT NULL,  
textbook\_id TEXT NOT NULL,  
PRIMARY KEY (set\_id, textbook\_id)  
);

\-- ==========================================  
-- IMMUTABLE OBSERVER \& LIVE MEMORY ENGINE  
-- (These tables are strictly READ-ONLY to the user UI)  
-- ==========================================  
CREATE TABLE IF NOT EXISTS app\_usage\_logs (  
id TEXT PRIMARY KEY,  
app\_name TEXT NOT NULL,  
window\_title TEXT NOT NULL,  
duration\_seconds INTEGER NOT NULL,  
category TEXT NOT NULL, -- Categorized dynamically as 'GOOD', 'BAD', or 'NEUTRAL'  
timestamp INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS live\_memory\_summaries (  
id TEXT PRIMARY KEY,  
summary\_type TEXT NOT NULL, -- Types: 'DAILY\_RECAP', 'CLASS\_MEETING', 'APP\_USAGE'  
content TEXT NOT NULL,  
timestamp INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS goal\_metrics (  
id TEXT PRIMARY KEY,  
date TEXT NOT NULL,  
productivity\_score INTEGER NOT NULL,  
time\_aligned\_with\_goals INTEGER NOT NULL,  
time\_wasted INTEGER NOT NULL  
);

\-- ==========================================  
-- AUTONOMOUS STUDY AIDS (Spaced Repetition)  
-- ==========================================  
CREATE TABLE IF NOT EXISTS flashcards (  
id TEXT PRIMARY KEY,  
source\_type TEXT NOT NULL, -- 'TEXTBOOK', 'MEETING', or 'MANUAL'  
front\_text TEXT NOT NULL,  
back\_text TEXT NOT NULL,  
next\_review\_epoch INTEGER NOT NULL,  
interval\_modifier REAL NOT NULL DEFAULT 1.0  
);

\-- ==========================================  
-- MEDIA, FOCUS STATE, MUSIC \& PLAYLISTS  
-- ==========================================  
CREATE TABLE IF NOT EXISTS focus\_sessions (  
id TEXT PRIMARY KEY,  
task\_id TEXT NOT NULL,  
duration\_minutes INTEGER NOT NULL,  
timestamp INTEGER NOT NULL,  
title TEXT  
);

CREATE TABLE IF NOT EXISTS playlists (  
id TEXT PRIMARY KEY,  
name TEXT NOT NULL,  
tags TEXT NOT NULL DEFAULT '\[]',  
songs TEXT NOT NULL DEFAULT '\[]', -- JSON array of song IDs  
created\_at INTEGER NOT NULL  
);

CREATE TABLE IF NOT EXISTS offline\_songs (  
id TEXT PRIMARY KEY,  
title TEXT NOT NULL,  
artist TEXT NOT NULL,  
duration TEXT NOT NULL,  
local\_path TEXT NOT NULL,  
thumbnail\_url TEXT NOT NULL,  
source TEXT NOT NULL  
);

## **9. Tauri IPC API Reference**

The React/TypeScript frontend is entirely decoupled from the OS. It interacts with the Rust backend daemon exclusively through highly secure, typed Inter-Process Communication (IPC) invocation commands.

### **System, Observer \& Live Memory Interfaces**

// Fetches physical RAM statistics for the diagnostic UI  
invoke("get\_telemetry"): Promise<{ ram\_total: string, ram\_used: string, ram\_percent: number }>;

// Force purges GPU VRAM allocations for LLM switching  
invoke("flush\_vram", { modelTier: string }): Promise<void>;

// Read-Only hooks for the Immutable Observer graphs  
invoke("get\_live\_memory\_summary", { dateStr: string }): Promise<string>;  
invoke("get\_goal\_vs\_action\_metrics", { dateStr: string }): Promise<GoalMetrics>;  
invoke("get\_app\_usage\_stats", { dateStr: string }): Promise<AppUsageLog\[]>;

### **AI, Chat, Audio Conversation \& Flashcard Interfaces**

// The main orchestration endpoint. Hydrates context, routes to correct LLM, and parses Actions.  
invoke("ask\_ollama", {  
messages: Array<{ role: string, content: string }>,  
persona: string,  
modelTier: string, // Drives selection of llama3.2, qwen3.5, nemotron, etc.  
searchWeb: boolean,  
attachedTextbook?: TextbookAttachment,  
currentDateStr: string,  
currentEpochMs: number,  
startOfTodayMs: number  
}): Promise<string>;

// Voice Chat Integrations  
invoke("start\_voice\_dictation"): Promise<void>;  
invoke("stop\_voice\_dictation\_and\_send"): Promise<string>;

// Spaced Repetition Hooks  
invoke("get\_due\_flashcards"): Promise<FlashcardItem\[]>;  
invoke("submit\_flashcard\_review", { id: string, performanceRating: number }): Promise<void>;

### **Core Productivity \& Organization Interfaces**

// Task Management \& Course Tagging  
invoke("get\_tasks"): Promise<TaskItem\[]>;  
invoke("add\_task", { id: string, title: string, quadrant: number, course\_id: string }): Promise<void>;  
invoke("delete\_task", { id: string }): Promise<void>;

// Neural Calendar Control  
invoke("add\_calendar\_event", {  
id: string, title: string, description: string, start\_time: number,  
end\_time: number, event\_type: string, tags: string\[], color: string, is\_all\_day: boolean  
}): Promise<void>;  
invoke("get\_calendar\_events\_in\_range", { start: number, end: number }): Promise<CalendarEventItem\[]>;  
invoke("delete\_calendar\_event", { id: string }): Promise<void>;

### **Advanced Data, Booksets \& Audio Interfaces**

// Local RAG PDF handling \& Booksets  
invoke("import\_pdf\_textbook", { filePath: string, title: string, author: string, courseId: string }): Promise<TextbookItem>;  
invoke("create\_bookset", { id: string, name: string, textbook\_ids: string\[] }): Promise<void>;  
invoke("get\_textbooks"): Promise<TextbookItem\[]>;  
invoke("delete\_textbook", { id: string }): Promise<void>;

// Piper TTS \& YT-DLP Offline Music control  
invoke("read\_aloud", { text: string, wpm: number, persona: string }): Promise<void>;  
invoke("stop\_reading"): Promise<void>;  
invoke("search\_yt\_music", { query: string }): Promise<SongResult\[]>;  
invoke("download\_yt\_song", { videoId: string, title: string, artist: string, duration: string, thumbnailUrl: string }): Promise<OfflineSongItem>;  
invoke("create\_playlist", { name: string, song\_ids: string\[] }): Promise<void>;

## **10. Troubleshooting \& CS Engineering Notes**

### **Rust Compiler Linker Fault (link.exe not found)**

* **Context:** Rust cannot find the Windows linker necessary to compile C dependencies (like SQLite bindings or Windows native audio sinks).
* **Fix:** Open your Visual Studio Installer !\[](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAZCAYAAADe1WXtAAAAq0lEQVR4XmNgGAWjYGCBsrKyrLy8fLeCggIHuhzZQElJiR9o6GYg1kSXowjIycmVgzC6OMVAUVHRTEZGRgVdHA5ERUV5gN6RJBUDXfsISCcBDedEN5MBGOgVIAWkYqCB/4H4FVB/PLqZZAFxcXFuoIF9WF1JJmABGjgVSDOiS5ALWIDeXQjEHugSZAOgd6WBrtwsJSUlgi5HNjA2NmYFGizEQEWvj4JRQAAAAF1pKp6Jr3nrAAAAAElFTkSuQmCC) Select "Workloads" !\[](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAZCAYAAADe1WXtAAAAq0lEQVR4XmNgGAWjYGCBsrKyrLy8fLeCggIHuhzZQElJiR9o6GYg1kSXowjIycmVgzC6OMVAUVHRTEZGRgVdHA5ERUV5gN6RJBUDXfsISCcBDedEN5MBGOgVIAWkYqCB/4H4FVB/PLqZZAFxcXFuoIF9WF1JJmABGjgVSDOiS5ALWIDeXQjEHugSZAOgd6WBrtwsJSUlgi5HNjA2NmYFGizEQEWvj4JRQAAAAF1pKp6Jr3nrAAAAAElFTkSuQmCC) Check the box for "Desktop development with C++" !\[](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAZCAYAAADe1WXtAAAAq0lEQVR4XmNgGAWjYGCBsrKyrLy8fLeCggIHuhzZQElJiR9o6GYg1kSXowjIycmVgzC6OMVAUVHRTEZGRgVdHA5ERUV5gN6RJBUDXfsISCcBDedEN5MBGOgVIAWkYqCB/4H4FVB/PLqZZAFxcXFuoIF9WF1JJmABGjgVSDOiS5ALWIDeXQjEHugSZAOgd6WBrtwsJSUlgi5HNjA2NmYFGizEQEWvj4JRQAAAAF1pKp6Jr3nrAAAAAElFTkSuQmCC) Click Modify/Install. Restart your terminal completely.

### **Ollama Connection Timeout (Network request failed)**

* **Context:** The Tauri IPC is attempting to send a POST request to switch models or generate text, but the local Ollama daemon is offline or port 11434 is heavily firewalled.
* **Fix:** Run ollama serve in a background terminal window. This initializes the REST service listener on 127.0.0.1:11434.

### **Git Push Failures (Files > 100MB)**

* **Context:** You are attempting to push the raw .onnx voice binary models directly to GitHub, violating size limits and crashing the push.
* **Fix:** You must use Git Large File Storage (LFS). Ensure your .gitattributes tracks \*.onnx and commit via git lfs track "\*.onnx".

### **FFmpeg Not Found Error (Audio Downloader)**

* **Context:** You attempt to download a song via yt-dlp but receive an error about muxing.
* **Fix:** yt-dlp requires FFmpeg to combine audio and video streams or convert formats to MP3/WAV. Download FFmpeg and add its bin folder to your system's Environment Variables PATH.

## **11. License \& Terms of Use**

This project is open-source software licensed under the **GNU General Public License v3 (GPLv3)** with explicit additional terms as permitted under **GPLv3 Section 7**. Please refer to "Terms\_and\_Conditions.md" for further details. By using this application, you agree to the said Terms and Conditions in the said "Terms\_and\_Conditions.md" file.

GNU GENERAL PUBLIC LICENSE  
Version 3, 29 June 2007

Copyright (C) 2026 Koundinya Gajulapalli

===============================================================================  
ADDITIONAL TERMS UNDER GPLv3 SECTION 7  
===============================================================================

1\. Mandatory Title Preservation (§7c):  
Any modified version, derivative work, or reproduction of this software that  
is distributed or published must explicitly retain and prominently display  
the phrase "Omni-Dashboard" within its primary title and naming identifiers.

2\. Visible User-Facing Attribution (§7b):  
Distributors and developers of modified versions must preserve and display  
clear, noticeable attribution to the original creator (Koundinya Gajulapalli) and provide  
a direct link to the original repository within the user-facing interface  
of the application (e.g., in the "About", "Settings", or "Dashboard" sections).

*Omni-Core Architecture Engine • Designed for Local Sovereignty • Built for Unyielding Accountability*

