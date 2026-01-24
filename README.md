# Quozul Translate

A self-hosted, privacy-first translation app that runs entirely on your server.
Use it as an alternative to Google Translate without any external dependencies or tracking.

## 🌟 Features

- Powered by [TranslateGemma](https://blog.google/innovation-and-ai/technology/developers-tools/translategemma/)
- Runs locally using [llama.cpp](https://github.com/ggml-org/llama.cpp)
- No tracking, logging, or user data collection by default
- Built with [SvelteKit](https://kit.svelte.dev/)
- Compatible with [llm-router](https://github.com/Quozul/llama_cpp_router) for automatic model loading

## 🚀 Getting Started

Use the included `docker-compose.yml` file to deploy:

1. Copy `.env.example` to `.env` and adjust values as needed
2. Run `docker-compose up`

The `MODEL_NAME` environment variable only applies when using llm-router, not when calling Ollama or llama.cpp directly. You can also use Ollama, though it has not been tested.

## 🔗 Demo

Visit https://translate.quozul.dev to try it live. The hosted version includes [GoatCounter](https://www.goatcounter.com/) analytics, which is GDPR compliant and fully anonymous.
