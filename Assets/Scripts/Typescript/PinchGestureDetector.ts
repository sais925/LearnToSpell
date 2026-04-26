/**
 * Specs Inc. 2026
 * PinchGestureDetector — detects right-hand pinch gesture.
 * When user pinches right hand, emits onGestureDetected event.
 */
import Event from "SpectaclesInteractionKit.lspkg/Utils/Event";
import { Logger } from "Utilities.lspkg/Scripts/Utils/Logger";
import { SIK } from "SpectaclesInteractionKit.lspkg/SIK";

@component
export class PinchGestureDetector extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">PinchGestureDetector – right-hand pinch</span>')
  @ui.separator

  @input
  private enableLogging: boolean = false;

  private logger: Logger;
  private rightHand = SIK.HandInputData.getHand("right");

  public onGestureDetected: Event<void> = new Event<void>();
  public onGestureLost: Event<void> = new Event<void>();

  onAwake(): void {
    this.logger = new Logger("PinchGestureDetector", this.enableLogging, true);
    // Subscribe to pinch events on right hand
    this.rightHand.onPinchDown.add(() => this.onPinchDown());
    this.rightHand.onPinchUp.add(() => this.onPinchUp());
  }

  private onPinchDown(): void {
    this.logger.info("[PINCH] Right hand pinch detected!");
    this.onGestureDetected.invoke();
  }

  private onPinchUp(): void {
    this.logger.info("[PINCH] Right hand pinch released");
    this.onGestureLost.invoke();
  }

  public isPinching(): boolean {
    return this.rightHand.isPinching();
  }
}
