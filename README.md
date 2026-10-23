# Quick Drawn — Synonym Shootout

A fast-paced Western arcade vocabulary shootout game designed for **Lexical Space (LS)** and **Arcadehub**, operating entirely **local-first using browser IndexedDB**.

## 🎮 Production URL
👉 **Play Online:** [https://vuongtranvt1331-design.github.io/QuickDrawn/](https://vuongtranvt1331-design.github.io/QuickDrawn/)

## 🤠 Features
- **Local-First IndexedDB Retrieval:** Reads student vocabulary exclusively from browser `LexicalSpaceDB` (`words` store). Zero automatic Firebase reads or remote calls at runtime.
- **Synonym Shootout:** Duel against the clock matching synonyms.
- **Sharpshooter 25-Point Celebration:** Reach 25 points to unlock the special Sharpshooter achievement card with retro 8-bit fanfare and Western star trophy.
- **Uncapped High Scoring:** Unlimited rounds and uncapped scoring beyond 25 points.
- **Arcadehub Integration:** Supports URL query parameters (`user`, `mode`, `topic`, `returnUrl`) and seamless return navigation.

## 🛠️ Tech Stack
- Vanilla HTML5 / CSS3 / JavaScript (Zero-build standalone architecture)
- Web Audio API (Synthesized western sound effects)
- Native Browser IndexedDB API
