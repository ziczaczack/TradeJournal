# My Trading Journal 📈

![Next.js](https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)

A comprehensive, full-stack trading journaling application designed to help traders track performance, maintain discipline, and analyze their edge. Built thoughtfully with modern web technologies, this platform goes beyond simple logging by offering daily journaling, detailed analytics, automated CSV imports, and setup playbooks.

## 🚀 Features

- **Automated Trade Imports**: Easily import execution data from Tradovate via CSV parsing.
- **Advanced Analytics Dashboard**: Gain deep insights into your trading performance with win rates, profit/loss tracking, and expectancy metrics visualized through interactive charts (Recharts & Lightweight Charts).
- **Interactive Trading Calendar**: Review day-to-day performance at a glance with a visual calendar heat map.
- **Playbooks & Setups**: Document your 'A+' setups with strict rules, conditions, and visual chart tracking.
- **Pre-Trade Checklists**: Enforce discipline before taking a trade to protect psychological capital.
- **Performance Backtesting**: Test strategies against historical performance and manage backtest logs directly in the app.
- **Multimedia Journaling**: Upload and store annotated chart screenshots for each executed trade (powered by Supabase Storage and client-side image compression).
- **Multiple Accounts**: Seamlessly manage and toggle between various trading accounts (e.g., Funded, Evaluations, Personal).
- **Daily Journal**: Review each trading day on one page — write up every trade in a Full or Basic format built from your own templates, plus a day note. Calendar days link straight to their journal entry.
- **Mistake Tags**: Tag trades with your own mistakes (e.g. FOMO entry, moved stop) and see in Analytics what each mistake has cost you compared with your clean trades.
- **Share Cards**: Share a trade or playbook setup as a PNG or a revocable public link — show results in points, $, or % of account; account details are never included.

> **Note:** An Economic Calendar (red-folder news events) is scaffolded in the codebase but currently **disabled** — it's gated behind the `ECONOMIC_CALENDAR_ENABLED` flag in `src/lib/economicCalendarQueries.ts` pending a data provider that supports historical date ranges.

## 🛠️ Tech Stack

### Core
- **Framework:** Next.js 16 (App Router)
- **Language:** TypeScript
- **UI Library:** React 19

### Design & Architecture
- **Styling:** Tailwind CSS v4
- **Components:** Radix UI primitives with Framer Motion for sleek micro-animations
- **Icons:** Lucide React

### State & Data Handling
- **Database & Authentication:** Supabase (PostgreSQL with RLS policies configured)
- **Data Fetching:** TanStack React Query v5
- **Testing:** Vitest, with lint, typecheck, tests and build run in GitHub Actions CI
- **Market Data/Parsing:** PapaParse (CSV), Yahoo Finance API

## ⚙️ Getting Started

### Prerequisites

You need [Node.js](https://nodejs.org/) installed along with a package manager like `npm`, `yarn`, or `pnpm`. You also need a [Supabase](https://supabase.com/) project to host the database and authentication.

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/ziczaczack/TradeJournal.git
   cd TradeJournal
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Configure Environment Variables
   Copy `.env.local.example` to `.env.local` and fill in your Supabase keys.
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

4. Run the Development Server
   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) with your browser to see the application in action.

## 🗄️ Database Setup (Supabase)

This project relies on a specific schema containing tables such as `trades`, `accounts`, `playbooks`, `checklists`, and `analytics`. Refer to the SQL files in `supabase/migrations/` to initialize your database correctly.

## 🛡️ License

Distributed under the MIT License. See `LICENSE` for more information.

## 🤝 Contact

ziczaczack - [ziczaczack@gmail.com](mailto:ziczaczack@gmail.com)

Project Link: [https://github.com/ziczaczack/TradeJournal](https://github.com/ziczaczack/TradeJournal)

Check the production on: [https://trade-journal-kappa-cyan.vercel.app](https://trade-journal-kappa-cyan.vercel.app)
