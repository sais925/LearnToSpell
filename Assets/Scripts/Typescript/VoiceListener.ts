/**
 * Specs Inc. 2026
 * VoiceListener — auto-triggered ASR helper. Unlike ASRQueryController which
 * is button-driven, this exposes a one-shot listenOnce() promise meant to be
 * called by other components (RoundController on prompt show, GameModeController
 * for mode select).
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class VoiceListener extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">VoiceListener – auto-trigger ASR</span>')
  @ui.separator

  @input
  @hint("Stop listening after this many ms of silence")
  private silenceTimeoutMs: number = 1500;

  @input
  private enableLogging: boolean = false;

  private logger: Logger;
  private asrModule: AsrModule = require("LensStudio:AsrModule");
  private isListening: boolean = false;

  public onTranscript: Event<string> = new Event<string>();
  public onError: Event<string> = new Event<string>();

  onAwake(): void {
    this.logger = new Logger("VoiceListener", this.enableLogging, true);
  }

  public listenOnce(): Promise<string> {
    return new Promise((resolve, reject) => {
      if (this.isListening) {
        reject("already listening");
        return;
      }
      this.isListening = true;
      const opts = AsrModule.AsrTranscriptionOptions.create();
      opts.mode = AsrModule.AsrMode.HighAccuracy;
      opts.silenceUntilTerminationMs = this.silenceTimeoutMs;
      opts.onTranscriptionUpdateEvent.add((out) => {
        if (out.isFinal) {
          this.isListening = false;
          this.asrModule.stopTranscribing();
          this.logger.info(`heard: "${out.text}"`);
          this.onTranscript.invoke(out.text);
          resolve(out.text);
        }
      });
      opts.onTranscriptionErrorEvent.add((err) => {
        this.isListening = false;
        this.logger.error(`ASR error: ${err}`);
        this.onError.invoke(String(err));
        reject(err);
      });
      this.asrModule.startTranscribing(opts);
    });
  }

  public cancel(): void {
    if (!this.isListening) return;
    this.asrModule.stopTranscribing();
    this.isListening = false;
  }

  public listening(): boolean {
    return this.isListening;
  }
}
