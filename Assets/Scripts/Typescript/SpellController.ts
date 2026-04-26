/**
 * Specs Inc. 2026
 * SpellController — fireball lifecycle.
 * Flow: arm() spawns spell at hand and subscribes to TriangleGestureDetector →
 * when gesture detected, launch → unparent, latch forward velocity along
 * head's forward axis, fly straight until lifetime ends or hit.
 *
 * Gesture: Two-hand triangle (thumbs + index fingers touching at 45° angle).
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { PinchGestureDetector } from "./PinchGestureDetector";

type Phase = "idle" | "armed" | "flying";

@component
export class SpellController extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">SpellController – push-to-throw fireball</span>')
  @ui.separator

  @input
  @hint("Prefab for the fireball visual (sphere + particles + collider)")
  private spellPrefab: ObjectPrefab;

  @input
  @hint("Hand SceneObject — fireball spawns here and tracks this until launch")
  private handTransform: SceneObject;

  @input
  @hint("Head/camera SceneObject — its forward vector is the throw direction")
  private headTransform: SceneObject;

  @input
  @hint("Speed of the fireball in cm/sec along head's forward axis")
  private throwSpeedCmPerSec: number = 600;

  @input
  @hint("Gesture detector component (PinchGestureDetector)")
  private gestureDetector: PinchGestureDetector;

  @input
  @hint("Seconds the fireball lives before auto-despawn if it misses")
  private spellLifetimeSec: number = 4.0;

  @input
  private enableLogging: boolean = false;

  @input
  @hint("Forward offset from hand in local space (cm) — positive = away from palm")
  private handOffsetForwardCm: number = 8;

  @input
  @hint("Up offset from hand in local space (cm)")
  private handOffsetUpCm: number = 0;

  @input
  @hint("Right offset from hand in local space (cm)")
  private handOffsetRightCm: number = 0;

  @input
  @hint("Min seconds between arming and accepting a pinch — prevents accidental instant-launch")
  private launchCooldownSec: number = 0.5;

  private logger: Logger;
  private phase: Phase = "idle";
  private activeSpell: SceneObject | null = null;
  private flightVelocity: vec3 | null = null;
  private flightStartedAt: number = 0;
  private armedAt: number = 0;
  // True when the player was already pinching at arm-time — they must release
  // their pinch and then pinch again before the next launch is accepted.
  // Prevents the "instant launch" bug where a held-over pinch fires immediately.
  private requiresPinchRelease: boolean = false;

  public onSpellLaunched: Event<{ position: vec3; velocity: vec3 }> = new Event();
  public onSpellDespawned: Event<void> = new Event<void>();

  onAwake(): void {
    this.logger = new Logger("SpellController", this.enableLogging, true);
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
    // Subscribe to gesture detector when script awakens
    if (this.gestureDetector) {
      this.gestureDetector.onGestureDetected.add(() => this.launchSpell());
      // Track pinch release so we can require a release-then-pinch sequence
      // when the player was already pinching at arm-time.
      this.gestureDetector.onGestureLost.add(() => this.onPinchReleased());
    }
  }

  private onPinchReleased(): void {
    if (this.requiresPinchRelease) {
      this.requiresPinchRelease = false;
      this.logger.info("[ARM] Pinch released — next pinch will launch.");
    }
  }

  public arm(): void {
    if (this.phase !== "idle") {
      this.logger.warn(`[ARM] Cannot arm — phase is "${this.phase}", expected "idle"`);
      return;
    }
    if (!this.spellPrefab || !this.handTransform || !this.headTransform) {
      this.logger.error("Missing prefab/hand/head reference");
      return;
    }
    // Parent spell to hand — it tracks the hand naturally via parent transform
    this.activeSpell = this.spellPrefab.instantiate(this.handTransform);
    // Offset spell in hand's local space (tune via Inspector for correct placement)
    const localOffset = new vec3(
      this.handOffsetRightCm,
      this.handOffsetUpCm,
      this.handOffsetForwardCm,
    );
    this.activeSpell.getTransform().setLocalPosition(localOffset);
    this.phase = "armed";
    this.armedAt = getTime();

    // If the player's hand is already pinching at arm-time, require them to
    // release the pinch before the next pinch is accepted as a launch.
    // This prevents the "instant launch" bug where a stale held pinch fires
    // immediately on arm.
    if (this.gestureDetector && this.gestureDetector.isPinching()) {
      this.requiresPinchRelease = true;
      this.logger.info(
        "[ARM] Hand was already pinching — release pinch first, then re-pinch to launch."
      );
    } else {
      this.requiresPinchRelease = false;
    }

    // Log the spawned spell's world position for diagnostics
    const worldPos = this.activeSpell.getTransform().getWorldPosition();
    this.logger.info(
      `[ARM] Spell armed at hand-local offset (R=${this.handOffsetRightCm},U=${this.handOffsetUpCm},F=${this.handOffsetForwardCm}) world=(${worldPos.x.toFixed(1)},${worldPos.y.toFixed(1)},${worldPos.z.toFixed(1)}). Pinch right hand to launch!`
    );
  }

  public disarm(): void {
    if (this.activeSpell) {
      this.activeSpell.destroy();
      this.activeSpell = null;
    }
    this.phase = "idle";
  }

  public despawn(): void {
    if (this.activeSpell) {
      this.activeSpell.destroy();
      this.activeSpell = null;
    }
    this.phase = "idle";
    this.onSpellDespawned.invoke();
  }

  public getActiveSpell(): SceneObject | null {
    return this.activeSpell;
  }

  private onUpdate(): void {
    // Spell is parented to hand while armed — tracks naturally, no per-frame update needed
    if (this.phase === "flying") this.tickFlying();
  }

  private launchSpell(): void {
    // Defensive: only launch from armed state (prevents stray pinches from re-launching a flying spell)
    if (this.phase !== "armed") {
      this.logger.info(`[LAUNCH] Pinch ignored — phase is "${this.phase}", not "armed"`);
      return;
    }
    if (!this.activeSpell) {
      this.logger.warn("[LAUNCH] Pinch ignored — phase says armed but activeSpell is null");
      return;
    }
    // Anti-instant-launch: if the player was already pinching when arm() ran,
    // they must release first so a stale held pinch can't fire immediately.
    if (this.requiresPinchRelease) {
      this.logger.info(
        "[LAUNCH] Pinch ignored — player was already pinching at arm-time. Release pinch first."
      );
      return;
    }
    // Cooldown guard: prevent instant-launch if a pinch fires the same frame the spell arms
    const sinceArm = getTime() - this.armedAt;
    if (sinceArm < this.launchCooldownSec) {
      this.logger.info(
        `[LAUNCH] Pinch ignored — too soon after arm (${sinceArm.toFixed(2)}s < ${this.launchCooldownSec}s cooldown). Spell stays armed.`
      );
      return;
    }
    const spawnPos = this.activeSpell.getTransform().getWorldPosition();
    this.activeSpell.setParent(null);
    const dir = this.headTransform.getTransform().forward;
    this.flightVelocity = dir.uniformScale(this.throwSpeedCmPerSec);
    this.flightStartedAt = getTime();
    this.phase = "flying";
    this.logger.info(`[LAUNCH] Spell launched with velocity=(${this.flightVelocity.x.toFixed(1)},${this.flightVelocity.y.toFixed(1)},${this.flightVelocity.z.toFixed(1)})`);
    this.onSpellLaunched.invoke({ position: spawnPos, velocity: this.flightVelocity });
  }

  private tickFlying(): void {
    if (!this.activeSpell || !this.flightVelocity) return;
    const elapsed = getTime() - this.flightStartedAt;
    if (elapsed > this.spellLifetimeSec) {
      this.logger.info(`[FLYING] Spell despawned after ${elapsed.toFixed(2)}s`);
      this.despawn();
      return;
    }
    const dt = getDeltaTime();
    const t = this.activeSpell.getTransform();
    const cur = t.getWorldPosition();
    const next = cur.add(this.flightVelocity.uniformScale(dt));
    t.setWorldPosition(next);
    // Log every 0.5 seconds to avoid spam
    if (Math.floor(elapsed * 2) !== Math.floor((elapsed - dt) * 2)) {
      this.logger.info(`[FLYING] elapsed=${elapsed.toFixed(2)}s pos=(${next.x.toFixed(1)},${next.y.toFixed(1)},${next.z.toFixed(1)})`);
    }
  }
}
