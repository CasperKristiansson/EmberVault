<script lang="ts">
  export let content: Record<string, unknown> = {};
  export let editable = true;
  export let ariaLabel = "Note content";
  export let dataTestId = "note-body";
  export let onImagePaste: (file: File | Blob) => Promise<{
    assetId: string;
    src: string;
    alt?: string;
    mime?: string;
    width?: number;
    height?: number;
  } | null> = async () => null;
  export let onUpdate: (payload: {
    json: Record<string, unknown>;
    text: string;
  }) => void = () => {};
  const trackProps = (..._args: unknown[]): void => {};
  trackProps(content, editable, onImagePaste, onUpdate);
</script>

<div data-testid={dataTestId} aria-label={ariaLabel}></div>
