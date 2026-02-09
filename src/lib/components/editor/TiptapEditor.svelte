<script lang="ts">
  import { motion } from "@motionone/svelte";
  import { onMount } from "svelte";
  import { Editor, type JSONContent } from "@tiptap/core";
  import { TextSelection } from "@tiptap/pm/state";
  import {
    applySlashMenuCommand,
    getSlashMenuItems,
    isSlashMenuItemEnabled,
    type SlashMenuChain,
    type SlashMenuItemId,
  } from "$lib/core/editor/slash-menu";
  import {
    buildWikiLinkInsertText,
    filterWikiLinkCandidates,
    type WikiLinkCandidate,
  } from "$lib/core/editor/wiki-links";
  import {
    extractImageFromClipboard,
    extractImageFromDataTransfer,
  } from "$lib/core/editor/images/paste";
  import {
    createEmptyDocument,
    createTiptapExtensions,
  } from "$lib/core/editor/tiptap-config";
  import { prefersReducedMotion } from "$lib/state/motion.store";
  import SlashMenu from "./SlashMenu.svelte";
  import WikiLinkMenu from "./WikiLinkMenu.svelte";

  export let content: Record<string, unknown> = createEmptyDocument();
  // Used to decide when external content should be applied into the editor.
  // Keep this stable during normal typing to avoid resetting the selection.
  export let contentKey = "";
  export let editable = true;
  export let ariaLabel = "Note content";
  export let dataTestId = "note-body";
  export let chrome: "boxed" | "flat" = "boxed";
  export let focusEmptyTitleOnClick = false;
  export let linkCandidates: WikiLinkCandidate[] = [];
  export let spellcheck = true;
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

  let element: HTMLDivElement | null = null;
  let editor: Editor | null = null;
  let lastContentKey: string | null = null;
  let syntheticPasteHandler: ((event: Event) => void) | null = null;
  let imageClickHandler: ((event: MouseEvent) => void) | null = null;

  let slashMenuOpen = false;
  let slashMenuPosition: { x: number; y: number } | null = null;
  let slashMenuSelectedIndex = 0;
  let slashMenuElement: HTMLDivElement | null = null;
  let slashMenuSlashPosition: number | null = null;
  const slashMenuItems = getSlashMenuItems();

  let wikiLinkOpen = false;
  let wikiLinkPosition: { x: number; y: number } | null = null;
  let wikiLinkSelectedIndex = 0;
  let wikiLinkElement: HTMLDivElement | null = null;
  let wikiLinkStartPos: number | null = null;
  let wikiLinkQuery = "";
  let wikiLinkItems: WikiLinkCandidate[] = [];

  let lightboxOpen = false;
  let lightboxSrc = "";
  let lightboxAlt = "";
  let lightboxCaption = "";
  let lightboxBackdrop: HTMLDivElement | null = null;

  const menuWidth = 240;
  const menuHeight = 320;
  const menuMargin = 8;
  const wikiMenuItemLimit = 12;

  $: if (editor) {
    editor.view.dom.setAttribute("spellcheck", spellcheck ? "true" : "false");
  }

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

  const getFirstEnabledIndex = (): number => {
    const index = slashMenuItems.findIndex(item => item.enabled);
    return index === -1 ? 0 : index;
  };

  const getNextEnabledIndex = (
    startIndex: number,
    direction: 1 | -1
  ): number => {
    if (slashMenuItems.length === 0) {
      return 0;
    }
    let nextIndex = startIndex;
    for (let step = 0; step < slashMenuItems.length; step += 1) {
      nextIndex =
        (nextIndex + direction + slashMenuItems.length) %
        slashMenuItems.length;
      if (slashMenuItems[nextIndex]?.enabled) {
        return nextIndex;
      }
    }
    return startIndex;
  };

  const getNextWikiLinkIndex = (
    startIndex: number,
    direction: 1 | -1
  ): number => {
    if (wikiLinkItems.length === 0) {
      return 0;
    }
    return (
      (startIndex + direction + wikiLinkItems.length) % wikiLinkItems.length
    );
  };

  const resolveMenuPosition = (coords: {
    left: number;
    bottom: number;
  }): { x: number; y: number } => {
    const maxX = Math.max(menuMargin, window.innerWidth - menuWidth - menuMargin);
    const maxY = Math.max(
      menuMargin,
      window.innerHeight - menuHeight - menuMargin
    );

    return {
      x: clamp(coords.left, menuMargin, maxX),
      y: clamp(coords.bottom + 6, menuMargin, maxY),
    };
  };

  const openSlashMenu = (slashPos: number | null): void => {
    if (!editor) {
      return;
    }
    closeWikiLinkMenu();
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    slashMenuPosition = resolveMenuPosition({
      left: coords.left,
      bottom: coords.bottom,
    });
    slashMenuOpen = true;
    slashMenuSlashPosition = slashPos;
    slashMenuSelectedIndex = getFirstEnabledIndex();
  };

  const closeSlashMenu = (): void => {
    slashMenuOpen = false;
    slashMenuPosition = null;
    slashMenuSlashPosition = null;
  };

  const openWikiLinkMenu = (startPos: number): void => {
    if (!editor) {
      return;
    }
    closeSlashMenu();
    wikiLinkStartPos = startPos;
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    wikiLinkPosition = resolveMenuPosition({
      left: coords.left,
      bottom: coords.bottom,
    });
    wikiLinkQuery = "";
    wikiLinkSelectedIndex = 0;
    wikiLinkOpen = true;
  };

  const closeWikiLinkMenu = (): void => {
    wikiLinkOpen = false;
    wikiLinkPosition = null;
    wikiLinkStartPos = null;
    wikiLinkQuery = "";
  };

  const updateWikiLinkQuery = (): void => {
    if (!editor || !wikiLinkOpen || wikiLinkStartPos === null) {
      return;
    }
    const selectionPos = editor.state.selection.from;
    if (selectionPos < wikiLinkStartPos + 2) {
      closeWikiLinkMenu();
      return;
    }
    const trigger = editor.state.doc.textBetween(
      wikiLinkStartPos,
      wikiLinkStartPos + 2,
      "\0",
      "\0"
    );
    if (trigger !== "[[") {
      closeWikiLinkMenu();
      return;
    }
    const activeText = editor.state.doc.textBetween(
      wikiLinkStartPos,
      selectionPos,
      "\0",
      "\0"
    );
    if (activeText.includes("]]")) {
      closeWikiLinkMenu();
      return;
    }
    wikiLinkQuery = editor.state.doc.textBetween(
      wikiLinkStartPos + 2,
      selectionPos,
      "\0",
      "\0"
    );
  };


  const deleteSlashIfPresent = (chain: SlashMenuChain): void => {
    if (!editor) {
      return;
    }
    const fallbackPos = editor.state.selection.from - 1;
    const slashPos = slashMenuSlashPosition ?? fallbackPos;
    if (slashPos < 0 || slashPos + 1 > editor.state.doc.content.size) {
      return;
    }
    const text = editor.state.doc.textBetween(
      slashPos,
      slashPos + 1,
      "\0",
      "\0"
    );
    if (text === "/") {
      chain.deleteRange({ from: slashPos, to: slashPos + 1 });
    }
  };

  const selectSlashMenuItem = (itemId: SlashMenuItemId): void => {
    if (!editor || !isSlashMenuItemEnabled(itemId)) {
      return;
    }
    const chain = editor.chain().focus() as SlashMenuChain;
    deleteSlashIfPresent(chain);
    if (applySlashMenuCommand(chain, itemId)) {
      chain.run();
    }
    closeSlashMenu();
  };

  const handleSlashMenuHighlight = (index: number): void => {
    if (slashMenuItems[index]?.enabled) {
      slashMenuSelectedIndex = index;
    }
  };

  const selectWikiLinkItem = (item: WikiLinkCandidate): void => {
    if (!editor || wikiLinkStartPos === null) {
      return;
    }
    const from = wikiLinkStartPos;
    const to = editor.state.selection.from;
    const insertText = buildWikiLinkInsertText(item);
    editor.chain().focus().insertContentAt({ from, to }, insertText).run();
    closeWikiLinkMenu();
  };

  const handleWikiLinkHighlight = (index: number): void => {
    if (wikiLinkItems[index]) {
      wikiLinkSelectedIndex = index;
    }
  };

  $: wikiLinkItems = filterWikiLinkCandidates(
    linkCandidates,
    wikiLinkQuery
  ).slice(0, wikiMenuItemLimit);

  $: if (wikiLinkOpen) {
    if (wikiLinkItems.length === 0) {
      wikiLinkSelectedIndex = 0;
    } else if (wikiLinkSelectedIndex >= wikiLinkItems.length) {
      wikiLinkSelectedIndex = 0;
    }
  }

  const handleImagePaste = async (file: File | Blob): Promise<void> => {
    if (!editor) {
      return;
    }
    const result = await onImagePaste(file);
    if (!result) {
      return;
    }
    const attributes = {
      src: result.src,
      assetId: result.assetId,
      ...(result.alt ? { alt: result.alt } : {}),
      ...(result.mime ? { mime: result.mime } : {}),
      ...(typeof result.width === "number" ? { width: result.width } : {}),
      ...(typeof result.height === "number" ? { height: result.height } : {}),
    };
    editor.chain().focus().setImage(attributes).run();
  };

  const resolveImageTarget = (
    target: EventTarget | null
  ): HTMLImageElement | null => {
    if (!target) {
      return null;
    }
    if (target instanceof HTMLImageElement) {
      return target.getAttribute("data-asset-id") ? target : null;
    }
    if (target instanceof HTMLElement) {
      const candidate = target.closest("img[data-asset-id]");
      return candidate instanceof HTMLImageElement ? candidate : null;
    }
    return null;
  };

  const openLightbox = (image: HTMLImageElement): void => {
    lightboxSrc = image.src;
    lightboxAlt = image.alt ?? "";
    const figure = image.closest("figure");
    lightboxCaption = figure?.getAttribute("data-caption") ?? "";
    lightboxOpen = Boolean(lightboxSrc);
  };

  const closeLightbox = (): void => {
    lightboxOpen = false;
    lightboxSrc = "";
    lightboxAlt = "";
    lightboxCaption = "";
  };

  const handleLightboxClick = (event: MouseEvent): void => {
    if (event.currentTarget === event.target) {
      closeLightbox();
    }
  };

  const handleLightboxKeydown = (event: KeyboardEvent): void => {
    if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      closeLightbox();
    }
  };

  const resolveDetailFile = (event: Event): File | Blob | null => {
    if (!("detail" in event)) {
      return null;
    }
    const detail = (event as CustomEvent<{ file?: unknown }>).detail;
    if (detail && typeof detail === "object") {
      const bytes = (detail as { bytes?: unknown }).bytes;
      const mime = (detail as { mime?: unknown }).mime;
      if (
        Array.isArray(bytes) &&
        bytes.every((entry) => typeof entry === "number")
      ) {
        const typedBytes = new Uint8Array(bytes);
        return new Blob(
          [typedBytes],
          typeof mime === "string" ? { type: mime } : undefined
        );
      }
    }
    const file =
      detail && typeof detail === "object"
        ? (detail as { file?: unknown }).file
        : null;
    if (file instanceof File) {
      return file;
    }
    if (file instanceof Blob) {
      return file;
    }
    if (file && typeof file === "object") {
      const candidate = file as { arrayBuffer?: unknown };
      if (typeof candidate.arrayBuffer === "function") {
        return file as Blob;
      }
    }
    return null;
  };

  const initializeEditor = (): void => {
    if (!element) {
      return;
    }
    editor = new Editor({
      element,
      editorProps: {
        attributes: {
          "aria-label": ariaLabel,
          "aria-multiline": "true",
          "data-testid": dataTestId,
          role: "textbox",
          spellcheck: spellcheck ? "true" : "false",
        },
        handleDOMEvents: {
          mousedown: (view, event) => {
            if (!focusEmptyTitleOnClick) {
              return false;
            }
            const first = view.state.doc.firstChild;
            if (first && first.textContent.trim().length > 0) {
              return false;
            }
            event.preventDefault();
            const tr = view.state.tr.setSelection(
              TextSelection.create(view.state.doc, 1)
            );
            view.dispatch(tr);
            view.focus();
            return true;
          },
          drop: (_view, event) => {
            const imageFile = extractImageFromDataTransfer(
              (event as DragEvent).dataTransfer
            );
            if (!imageFile) {
              return false;
            }
            event.preventDefault();
            void handleImagePaste(imageFile);
            return true;
          },
        },
        handleKeyDown: (_view, event) => {
          if (wikiLinkOpen) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              wikiLinkSelectedIndex = getNextWikiLinkIndex(
                wikiLinkSelectedIndex,
                1
              );
              return true;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              wikiLinkSelectedIndex = getNextWikiLinkIndex(
                wikiLinkSelectedIndex,
                -1
              );
              return true;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const selected = wikiLinkItems[wikiLinkSelectedIndex];
              if (selected) {
                selectWikiLinkItem(selected);
              }
              return true;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              closeWikiLinkMenu();
              return true;
            }
          }

          if (slashMenuOpen) {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              slashMenuSelectedIndex = getNextEnabledIndex(
                slashMenuSelectedIndex,
                1
              );
              return true;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              slashMenuSelectedIndex = getNextEnabledIndex(
                slashMenuSelectedIndex,
                -1
              );
              return true;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const selected = slashMenuItems[slashMenuSelectedIndex];
              if (selected) {
                selectSlashMenuItem(selected.id);
              }
              return true;
            }
            if (event.key === "Escape") {
              event.preventDefault();
              closeSlashMenu();
              return true;
            }
          }

          if ((event.metaKey || event.ctrlKey) && event.key === "/") {
            event.preventDefault();
            openSlashMenu(null);
            return true;
          }
          return false;
        },
        handlePaste: (_view, event) => {
          const imageFile =
            extractImageFromClipboard(event.clipboardData) ??
            resolveDetailFile(event);
          if (!imageFile) {
            return false;
          }
          event.preventDefault();
          void handleImagePaste(imageFile);
          return true;
        },
        handleDrop: (_view, event) => {
          if (event.defaultPrevented) {
            return true;
          }
          const imageFile = extractImageFromDataTransfer(event.dataTransfer);
          if (!imageFile) {
            return false;
          }
          event.preventDefault();
          void handleImagePaste(imageFile);
          return true;
        },
        handleTextInput: (_view, from, _to, text) => {
          if (text === "/" && editor && !editor.isActive("codeBlock")) {
            const slashPos = from;
            queueMicrotask(() => openSlashMenu(slashPos));
          }
          if (
            text === "[" &&
            editor &&
            !editor.isActive("codeBlock") &&
            !wikiLinkOpen &&
            from > 0
          ) {
            const previous = editor.state.doc.textBetween(
              from - 1,
              from,
              "\0",
              "\0"
            );
            if (previous === "[") {
              const startPos = from - 1;
              queueMicrotask(() => openWikiLinkMenu(startPos));
            }
          }
          return false;
        },
      },
      extensions: createTiptapExtensions(),
      content: content as JSONContent,
      editable,
      onUpdate: ({ editor }) => {
        if (wikiLinkOpen) {
          updateWikiLinkQuery();
        }
        onUpdate({
          json: editor.getJSON() as Record<string, unknown>,
          text: editor.getText(),
        });
      },
    });
    editor.on("transaction", ({ transaction }) => {
      if (!slashMenuOpen || slashMenuSlashPosition === null) {
        if (wikiLinkOpen && wikiLinkStartPos !== null) {
          wikiLinkStartPos = transaction.mapping.map(wikiLinkStartPos);
          updateWikiLinkQuery();
        }
        return;
      }
      slashMenuSlashPosition = transaction.mapping.map(slashMenuSlashPosition);
      if (wikiLinkOpen && wikiLinkStartPos !== null) {
        wikiLinkStartPos = transaction.mapping.map(wikiLinkStartPos);
        updateWikiLinkQuery();
      }
    });
    syntheticPasteHandler = (event: Event): void => {
      const file = resolveDetailFile(event);
      if (!file) {
        return;
      }
      event.preventDefault();
      void handleImagePaste(file);
    };
    element.addEventListener("embervault-paste-image", syntheticPasteHandler);
    (
      globalThis as {
        embervaultPasteImage?: (blob: File | Blob) => Promise<void>;
      }
    ).embervaultPasteImage = handleImagePaste;
    imageClickHandler = (event: MouseEvent): void => {
      const image = resolveImageTarget(event.target);
      if (!image) {
        return;
      }
      event.preventDefault();
      openLightbox(image);
    };
    element.addEventListener("click", imageClickHandler);
    lastContentKey = contentKey;
  };

  onMount(() => {
    initializeEditor();
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (slashMenuOpen) {
        if (slashMenuElement && slashMenuElement.contains(target)) {
          return;
        }
        closeSlashMenu();
      }
      if (wikiLinkOpen) {
        if (wikiLinkElement && wikiLinkElement.contains(target)) {
          return;
        }
        closeWikiLinkMenu();
      }
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (lightboxOpen) {
        closeLightbox();
        return;
      }
      if (wikiLinkOpen) {
        closeWikiLinkMenu();
        return;
      }
      if (slashMenuOpen) {
        closeSlashMenu();
      }
    };

    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKeydown);
      if (element && syntheticPasteHandler) {
        element.removeEventListener(
          "embervault-paste-image",
          syntheticPasteHandler
        );
      }
      if (element && imageClickHandler) {
        element.removeEventListener("click", imageClickHandler);
      }
      editor?.destroy();
      editor = null;
      syntheticPasteHandler = null;
      imageClickHandler = null;
      (
        globalThis as {
          embervaultPasteImage?: (blob: File | Blob) => Promise<void>;
        }
      ).embervaultPasteImage = undefined;
    };
  });

  $: if (element && !editor) {
    initializeEditor();
  }

  $: if (editor) {
    editor.setEditable(editable);
  }

  $: if (editor && contentKey !== lastContentKey) {
    editor.commands.setContent(content as JSONContent, { emitUpdate: false });
    lastContentKey = contentKey;
  }

  $: if (lightboxOpen && lightboxBackdrop) {
    queueMicrotask(() => {
      lightboxBackdrop?.focus();
    });
  }
