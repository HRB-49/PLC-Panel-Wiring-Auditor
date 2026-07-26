# Panel Wiring & Termination List Auditor

## What it does & the problem it solves

Panel Wiring & Termination List Auditor is a web app for industrial automation and PLC engineers that catches data quality errors in wiring/termination lists — before they reach panel commissioning. It flags duplicate terminal numbers, missing wire tags, inconsistent naming conventions, and other issues that are normally only caught manually (or missed until they cause a real problem on-site).

This is built from firsthand experience working with PLC/SCADA termination data during industrial automation projects, where these exact errors slip through manual review regularly.

**Who it's for:** automation/controls engineers, panel designers, and QA reviewers preparing termination lists for PLC panels.

## Live URL

🔗 **[Live App](https://plc-panel-wiring-auditor.vercel.app/)**

## Features

- Upload a CSV termination/wiring list (handles files with a title/preamble row before the real header row, matching real-world export formats)
- Raw data preview before analysis
- AI-powered audit that flags:
  - Duplicate terminal/address numbers
  - Missing or blank descriptions/wire tags
  - Inconsistent naming conventions
  - Other data quality anomalies
- Severity-tagged findings (Critical / Warning / Info) with plain-English explanations
- Summary dashboard showing issue counts by severity
- Chunked processing for large files, with automatic retry on rate limits
- Download the full audit report as CSV

## The AI feature

I've used grok but you could use any of your desied model through its API if you like you just have to place the API key of your model in the .env file where the space of grok key is given
The core AI feature analyzes uploaded wiring data and classifies data quality issues using the following system prompt:

You are an expert industrial automation QA auditor reviewing PLC panel wiring/termination lists. Given the following termination list data, identify issues such as: duplicate terminal or address numbers, missing or blank descriptions/wire tags, inconsistent naming conventions across similar entries, and any other data quality anomalies an experienced panel engineer would flag. For each issue found, respond with a JSON array where each item has: row (the row number), severity (CRITICAL, WARNING, or INFO), issueType (short label), and explanation (one sentence). Only flag genuine issues — do not invent problems in clean data. Respond with ONLY the JSON array, nothing else.
Large files are automatically split into smaller batches before being sent to the model, to stay within API rate limits, and results are merged back together with correct row references.

## Tools, services & models used

- **Bolt.new** — AI app builder used to build the full-stack application
- **Groq API** (model: `llama-3.1-8b-instant` / `llama-3.3-70b-versatile`) — powers the AI analysis feature
- **Next.js** — application framework
- **Vercel** — hosting and deployment
- **GitHub** — version control and public repository


## How to run locally

1. Clone the repository:
```bash
   git clone https://github.com/HRB-49/PLC-Panel-Wiring-Auditor.git
   cd PLC-Panel-Wiring-Auditor
```
2. Install dependencies:
```bash
   npm install
```
3. Create a `.env` file in the root directory:
   GROQ_API_KEY=your_groq_api_key_here
4. Run the development server:
```bash
   npm run dev
```
5. Open `http://localhost:3000` in your browser.   
