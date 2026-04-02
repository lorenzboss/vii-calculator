# vii.sh - Time Calculator

A web-based calculator for time values.

Type expressions using time notation and get instant per-line results, a running total, and cross-line references.

## Features

- Add, subtract, multiply, and divide time values using `+`, `-`, `*`, `/`
- Enter times as `H.MM` / `HH.MM.SS` or `H:MM` / `HH:MM:SS`
- Group sub-expressions with `( )`
- Reference previous lines with `#1`, `#2`, …
- Each line shows its result inline as you type
- A grand total of all lines is shown at the bottom
- Copy all lines with their results to the clipboard
- Input is saved in `localStorage` and restored on reload
- Time values, references, and operators are colour-coded

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Scripts

| Command         | Description                  |
| --------------- | ---------------------------- |
| `npm run dev`   | Start the development server |
| `npm run build` | Create a production build    |
| `npm start`     | Start the production server  |
| `npm run lint`  | Run ESLint                   |

## Tech Stack

- [Next.js](https://nextjs.org) (App Router)
- [Tailwind CSS](https://tailwindcss.com)
- [Vercel Analytics](https://vercel.com/analytics)