</script>

<div class="editor-surface" data-testid="tiptap-surface" data-chrome={chrome}>
  <div
    bind:this={element}
    class="editor-mount"
  ></div>
</div>

<SlashMenu
  open={slashMenuOpen}
  position={slashMenuPosition}
  items={slashMenuItems}
  selectedIndex={slashMenuSelectedIndex}
  bind:element={slashMenuElement}
  onSelect={selectSlashMenuItem}
  onHighlight={handleSlashMenuHighlight}
/>

<WikiLinkMenu
  open={wikiLinkOpen}
  position={wikiLinkPosition}
  items={wikiLinkItems}
  selectedIndex={wikiLinkSelectedIndex}
  bind:element={wikiLinkElement}
  onSelect={selectWikiLinkItem}
  onHighlight={handleWikiLinkHighlight}
/>

{#if lightboxOpen}
  <div
    class="lightbox-backdrop"
    data-testid="image-lightbox"
    role="dialog"
    aria-modal="true"
    aria-label="Image preview"
    tabindex="0"
    bind:this={lightboxBackdrop}
    transition:motion={{ preset: "fade", reducedMotion: $prefersReducedMotion }}
    on:click={handleLightboxClick}
    on:keydown={handleLightboxKeydown}
  >
    <div
      class="lightbox-panel"
      role="document"
      transition:motion={{ preset: "modal", reducedMotion: $prefersReducedMotion }}
    >
      <img class="lightbox-image" src={lightboxSrc} alt={lightboxAlt} />
      {#if lightboxCaption}
        <div class="lightbox-caption">{lightboxCaption}</div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .editor-surface {
    width: 100%;
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    border-radius: var(--r-md);
    padding: 8px 12px;
  }

  .editor-surface[data-chrome="flat"] {
    background: transparent;
    border: none;
    border-radius: 0;
    padding: 8px 12px;
  }

  .editor-surface:focus-within {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .editor-surface :global(.ProseMirror) {
    min-height: 320px;
    font-size: 15px;
    line-height: 1.55;
    color: var(--text-0);
    outline: none;
  }

  .editor-surface[data-chrome="flat"] :global(.ProseMirror) {
    min-height: 100%;
  }

  .editor-surface[data-chrome="flat"] :global(.ProseMirror > :first-child) {
    margin: 0 0 16px;
    font-size: 28px;
    line-height: 1.2;
    font-weight: 500;
    color: var(--text-0);
  }

  .editor-surface :global(.ProseMirror p) {
    margin: 0;
  }

  .editor-surface :global(.ProseMirror p + p) {
    margin-top: 8px;
  }

  .editor-surface :global(.ProseMirror a) {
    color: var(--accent-0);
  }

  .editor-surface :global(.ProseMirror pre) {
    margin: 12px 0;
    padding: 12px;
    border-radius: var(--r-sm);
    border: 1px solid var(--stroke-0);
    background: var(--bg-3);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    color: var(--text-0);
    overflow-x: auto;
  }

  .editor-surface :global(.ProseMirror pre code) {
    color: var(--text-0);
  }

  .editor-surface :global(.ProseMirror pre .hljs-comment),
  .editor-surface :global(.ProseMirror pre .hljs-quote) {
    color: var(--text-2);
  }

  .editor-surface :global(.ProseMirror pre .hljs-keyword),
  .editor-surface :global(.ProseMirror pre .hljs-selector-tag),
  .editor-surface :global(.ProseMirror pre .hljs-literal) {
    color: var(--accent-0);
  }

  .editor-surface :global(.ProseMirror pre .hljs-string),
  .editor-surface :global(.ProseMirror pre .hljs-regexp) {
    color: var(--accent-1);
  }

  .editor-surface :global(.ProseMirror pre .hljs-title),
  .editor-surface :global(.ProseMirror pre .hljs-function) {
    color: var(--warning);
  }

  .editor-surface :global(.ProseMirror pre .hljs-attr),
  .editor-surface :global(.ProseMirror pre .hljs-attribute) {
    color: var(--success);
  }

  .editor-surface :global(.ProseMirror pre .hljs-number),
  .editor-surface :global(.ProseMirror pre .hljs-symbol),
  .editor-surface :global(.ProseMirror pre .hljs-built_in) {
    color: var(--info);
  }

  .editor-surface :global(.ProseMirror code) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
  }

  .editor-surface :global(.ProseMirror table) {
    width: 100%;
    border-collapse: collapse;
    margin: 12px 0;
  }

  .editor-surface :global(.ProseMirror th),
  .editor-surface :global(.ProseMirror td) {
    border: 1px solid var(--stroke-0);
    padding: 6px 8px;
    text-align: left;
  }

  .editor-surface :global(.ProseMirror tr:hover) {
    background: var(--bg-3);
  }

  .editor-surface :global(.ProseMirror ul[data-type="taskList"]) {
    list-style: none;
    padding-left: 0;
  }

  .editor-surface :global(.ProseMirror li[data-type="taskItem"]) {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .editor-surface :global(.ProseMirror li[data-type="taskItem"] > label) {
    margin-top: 2px;
  }

  .editor-surface
    :global(.ProseMirror li[data-type="taskItem"] input[type="checkbox"]) {
    accent-color: var(--accent-0);
  }

  .editor-surface
    :global(.ProseMirror .is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    color: var(--text-2);
    float: left;
    height: 0;
    pointer-events: none;
  }

  .editor-surface :global(.embervault-image) {
    margin: 12px 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .editor-surface :global(.embervault-image img) {
    max-width: 100%;
    border-radius: var(--r-md);
    cursor: zoom-in;
    display: block;
  }

  .editor-surface :global(.embervault-image figcaption) {
    font-size: 12px;
    color: var(--text-2);
    outline: none;
  }

  .editor-surface :global(.embervault-image figcaption[data-empty="true"]) {
    min-height: 16px;
  }

  .editor-surface
    :global(.embervault-image figcaption[data-empty="true"]::before) {
    content: attr(data-placeholder);
    color: var(--text-2);
  }

  .editor-surface :global(.embervault-math-inline) {
    display: inline-block;
    vertical-align: baseline;
  }

  .editor-surface :global(.embervault-math-block) {
    display: block;
    margin: 12px 0;
  }

  .editor-surface :global(.embervault-math-raw) {
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas,
      "Liberation Mono", "Courier New", monospace;
    white-space: pre-wrap;
  }

  .editor-surface :global(.embervault-math-block .embervault-math-raw) {
    padding: 8px 10px;
    border-radius: var(--r-sm);
    border: 1px solid var(--stroke-0);
    background: var(--bg-3);
  }

  .editor-surface :global(.embervault-math-render) {
    display: inline-block;
  }

  .lightbox-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(10px) saturate(1.1);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
    z-index: 50;
  }

  .lightbox-panel {
    background: var(--bg-1);
    border: 1px solid var(--stroke-0);
    box-shadow: var(--shadow-panel);
    border-radius: var(--r-md);
    padding: 16px;
    max-width: min(92vw, 960px);
  }

  .lightbox-image {
    display: block;
    max-width: 100%;
    max-height: 80vh;
    border-radius: var(--r-md);
  }

  .lightbox-caption {
    margin-top: 8px;
    color: var(--text-2);
    font-size: 13px;
  }
</style>
