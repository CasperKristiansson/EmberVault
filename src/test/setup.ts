/* eslint-disable compat/compat */

import { vi } from "vitest";

const createAwsSdkEmptyResponse = (): Record<string, never> => ({});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

type AwsSdkCommandInstance = {
  input: Record<string, unknown>;
};

const awsSdkBaseCommand = function awsSdkBaseCommand(
  this: AwsSdkCommandInstance,
  input: unknown
): void {
  this.input = isRecord(input) ? input : {};
};

const awsSdkGetObjectCommand = function awsSdkGetObjectCommand(
  this: AwsSdkCommandInstance,
  input: unknown
): void {
  awsSdkBaseCommand.call(this, input);
};

const awsSdkPutObjectCommand = function awsSdkPutObjectCommand(
  this: AwsSdkCommandInstance,
  input: unknown
): void {
  awsSdkBaseCommand.call(this, input);
};

const awsSdkDeleteObjectCommand = function awsSdkDeleteObjectCommand(
  this: AwsSdkCommandInstance,
  input: unknown
): void {
  awsSdkBaseCommand.call(this, input);
};

const awsSdkListObjectsV2Command = function awsSdkListObjectsV2Command(
  this: AwsSdkCommandInstance,
  input: unknown
): void {
  awsSdkBaseCommand.call(this, input);
};

const awsSdkS3Client = function awsSdkS3Client(
  this: { send: ReturnType<typeof vi.fn> },
  config: unknown
): void {
  if (config) {
    // ignored
  }
  this.send = vi.fn(createAwsSdkEmptyResponse);
};

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
  public committed = false;

  public constructor() {
    super();
  }

  public cancel(): void {
    this.playState = "idle";
  }

  public commitStyles(): void {
    this.committed = true;
  }

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

// @aws-sdk/client-s3 pulls in @aws-sdk/core's ESM entrypoint which uses
// extensionless internal exports that Node can't import directly. Mock the SDK
// in unit tests; Playwright e2e covers the real browser bundle behavior.
vi.mock("@aws-sdk/client-s3", () => ({
  S3Client: awsSdkS3Client,
  GetObjectCommand: awsSdkGetObjectCommand,
  PutObjectCommand: awsSdkPutObjectCommand,
  DeleteObjectCommand: awsSdkDeleteObjectCommand,
  ListObjectsV2Command: awsSdkListObjectsV2Command,
}));
