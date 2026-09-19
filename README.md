<div align="center">

# quozul-translate

**A minimal self-hosted translation web app**

</div>

> [!WARNING]
> This is a vibe-coded project.

## Introduction

quozul-translate is a self-hosted translation web app. Type or paste text and
watch it translate itself, using state-of-the-art open translation models that
you run yourself, no APIs, no subscriptions, no third parties ever seeing
your text.

## Features

### 🔒 Private by Design

Your text never leaves your infrastructure. No tracking, no telemetry, no
rate limits, no one reading over your shoulder.

### 🤖 Local, Powerful AI Models

Translation is served by three of the best open translation model families,
each available in 3 sizes so you pick the speed-quality tradeoff for your needs.

### 🔀 Automatic Model Fallback

Pick a favorite model and the app quietly falls back to another family
when your pick can't serve the language pair, so you always get a translation.

### 🌍 Broad Language Coverage

Over 50 languages supported, including Chinese, Japanese, Korean, Arabic,
Hindi and many more.

## Models

All three model families are open-weight and available on Hugging Face:

- **MiLMMT** (by Xiaomi)
  - [1B](https://huggingface.co/xiaomi-research/MiLMMT-46-1B-v1.0)
  - [4B](https://huggingface.co/xiaomi-research/MiLMMT-46-4B-v1.0)
  - [12B](https://huggingface.co/xiaomi-research/MiLMMT-46-12B-v1.0)
- **Hy-MT2** (by Tencent)
  - [1.8B](https://huggingface.co/tencent/Hy-MT2-1.8B)
  - [7B](https://huggingface.co/tencent/Hy-MT2-7B)
  - [30B-A3B](https://huggingface.co/tencent/Hy-MT2-30B-A3B)
- **TranslateGemma** (by Google)
  - [4B](https://huggingface.co/google/translategemma-4b-it)
  - [12B](https://huggingface.co/google/translategemma-12b-it)
  - [27B](https://huggingface.co/google/translategemma-27b-it)

## Quick Start

### Requirements

- pnpm
- Node.js ≥ 20
- A running OpenAI-compatible model server exposing `chat.completions`

### Environment

| Variable          | Purpose                                     | Default                    |
| ----------------- | ------------------------------------------- | -------------------------- |
| `OPENAI_API_KEY`  | Required; requests fail with 503 when unset | —                          |
| `OPENAI_BASE_URL` | OpenAI-compatible base URL                  | `http://127.0.0.1:9931/v1` |

### Run it

```shell
pnpm install
pnpm dev          # dev server
pnpm build        # production build
```
