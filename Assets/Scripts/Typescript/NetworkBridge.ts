/**
 * Specs Inc. 2026
 * NetworkBridge — thin wrapper around Spectacles Sync Kit for the spell-game.
 * Owns: spell spawn/launch broadcasts, health sync, round-start sync.
 *
 * INTENTIONALLY MINIMAL: most networked transform sync should ride on
 * SyncTransform components attached to the spell prefab in the scene, not
 * through here. This file is only for one-shot game events.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { SessionController } from "SpectaclesSyncKit.lspkg/Core/SessionController";

export interface RemoteSpellLaunch {
  ownerId: string;
  position: vec3;
  velocity: vec3;
}

export interface RemoteHealth {
  ownerId: string;
  health: number;
}

interface NetworkMessage {
  type: "spell_launch" | "health" | "round_start";
  payload: any;
}

@component
export class NetworkBridge extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">NetworkBridge – Sync Kit event glue</span>')
  @ui.separator

  @input
  private enableLogging: boolean = false;

  private logger: Logger;
  private sessionController: SessionController = SessionController.getInstance();
  private session: MultiplayerSession | null = null;
  private localUserId: string = "";

  public onRemoteSpellLaunch: Event<RemoteSpellLaunch> = new Event<RemoteSpellLaunch>();
  public onRemoteHealth: Event<RemoteHealth> = new Event<RemoteHealth>();
  public onRoundStart: Event<{ promptIndex: number }> = new Event();

  onAwake(): void {
    this.logger = new Logger("NetworkBridge", this.enableLogging, true);

    // Subscribe to SessionController message events
    this.sessionController.onMessageReceived.add(
      (session: MultiplayerSession, userId: string, message: string, senderInfo: any) => {
        this.handleRemoteMessage(session, userId, message, senderInfo);
      }
    );

    // Subscribe to session creation to capture the session when it's ready
    this.sessionController.onSessionCreated.add(
      (session: MultiplayerSession, creationType: any) => {
        this.session = session;
        this.logger.info("[NetworkBridge] Session created and ready");
      }
    );

    // Subscribe to session sharing (for multiplayer)
    this.sessionController.onSessionShared.add((session: MultiplayerSession) => {
      this.session = session;
      this.logger.info("[NetworkBridge] Session shared (multiplayer active)");
    });

    // Try to get the current session immediately (may be null if not ready yet)
    this.session = this.sessionController.getSession();

    // Get local user info
    const userInfo = this.sessionController.getLocalUserInfo();
    if (userInfo && userInfo.userId) {
      this.localUserId = userInfo.userId;
      this.logger.info(`[NetworkBridge] Local user: ${this.localUserId}`);
    }
  }

  private handleRemoteMessage(
    session: MultiplayerSession,
    userId: string,
    messageStr: string,
    senderInfo: any
  ): void {
    // Skip messages from self
    if (userId === this.localUserId) {
      return;
    }

    try {
      const msg: NetworkMessage = JSON.parse(messageStr);

      switch (msg.type) {
        case "spell_launch":
          const spellMsg = msg.payload as RemoteSpellLaunch;
          this.logger.info(
            `[NetworkBridge] Received spell_launch from ${userId}: pos=(${spellMsg.position.x.toFixed(1)},${spellMsg.position.y.toFixed(1)},${spellMsg.position.z.toFixed(1)}) vel=(${spellMsg.velocity.x.toFixed(1)},${spellMsg.velocity.y.toFixed(1)},${spellMsg.velocity.z.toFixed(1)})`
          );
          this.onRemoteSpellLaunch.invoke(spellMsg);
          break;

        case "health":
          const healthMsg = msg.payload as RemoteHealth;
          this.logger.info(`[NetworkBridge] Received health from ${userId}: health=${healthMsg.health}`);
          this.onRemoteHealth.invoke(healthMsg);
          break;

        case "round_start":
          const roundMsg = msg.payload as { promptIndex: number };
          this.logger.info(`[NetworkBridge] Received round_start: promptIndex=${roundMsg.promptIndex}`);
          this.onRoundStart.invoke(roundMsg);
          break;

        default:
          this.logger.warn(`[NetworkBridge] Unknown message type: ${msg.type}`);
      }
    } catch (err) {
      this.logger.error(`[NetworkBridge] Failed to parse message: ${err}`);
    }
  }

  public broadcastSpellLaunch(payload: RemoteSpellLaunch): void {
    if (!this.session) {
      this.logger.warn("[NetworkBridge] Cannot broadcast: session not ready");
      return;
    }
    const msg: NetworkMessage = { type: "spell_launch", payload };
    const messageStr = JSON.stringify(msg);
    this.session.sendMessage(messageStr);
    this.logger.info("[NetworkBridge] Broadcasted spell_launch");
  }

  public broadcastHealth(payload: RemoteHealth): void {
    if (!this.session) {
      this.logger.warn("[NetworkBridge] Cannot broadcast: session not ready");
      return;
    }
    const msg: NetworkMessage = { type: "health", payload };
    const messageStr = JSON.stringify(msg);
    this.session.sendMessage(messageStr);
    this.logger.info("[NetworkBridge] Broadcasted health");
  }

  public broadcastRoundStart(promptIndex: number): void {
    if (!this.session) {
      this.logger.warn("[NetworkBridge] Cannot broadcast: session not ready");
      return;
    }
    const msg: NetworkMessage = { type: "round_start", payload: { promptIndex } };
    const messageStr = JSON.stringify(msg);
    this.session.sendMessage(messageStr);
    this.logger.info("[NetworkBridge] Broadcasted round_start");
  }
}
