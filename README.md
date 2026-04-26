# Learn To Spell

[![Spectacles](https://img.shields.io/badge/Spectacles-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/)
[![SIK](https://img.shields.io/badge/SIK-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-interaction-kit/features/overview)
[![Sync Kit](https://img.shields.io/badge/Sync%20Kit-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/spectacles-frameworks/spectacles-sync-kit/getting-started)
[![Connected Lenses](https://img.shields.io/badge/Connected%20Lenses-Light%20Gray?color=D3D3D3)](https://developers.snap.com/spectacles/about-spectacles-features/connected-lenses/overview)
[![Gemini](https://img.shields.io/badge/Gemini-Light%20Gray?color=D3D3D3)](https://developers.snap.com/lens-studio/features/lens-cloud/lens-cloud-overview)
[![Voice ML](https://img.shields.io/badge/Voice%20ML-Light%20Gray?color=D3D3D3)](https://developers.snap.com/lens-studio/features/voice-ml/overview)

## Overview

**Learn To Spell** is a real-time AR language-learning game for Snap Spectacles. Players are shown English sentences, must speak the correct translation in a target language (default: Spanish), and on a correct answer can throw a fireball at a moving target by pinching their right hand. The game uses Google's Gemini API to grade translations leniently (tolerating ASR errors, accent drift, and dialect variation) and Spectacles Sync Kit for an optional two-player mode where players duel each other in colocated AR.

The game is designed as a fun, competitive way to drill vocabulary and sentence-level grammar — wrong answers show the correct translation so the player learns even when they fail.

> **NOTE:** This project will only work on the Spectacles platform.

## Quickstart

1. Boot the lens — the prompt **"Say solo or multiplayer"** appears slightly below eye level
2. Say **"solo"** (or "multiplayer" if you have a second device)
3. An English sentence appears as floating 3D text in front of you
4. Speak the translation in the target language (default: **Spanish**)
   - **Tip:** Wait a moment before repeating a phrase if you need a retry — the voice listener works best with a brief pause between attempts
5. Gemini grades your translation:
   - **Correct** → a glowing red fireball appears, ready to be thrown
   - **Wrong** → the correct answer is shown so you can learn ("Correct: El gato está durmiendo")
6. **Ready your fireball:** raise your right hand in front of you as if you were holding a ball
7. **Throw it:** pinch your right thumb and index finger together to release the fireball — it flies along your gaze direction
8. **Aim:** look at the frost cube target — the fireball travels toward wherever you're looking
9. Hit the frost cube → it shifts to a new position for the next round
10. Hit **5 targets** → you win
11. Say **"yes"** when prompted to play again

### Solo Mode

You vs. a single bobbing frost cube target. Hit 5 targets to win. The cube paces left/right and respawns at a new random offset after each hit so the player can't predict aim.

### Multiplayer Mode (Scaffolded)

Two players in the same physical space, each on their own pair of Spectacles, take turns answering prompts and throwing fireballs at each other. First to take a hit loses. The networking infrastructure is in place via Sync Kit; full integration is in progress.

## Visual Design

This lens is intentionally minimal — pure AR overlay on the real world, no virtual environment, skybox, or custom lighting. The visuals you'll see:

| Element | Implementation |
|---------|----------------|
| **Prompt text** | Floating 3D text, positioned slightly below eye level |
| **Feedback text** | Floating 3D text — shows hit count, "Correct!", or the correct translation on a wrong answer |
| **Fireball** | Glowing red sphere (`Fireball.prefab`) — parented to the right hand while armed, unparented and launched on pinch |
| **Target** | A frost cube (the conceit being it gets "melted" by the fireball) — paces side to side and respawns on hit |
| **Hands** | No custom hand visualizer; the player sees their own real hands through the Spectacles |
| **Win state** | "You win!" 3D text, then a "Say yes to play again" prompt |

> `Fireball_2.prefab` is an early testing variant kept in the repo for reference — `Fireball.prefab` is the one wired into the active scene.

There are currently **no sound effects, no fizzle particle effect on wrong answers, and no on-screen health display**. Future visual passes are open territory.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Platform | Snap Spectacles + Lens Studio |
| Language | TypeScript (compiled to JS by Lens Studio) |
| Hand Tracking | Spectacles Interaction Kit (SIK) — `onPinchDown` events |
| Voice Input | Voice ML / `VoiceListener` ASR |
| Translation Grading | Google Gemini 2.0 Flash via Remote Service Gateway |
| Multiplayer | Spectacles Sync Kit (Connected Lenses, colocated joining) |

## Prerequisites

- **Lens Studio**: v5.15.4+
- **Spectacles OS**: v5.64+
- **Spectacles App iOS**: v0.64+ / **Android**: v0.64+
- **Google API Key** for Gemini (configured in `RemoteServiceGatewayCredentials`)

To update your Spectacles device and mobile app, see the [update guide](https://support.spectacles.com/hc/en-us/articles/30214953982740-Updating).

Download Lens Studio [here](https://ar.snap.com/download?lang=en-US).

This project uses Experimental APIs. See [Experimental APIs docs](https://developers.snap.com/spectacles/about-spectacles-features/apis/experimental-apis).

Extended Permissions must be enabled on-device for some APIs. See [Extended Permissions docs](https://developers.snap.com/spectacles/permission-privacy/extended-permissions).

## Getting Started

> **IMPORTANT:** This project uses Git LFS. Downloading the repo as a zip from GitHub **will not work** — you must clone with `git lfs` installed:
>
> ```bash
> git lfs install
> git clone https://github.com/sais925/LearnToSpell.git
> cd LearnToSpell
> git lfs pull
> ```

### First-Time Setup

1. Open `LearnToSpell.esproj` in Lens Studio
2. Locate the `RemoteServiceGatewayCredentials` component in the scene
3. Paste your Google API key (used by Gemini for translation grading)
4. Connect your Spectacles device and preview / build to device

## Project Structure

```
Assets/
├─ Scene.scene              # Main scene file
├─ Scripts/Typescript/      # Game logic (this repo's code)
│  ├─ GameModeController.ts # Voice-driven mode select (solo/multiplayer)
│  ├─ RoundController.ts    # Per-round state machine + win/loss flow
│  ├─ SpellController.ts    # Fireball spawn, arm, launch, fly
│  ├─ PinchGestureDetector  # Right-hand pinch detection (SIK)
│  ├─ HitDetector.ts        # Sphere-vs-sphere collision (local + remote spells)
│  ├─ HealthSystem.ts       # Player health + onDeath event
│  ├─ SoloOpponent.ts       # Pacing target with random respawn
│  ├─ NetworkBridge.ts      # Sync Kit message routing (multiplayer)
│  ├─ TranslationJudge.ts   # Gemini API integration for grading
│  ├─ VoiceListener.ts      # ASR wrapper
│  └─ PromptBank.ts         # English prompts (42 across 3 difficulty tiers)
├─ Prefabs/
│  ├─ Fireball.prefab       # Fireball visual (sphere + particles)
│  └─ Fireball_2.prefab     # Alternate fireball visual
└─ ...
```

## Key Scripts

### `GameModeController.ts`
Boot flow. Listens for the player to say "solo" or "multiplayer" and activates the matching scene root, then kicks off the round.

### `RoundController.ts`
Per-player round state machine:
```
Idle → PromptShown → Listening → Grading
                                    ├─ correct → SpellReady → Throwing → Cooldown → (loop)
                                    └─ wrong   → Fizzling  → (loop)
```
Tracks hit counter (5 hits to win in solo). On win → `endGame(true)` → restart prompt. On health depletion → `endGame(false)`.

### `SpellController.ts`
Fireball lifecycle. `arm()` parents a spell prefab to the player's hand with tunable local-space offsets (`handOffsetForwardCm`, etc.). On pinch detection → `launchSpell()` unparents the spell, latches velocity along the head's forward vector, and lets it fly until it hits something or its lifetime expires.

### `PinchGestureDetector.ts`
Subscribes to SIK's `rightHand.onPinchDown` and `onPinchUp`. Emits `onGestureDetected` for the SpellController to consume. The choice of right-hand pinch (versus the original two-hand triangle gesture) was made for reliability and intuitiveness in real-time AR.

### `TranslationJudge.ts`
Wraps the Gemini 2.0 Flash API. The system prompt is tuned to:
- Treat ASR transcription errors leniently
- Accept regional dialects and minor grammatical variations
- Return `{ "correct": boolean, "reason": string }` only
- On wrong answers, return the correct translation in the `reason` field so the player learns

Generation config is tuned for speed: `temperature: 0`, `topP: 0.1`, `maxOutputTokens: 120`.

### `SoloOpponent.ts`
A bobbing target that paces left/right around its starting position. After each hit, `respawnAtRandomPosition()` shifts the pacing center to a new random offset (configurable X/Y/Z range) so the player can't predict where the next target will appear.

### `HitDetector.ts`
Sphere-vs-sphere collision check between in-flight spells and target heads. Auto-subscribes to `SpellController.onSpellLaunched`. Notifies `RoundController` of hits. In multiplayer, also subscribes to remote spell broadcasts and damages the local player on collision.

### `NetworkBridge.ts`
Wraps Spectacles Sync Kit. Sends/receives three message types via `MultiplayerSession.sendMessage()`:
- `spell_launch` — broadcasts position + velocity when a player throws
- `health` — broadcasts updated health after a hit
- `round_start` — broadcasts the active prompt index (for prompt sync)

### `PromptBank.ts`
42 English sentences tagged by difficulty:
- **Easy** (18) — short, common phrases ("I am hungry", "Good morning")
- **Medium** (16) — full sentences with prepositions and conjugation ("She works at the hospital")
- **Hard** (8) — conditionals and subordinate clauses ("If I had known, I would have come earlier")

Difficulty is selected via the `RoundController.difficulty` Inspector field.

## Tunable Inspector Parameters

| Component | Parameter | Default | Notes |
|-----------|-----------|---------|-------|
| `SpellController` | `throwSpeedCmPerSec` | 600 | Velocity along head forward |
| `SpellController` | `handOffsetForwardCm` | 8 | Tune to place fireball forward of palm |
| `SpellController` | `handOffsetUpCm` | 0 | Vertical offset in hand local space |
| `SpellController` | `handOffsetRightCm` | 0 | Lateral offset in hand local space |
| `SpellController` | `spellLifetimeSec` | 4.0 | Auto-despawn if no hit |
| `RoundController` | `hitsToWin` | 5 | Solo win condition |
| `RoundController` | `cooldownSec` | 1.5 | Pause between rounds |
| `RoundController` | `targetLanguage` | Spanish | Any language Gemini knows |
| `RoundController` | `difficulty` | easy | `easy` / `medium` / `hard` / blank for any |
| `SoloOpponent` | `pacingHalfWidthCm` | 50 | Side-to-side pacing range |
| `SoloOpponent` | `respawnRangeXCm` | 80 | Random respawn x range |
| `SoloOpponent` | `respawnRangeYCm` | 40 | Random respawn y range |
| `SoloOpponent` | `respawnRangeZCm` | 60 | Random respawn z range |

## Testing the Lens

### In Lens Studio Editor

Open the Preview panel and select **Spectacles (2024)** as the device. Speak into your computer's microphone for voice input. Pinch detection works with the simulated hand controls. Gemini API calls require your API key to be configured in `RemoteServiceGatewayCredentials`.

### On Spectacles Device

Build to device via the Lens Studio device pairing flow. After install:

1. Look forward — say **"solo"**
2. An English prompt appears
3. Speak the Spanish translation
4. On correct → make a fist with your right hand visible to the device, then **pinch** to launch
5. Aim with your gaze (head direction)

For multiplayer, see the [Connected Lenses guide](https://developers.snap.com/spectacles/about-spectacles-features/connected-lenses/building-connected-lenses).

## Design Notes

### Why Pinch Instead of Throw Gesture?

Earlier iterations used a two-hand triangle gesture (thumbs + index fingers touching at 45°) and a push-forward gesture. Both were unreliable in real-time gameplay due to hand-tracking jitter and accidental triggers. Pinch is a single, well-calibrated SIK primitive that fires cleanly.

### Why Lenient Translation Grading?

ASR transcripts on-device drop accent marks, hear "se" as "say", and split compound words. A strict character match would frustrate fluent speakers. Gemini's lenient instruction accepts semantically equivalent answers and only rejects clear semantic errors or wrong-language responses.

### Why Random Respawn Instead of Multiple Opponents?

Spawning 5 distinct opponent prefabs would multiply collision detection cost and clutter the scene. Repositioning a single bobbing opponent achieves the same gameplay effect (different aim per shot) at a fraction of the runtime cost.

## Design Guidelines

Designing lenses for Spectacles offers all-new possibilities to rethink user interaction with digital spaces and the physical world. See Snap's [Design Guidelines](https://developers.snap.com/spectacles/best-practices/design-for-spectacles/introduction-to-spatial-design) for more.

## Support

If you have questions or need help, the Spectacles community is on [Reddit](https://www.reddit.com/r/Spectacles/).

## Contributing

Improvements and bug fixes are welcome via pull request.

---

*Built with 👻 on Spectacles*
