/**
 * Specs Inc. 2026
 * HitDetector — sphere-vs-sphere collision between an in-flight spell and a
 * target head. Auto-subscribes to SpellController so it tracks any active
 * spell automatically. On hit, calls RoundController.notifyOpponentDefeated()
 * to end the round and despawns the spell.
 *
 * Solo mode: place one HitDetector inside SoloRoot, point at SoloOpponent.HeadProxy.
 * Multiplayer mode: a second instance can watch incoming remote spells vs local head.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { bindStartEvent } from "SnapDecorators.lspkg/decorators";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { SpellController } from "./SpellController";
import { RoundController } from "./RoundController";
import { NetworkBridge, RemoteSpellLaunch } from "./NetworkBridge";
import { HealthSystem } from "./HealthSystem";
import { SessionController } from "SpectaclesSyncKit.lspkg/Core/SessionController";

@component
export class HitDetector extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">HitDetector – spell vs head sphere check</span>')
  @ui.separator

  @input
  @hint("Spell source — auto-tracks any spell this controller launches")
  private spellController: SpellController;

  @input
  @hint("Target head SceneObject (e.g. SoloOpponent.HeadProxy)")
  private headTransform: SceneObject;

  @input
  @hint("Round controller — gets notifyOpponentDefeated() on hit")
  private roundController: RoundController;

  @input
  @allowUndefined
  @hint("NetworkBridge for receiving remote spell launches (multiplayer only)")
  private networkBridge: NetworkBridge;

  @input
  @allowUndefined
  @hint("Container to instantiate remote spells (MultiplayerRoot)")
  private multiplayerRoot: SceneObject;

  @input
  @allowUndefined
  @hint("Spell prefab for creating remote spell visuals")
  private spellPrefab: ObjectPrefab;

  @input
  @allowUndefined
  @hint("Local player health system — takes damage when remote spell hits")
  private healthSystem: HealthSystem;

  @input
  @hint("Hit radius around the head, in cm")
  private headRadius: number = 18;

  @input
  @hint("Hit radius of the spell, in cm")
  private spellRadius: number = 6;

  @input
  private enableLogging: boolean = false;

  private logger: Logger;
  private trackedSpell: SceneObject | null = null;
  private alreadyHit: boolean = false;
  private remoteSpells: Map<string, SceneObject> = new Map();  // Track remote spells by ID
  private sessionController: SessionController = SessionController.getInstance();
  private localUserId: string = "";

  public onHit: Event<void> = new Event<void>();
  public onMiss: Event<void> = new Event<void>();

  onAwake(): void {
    this.logger = new Logger("HitDetector", this.enableLogging, true);
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());

    // Get local user ID
    const userInfo = this.sessionController.getLocalUserInfo();
    if (userInfo && userInfo.userId) {
      this.localUserId = userInfo.userId;
    }
  }

  @bindStartEvent
  private init(): void {
    if (this.spellController) {
      this.spellController.onSpellLaunched.add(() => this.startTracking());
      this.spellController.onSpellDespawned.add(() => this.handleDespawn());
    }

    // Subscribe to remote spell launches (multiplayer)
    if (this.networkBridge) {
      this.networkBridge.onRemoteSpellLaunch.add((msg: RemoteSpellLaunch) => {
        this.handleRemoteSpellLaunch(msg);
      });
    }
  }

  private startTracking(): void {
    this.trackedSpell = this.spellController.getActiveSpell();
    this.alreadyHit = false;
    this.logger.info("Tracking spell");
  }

  private handleDespawn(): void {
    if (this.trackedSpell && !this.alreadyHit) {
      this.logger.info("Spell despawned without hit");
      this.onMiss.invoke();
    }
    this.trackedSpell = null;
  }

  private onUpdate(): void {
    if (!this.headTransform) return;

    const headPos = this.headTransform.getTransform().getWorldPosition();

    // Check collision with local tracked spell
    if (!this.alreadyHit && this.trackedSpell) {
      const spellPos = this.trackedSpell.getTransform().getWorldPosition();
      const dist = headPos.distance(spellPos);
      const hitDist = this.headRadius + this.spellRadius;
      if (dist <= hitDist) {
        this.alreadyHit = true;
        this.logger.info(`HIT — distance ${dist.toFixed(1)}cm`);
        this.onHit.invoke();
        if (this.roundController) this.roundController.notifyOpponentDefeated();
        this.spellController.despawn();
      }
    }

    // Check collision with remote spells
    for (const [spellId, remoteSpell] of this.remoteSpells.entries()) {
      if (!remoteSpell) continue;
      const spellPos = remoteSpell.getTransform().getWorldPosition();
      const dist = headPos.distance(spellPos);
      const hitDist = this.headRadius + this.spellRadius;
      if (dist <= hitDist) {
        this.logger.info(`REMOTE HIT from ${spellId} — distance ${dist.toFixed(1)}cm`);
        this.handleRemoteHit(spellId, remoteSpell);
      }
    }
  }

  private handleRemoteSpellLaunch(msg: RemoteSpellLaunch): void {
    if (!this.spellPrefab || !this.multiplayerRoot) {
      this.logger.warn("Cannot instantiate remote spell: missing prefab or multiplayerRoot");
      return;
    }

    const remoteSpell = this.spellPrefab.instantiate(this.multiplayerRoot);
    remoteSpell.getTransform().setWorldPosition(msg.position);

    // Generate a unique ID for this remote spell (using owner ID + current time)
    const spellId = `${msg.ownerId}_${getTime()}`;
    this.remoteSpells.set(spellId, remoteSpell);

    this.logger.info(
      `[RemoteSpell] Instantiated spell ${spellId} at (${msg.position.x.toFixed(1)},${msg.position.y.toFixed(1)},${msg.position.z.toFixed(1)})`
    );

    // Schedule cleanup of remote spell after its lifetime expires (assume 4 seconds like local spell)
    const cleanup = this.createEvent("DelayedCallbackEvent");
    cleanup.bind(() => {
      if (remoteSpell) remoteSpell.destroy();
      this.remoteSpells.delete(spellId);
      this.logger.info(`[RemoteSpell] Despawned spell ${spellId}`);
    });
    cleanup.reset(4.0);  // Match SpellController.spellLifetimeSec
  }

  private handleRemoteHit(spellId: string, remoteSpell: SceneObject): void {
    // Damage local player
    if (this.healthSystem) {
      this.healthSystem.takeDamage(10);  // Standard hit damage
      this.logger.info(`Took 10 damage from remote spell ${spellId}`);

      // Broadcast updated health to remote player
      if (this.networkBridge && this.localUserId) {
        this.networkBridge.broadcastHealth({
          ownerId: this.localUserId,
          health: this.healthSystem.getHealth(),
        });
        this.logger.info(`[HitDetector] Broadcasted health update: ${this.healthSystem.getHealth()}`);
      }
    }

    // Destroy the remote spell
    remoteSpell.destroy();
    this.remoteSpells.delete(spellId);
    this.logger.info(`Destroyed remote spell ${spellId}`);
  }
}
