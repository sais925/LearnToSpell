/**
 * Specs Inc. 2026
 * SoloOpponent — fake second player for solo testing. Paces left/right around
 * its starting position so HitDetector has something to track and the player
 * has something to aim at without needing a connected peer.
 *
 * Supports respawning at random offsets from the original position so a single
 * SoloOpponent can serve as multiple "lives" of targets in the multi-hit win mode.
 */
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class SoloOpponent extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SoloOpponent – pacing target for solo mode</span>')
  @ui.separator

  @input
  @hint("How far left/right of the start position to pace, in cm")
  private pacingHalfWidthCm: number = 50;

  @input
  @hint("Pacing speed (full back-and-forth period in seconds)")
  private periodSec: number = 3.0;

  @input
  @hint("Random respawn x range from original position (cm) — left/right spread")
  private respawnRangeXCm: number = 80;

  @input
  @hint("Random respawn y range from original position (cm) — up/down spread")
  private respawnRangeYCm: number = 40;

  @input
  @hint("Random respawn z range from original position (cm) — depth spread")
  private respawnRangeZCm: number = 60;

  @input
  private enableLogging: boolean = false;

  private logger: Logger;
  private originalStartLocalPos: vec3;
  private startLocalPos: vec3;
  private elapsed: number = 0;
  private active: boolean = false;

  public getHeadTransform(): SceneObject {
    return this.getSceneObject();
  }

  onAwake(): void {
    this.logger = new Logger("SoloOpponent", this.enableLogging, true);
    this.originalStartLocalPos = this.getTransform().getLocalPosition();
    this.startLocalPos = this.originalStartLocalPos;
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  public activate(): void {
    this.active = true;
    this.elapsed = 0;
    this.logger.info("Solo opponent active");
  }

  public deactivate(): void {
    this.active = false;
    this.startLocalPos = this.originalStartLocalPos;
    this.getTransform().setLocalPosition(this.originalStartLocalPos);
  }

  /**
   * Move opponent to a random offset from its original spawn position.
   * Used after a successful hit to give the player a new target to aim at.
   */
  public respawnAtRandomPosition(): void {
    const offsetX = (Math.random() - 0.5) * 2 * this.respawnRangeXCm;
    const offsetY = (Math.random() - 0.5) * 2 * this.respawnRangeYCm;
    const offsetZ = (Math.random() - 0.5) * 2 * this.respawnRangeZCm;

    this.startLocalPos = new vec3(
      this.originalStartLocalPos.x + offsetX,
      this.originalStartLocalPos.y + offsetY,
      this.originalStartLocalPos.z + offsetZ,
    );
    this.elapsed = 0;
    this.getTransform().setLocalPosition(this.startLocalPos);
    this.active = true;
    this.logger.info(
      `Respawned at offset (${offsetX.toFixed(1)},${offsetY.toFixed(1)},${offsetZ.toFixed(1)})`
    );
  }

  private onUpdate(): void {
    if (!this.active) return;
    this.elapsed += getDeltaTime();
    const phase = (this.elapsed / this.periodSec) * 2 * Math.PI;
    const offset = Math.sin(phase) * this.pacingHalfWidthCm;
    const pos = new vec3(
      this.startLocalPos.x + offset,
      this.startLocalPos.y,
      this.startLocalPos.z,
    );
    this.getTransform().setLocalPosition(pos);
  }
}
