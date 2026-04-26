/**
 * Specs Inc. 2026
 * HealthSystem — tracks the local player's health. Synced to the remote peer
 * via NetworkBridge so both players see matching health bars.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";

@component
export class HealthSystem extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">HealthSystem – player health + death</span>')
  @ui.separator

  @input
  @hint("Set to 1 for first-hit-wins (current spec). Bump to 3+ for the health-bar version later.")
  private maxHealth: number = 1;

  @input
  @allowUndefined
  @hint("Optional Text 3D component to render the current health value")
  private healthText: Text3D;

  @input
  private enableLogging: boolean = false;

  private logger: Logger;
  private current: number = 0;

  public onHealthChanged: Event<number> = new Event<number>();
  public onDeath: Event<void> = new Event<void>();

  onAwake(): void {
    this.logger = new Logger("HealthSystem", this.enableLogging, true);
    this.current = this.maxHealth;
    this.render();
  }

  public takeDamage(amount: number): void {
    if (this.current <= 0) return;
    this.current = Math.max(0, this.current - amount);
    this.logger.info(`HP: ${this.current}/${this.maxHealth}`);
    this.onHealthChanged.invoke(this.current);
    this.render();
    if (this.current === 0) this.onDeath.invoke();
  }

  public reset(): void {
    this.current = this.maxHealth;
    this.onHealthChanged.invoke(this.current);
    this.render();
  }

  public getHealth(): number {
    return this.current;
  }

  public isDead(): boolean {
    return this.current <= 0;
  }

  private render(): void {
    if (this.healthText) {
      this.healthText.text = `${this.current}/${this.maxHealth}`;
    }
  }
}
