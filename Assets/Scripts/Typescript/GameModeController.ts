/**
 * Specs Inc. 2026
 * GameModeController — boot flow. Listens for the player to say "solo" or
 * "multiplayer", activates the matching scene root, kicks off the round.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { VoiceListener } from "./VoiceListener";
import { RoundController } from "./RoundController";
import { SoloOpponent } from "./SoloOpponent";

export type GameMode = "solo" | "multiplayer";

@component
export class GameModeController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">GameModeController – voice-driven mode select</span>')
  @ui.separator

  @input
  private voiceListener: VoiceListener;

  @input
  @hint("Text 3D shown to the player while listening for solo/multiplayer choice")
  private modePromptText: Text3D;

  @input
  @hint("Scene root containing solo-mode objects (SoloOpponent + setup)")
  private soloRoot: SceneObject;

  @input
  @hint("Scene root containing multiplayer objects (Sync Kit + remote player)")
  private multiplayerRoot: SceneObject;

  @input
  @hint("RoundController to start once a mode is selected")
  private roundController: RoundController;

  @input
  @allowUndefined
  @hint("Solo opponent — only used in solo mode. Leave empty if not present.")
  private soloOpponent: SoloOpponent;

  @input
  private enableLogging: boolean = false;

  private logger: Logger;
  private mode: GameMode | null = null;

  public onModeSelected: Event<GameMode> = new Event<GameMode>();

  onAwake(): void {
    this.logger = new Logger("GameModeController", this.enableLogging, true);
  }

  @bindStartEvent
  private init(): void {
    this.soloRoot.enabled = false;
    this.multiplayerRoot.enabled = false;
    this.promptForMode();
  }

  private promptForMode(): void {
    if (this.modePromptText) {
      this.modePromptText.text = 'Say "solo" or "multiplayer"';
    } /* Text3D and Text both expose a .text property — same call site works */
    this.voiceListener
      .listenOnce()
      .then((transcript) => this.handleTranscript(transcript))
      .catch((err) => {
        this.logger.error(`Mode select listen failed: ${err}`);
        this.promptForMode();
      });
  }

  private handleTranscript(transcript: string): void {
    const t = transcript.toLowerCase().trim();
    if (t.indexOf("solo") >= 0 || t.indexOf("alone") >= 0) {
      this.selectMode("solo");
    } else if (t.indexOf("multi") >= 0 || t.indexOf("two") >= 0) {
      this.selectMode("multiplayer");
    } else {
      if (this.modePromptText) {
        this.modePromptText.text = `Didn't catch "${transcript}". Say "solo" or "multiplayer".`;
      }
      this.promptForMode();
    }
  }

  private selectMode(mode: GameMode): void {
    this.mode = mode;
    this.logger.info(`Mode selected: ${mode}`);
    if (mode === "solo") {
      this.soloRoot.enabled = true;
      if (this.soloOpponent) this.soloOpponent.activate();
    } else {
      this.multiplayerRoot.enabled = true;
    }
    if (this.modePromptText) {
      this.modePromptText.text = "";
    }
    this.onModeSelected.invoke(mode);
    if (this.roundController) this.roundController.begin();
  }

  public getMode(): GameMode | null {
    return this.mode;
  }
}
