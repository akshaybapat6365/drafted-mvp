# Verified Notes (Drafted + Gemini)

This file captures what was directly verifiable from live fetches during implementation.

## X Post (Umesh)

Fetched via `r.jina.ai` mirror:

- URL: `https://r.jina.ai/http://x.com/umesh_ai/status/2022981881395097635?s=46`
- Post text: launch-style note pointing to `drafted.ai`
- Timestamp shown in the mirror: `Feb 15, 2026` (10:30 AM)

Comments/replies were not accessible via that mirror endpoint (only the post + shell content).

## drafted.ai Site Signals

Fetched HTML:

- Landing: `https://www.drafted.ai/`
  - Tagline: “Design your dream house plans with AI”
  - Mentions floor plans + matching exteriors
  - Mentions purchase of a “Drafted Set & CAD”
  - Uses Clerk (publishable key present in HTML), plus GA/Intercom
  - Community data embedded includes:
    - `topStyles`: `modern_farmhouse`, `contemporary`, `hill_country`
    - Draft items have `floorplanUrl` (SVG) + `exteriorUrl` (JPG) hosted on `cdn.drafted.ai`

- App shell: `https://www.drafted.ai/app/drafts/new?q=3%20bed%202%20bath`
  - “My Studio”, “My Pins”, “My Designs” UI is visible as a client-rendered shell

## Gemini API (Structured Output)

Official pattern used in this MVP:

- Endpoint shape:
  - `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key=...`
- Structured JSON output:
  - `generationConfig.responseMimeType = "application/json"`
  - `generationConfig.responseJsonSchema = { ... }`

## Gemini Models (Image)

Model names observed in official docs/changelog and configured as defaults:

- Text: `gemini-2.5-flash`
- Image (preview/default in this repo): `gemini-3-pro-image-preview`
- Image (final/quality): `gemini-3-pro-image-preview`

From the pricing doc section for `gemini-3-pro-image-preview`, listed output pricing is:

- Standard: equivalent to `$0.134` per 1K/2K image and `$0.24` per 4K image
- Batch: equivalent to `$0.067` per 1K/2K image and `$0.12` per 4K image
