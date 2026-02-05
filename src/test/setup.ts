/* eslint-disable compat/compat */

class AnimationStub extends EventTarget implements Animation {
  public currentTime: number | null = 0;
  public effect: AnimationEffect | null = null;
  public finished: Promise<Animation> = Promise.resolve(this);
  public id = "";
  public oncancel:
    | ((this: Animation, event: AnimationPlaybackEvent) => void)
    | null = null;
  public onfinish:
    | ((this: Animation, event: AnimationPlaybackEvent) => void)
    | null = null;
  public onremove:
    | ((this: Animation, event: AnimationPlaybackEvent) => void)
    | null = null;
  public pending = false;
  public playbackRate = 1;
  public playState: AnimationPlayState = "idle";
  public ready: Promise<Animation> = Promise.resolve(this);
  public replaceState: AnimationReplaceState = "active";
  public startTime: number | null = 0;
  public timeline: AnimationTimeline | null = null;

  public constructor() {
    super();
  }

  public cancel(): void {
    this.playState = "idle";
  }

  public commitStyles(): void {}

  public finish(): void {
    this.playState = "finished";
  }

  public play(): void {
    this.playState = "running";
  }

  public pause(): void {
    this.playState = "paused";
  }

  public persist(): void {
    this.replaceState = "persisted";
  }

  public reverse(): void {
    this.playbackRate = -this.playbackRate;
  }

  public updatePlaybackRate(playbackRate: number): void {
    this.playbackRate = playbackRate;
  }
}

const createAnimationStub = (): Animation => new AnimationStub();

// eslint-disable-next-line sonarjs/class-prototype
Element.prototype.animate = createAnimationStub;
