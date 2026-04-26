/**
 * Specs Inc. 2026
 * RoundController — per-player round state machine.
 * Flow: show prompt at bottom of FOV → auto-start ASR → judge transcript →
 * if correct, arm spell and wait for throw → on launch, cooldown then next.
 * If wrong, fizzle + brief pause + new prompt.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { PromptBank, Prompt, Difficulty } from "./PromptBank";
import { TranslationJudge } from "./TranslationJudge";
import { VoiceListener } from "./VoiceListener";
import { SpellController } from "./SpellController";
import { HealthSystem } from "./HealthSystem";
import { SoloOpponent } from "./SoloOpponent";
import { NetworkBridge } from "./NetworkBridge";
import { SessionController } from "SpectaclesSyncKit.lspkg/Core/SessionController";

export enum RoundState {
  Idle = "IDLE",
  PromptShown = "PROMPT_SHOWN",
  Listening = "LISTENING",
  Grading = "GRADING",
  Fizzling = "FIZZLING",
  SpellReady = "SPELL_READY",
  Throwing = "THROWING",
  Cooldown = "COOLDOWN",
  GameOver = "GAME_OVER",
}

@component
export class RoundController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">RoundController – per-player round flow</span>')
  @ui.separator

  @input
  private voiceListener: VoiceListener;

  @input
  private spellController: SpellController;

  @input
  @hint("Local player's health — decrements when remote spell hits us")
  private localHealth: HealthSystem;

  @input
  @hint("Text 3D component on the prompt book/page at the bottom of FOV")
  private promptText: Text3D;

  @input
  @hint("Text 3D component for fizzle/feedback messages")
  private feedbackText: Text3D;

  @input
  @allowUndefined
  @hint("Optional fizzle visual SceneObject — enabled briefly on incorrect translation")
  private fizzleVisual: SceneObject;

  @input
  @allowUndefined
  @hint("NetworkBridge for broadcasting spell launches (multiplayer only)")
  private networkBridge: NetworkBridge;

  @input
  @hint("Target language the player must speak in")
  private targetLanguage: string = "Spanish";

  @input
  @hint("Difficulty pulled from PromptBank — 'easy' | 'medium' | 'hard' or empty for any")
  private difficulty: string = "easy";

  @input
  @allowUndefined
  @hint("Solo opponent to disable on hit")
  private soloOpponent: SoloOpponent;

  @input
  @hint("Seconds between rounds")
  private cooldownSec: number = 1.5;

  @input
  @hint("Seconds the fizzle visual stays on after a wrong answer")
  private fizzleDurationSec: number = 1.2;

  @input
  @hint("Number of target hits required to win the game")
  private hitsToWin: number = 5;

  @input
  private enableLogging: boolean = false;

  private logger: Logger;
  private state: RoundState = RoundState.Idle;
  private currentPrompt: Prompt | null = null;
  private running: boolean = false;
  private hitsAchieved: number = 0;
  private sessionController: SessionController = SessionController.getInstance();
  private localUserId: string = "";

  public onStateChanged: Event<RoundState> = new Event<RoundState>();
  public onSpellReady: Event<void> = new Event<void>();
  public onGameOver: Event<{ won: boolean }> = new Event();

  onAwake(): void {
    this.logger = new Logger("RoundController", this.enableLogging, true);
  }

  @bindStartEvent
  private init(): void {
    if (this.fizzleVisual) this.fizzleVisual.enabled = false;

    // Get local user ID for spell broadcasts
    const userInfo = this.sessionController.getLocalUserInfo();
    if (userInfo && userInfo.userId) {
      this.localUserId = userInfo.userId;
    }

    // Subscribe to spell events
    this.spellController.onSpellLaunched.add((launchData: { position: vec3; velocity: vec3 }) => {
      this.handleSpellLaunched(launchData);
    });
    this.spellController.onSpellDespawned.add(() => this.handleSpellDespawned());
    this.localHealth.onDeath.add(() => this.endGame(false));
  }

  public begin(): void {
    if (this.running) return;
    this.running = true;
    this.hitsAchieved = 0;
    this.startRound();
  }

  public stop(): void {
    this.running = false;
    this.voiceListener.cancel();
    this.spellController.disarm();
  }

  public notifyOpponentDefeated(): void {
    this.hitsAchieved++;
    this.logger.info(`[HIT] ${this.hitsAchieved}/${this.hitsToWin} targets defeated`);

    if (this.hitsAchieved >= this.hitsToWin) {
      this.endGame(true);
      return;
    }

    // Reposition opponent for next target — game continues
    if (this.soloOpponent) {
      this.soloOpponent.respawnAtRandomPosition();
    }
    this.setFeedback(`Target down! ${this.hitsAchieved}/${this.hitsToWin}`);
  }

  private startRound(): void {
    if (!this.running || this.state === RoundState.GameOver) return;
    this.currentPrompt = this.pickPrompt();
    this.setPromptText(this.currentPrompt.english);
    this.setFeedback("");
    this.setState(RoundState.PromptShown);
    this.beginListening();
  }

  private pickPrompt(): Prompt {
    const d = this.difficulty as Difficulty;
    const valid = d === "easy" || d === "medium" || d === "hard";
    return valid ? PromptBank.random(d) : PromptBank.random();
  }

  private beginListening(): void {
    this.setState(RoundState.Listening);
    this.voiceListener
      .listenOnce()
      .then((transcript) => this.gradeTranscript(transcript))
      .catch((err) => {
        this.logger.error(`ASR failed: ${err}`);
        this.handleIncorrect("Couldn't hear you");
      });
  }

  private gradeTranscript(transcript: string): void {
    if (!this.currentPrompt) return;
    this.setState(RoundState.Grading);
    this.setFeedback("…");
    TranslationJudge.grade(
      this.currentPrompt.english,
      this.targetLanguage,
      transcript,
    ).then((judgment) => {
      if (judgment.correct) this.handleCorrect(judgment.reason);
      else this.handleIncorrect(judgment.reason);
    });
  }

  private handleCorrect(reason: string): void {
    this.setFeedback(reason || "Correct!");
    this.setState(RoundState.SpellReady);
    this.spellController.arm();
    this.onSpellReady.invoke();
  }

  private handleIncorrect(reason: string): void {
    this.setFeedback(reason || "Try again");
    this.setState(RoundState.Fizzling);
    if (this.fizzleVisual) this.fizzleVisual.enabled = true;
    const delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(() => {
      if (this.fizzleVisual) this.fizzleVisual.enabled = false;
      if (this.running && this.state !== RoundState.GameOver) this.startRound();
    });
    delay.reset(this.fizzleDurationSec);
  }

  private handleSpellLaunched(launchData: { position: vec3; velocity: vec3 }): void {
    if (this.state !== RoundState.SpellReady) return;
    this.setState(RoundState.Throwing);

    // Broadcast spell launch to remote player (multiplayer)
    if (this.networkBridge && this.localUserId) {
      this.networkBridge.broadcastSpellLaunch({
        ownerId: this.localUserId,
        position: launchData.position,
        velocity: launchData.velocity,
      });
      this.logger.info("[RoundController] Broadcasted spell launch to remote player");
    }
  }

  private handleSpellDespawned(): void {
    if (this.state !== RoundState.Throwing) return;
    this.setState(RoundState.Cooldown);
    const delay = this.createEvent("DelayedCallbackEvent");
    delay.bind(() => {
      if (this.running && this.state !== RoundState.GameOver) this.startRound();
    });
    delay.reset(this.cooldownSec);
  }

private endGame(won: boolean): void {
  this.running = false;
  this.setState(RoundState.GameOver);
  this.setPromptText(won ? "You win!" : "You lose");
  this.setFeedback("");
  this.spellController.disarm();
  this.voiceListener.cancel();
  
  if (won && this.soloOpponent) {
    this.soloOpponent.getSceneObject().enabled = false;
  }
  
  this.onGameOver.invoke({ won });
  
  // NEW: If won, ask to play again
  if (won) {
    this.promptForRestart();
  }
}

private promptForRestart(): void {
  this.setFeedback('Say "yes" to play again');
  this.voiceListener
    .listenOnce()
    .then((transcript) => {
      const t = transcript.toLowerCase().trim();
      if (t.indexOf("yes") >= 0 || t.indexOf("yeah") >= 0 || t.indexOf("play") >= 0) {
        this.restart();
      } else {
        this.setFeedback("Game ended");
      }
    })
    .catch(() => {
      this.setFeedback("Game ended");
    });
}

private restart(): void {
  this.logger.info("[RESTART] Resetting game state");

  // Reset state machine from GameOver back to Idle so startRound() can run
  this.setState(RoundState.Idle);

  // Reset hit counter
  this.hitsAchieved = 0;

  // Re-enable opponent and re-activate pacing
  if (this.soloOpponent) {
    this.soloOpponent.getSceneObject().enabled = true;
    this.soloOpponent.deactivate(); // resets to original position
    this.soloOpponent.activate();   // starts pacing again
  }

  // Reset local health
  this.localHealth.reset();

  // Cancel any pending voice listener so the new round can start fresh
  this.voiceListener.cancel();

  // Disarm any leftover spell
  this.spellController.disarm();

  // Restart the game loop
  this.running = false; // Force begin() to run startRound()
  this.begin();
}

  private setPromptText(text: string): void {
    if (this.promptText) this.promptText.text = text;
  }

  private setFeedback(text: string): void {
    if (this.feedbackText) this.feedbackText.text = text;
  }

  private setState(next: RoundState): void {
    if (this.state === next) return;
    this.logger.info(`${this.state} → ${next}`);
    this.state = next;
    this.onStateChanged.invoke(next);
  }

  public getState(): RoundState {
    return this.state;
  }
}
