<script lang="ts">
  import { motion } from "@motionone/svelte";
  import { onMount } from "svelte";
  import { Editor, type JSONContent } from "@tiptap/core";
  import { TextSelection } from "@tiptap/pm/state";
  import { TableColumnsSplit, TableRowsSplit } from "lucide-svelte";
  import {
    applySlashMenuCommand,
    getSlashMenuItems,
    isSlashMenuItemEnabled,
    type SlashMenuChain,
    type SlashMenuItem,
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
  import { replaceWikiLinksInPmDocument } from "$lib/core/editor/links/replace-wiki-links";
  import { prefersReducedMotion } from "$lib/state/motion.store";
  import {
    editorCommandStore,
    type EditorCommand,
  } from "$lib/state/editor-commands.store";
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
  export let noteId: string | null = null;
  export let linkCandidates: WikiLinkCandidate[] = [];
  export let spellcheck = true;
  export let smartListContinuation = false;
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
  let slashMenuQuery = "";
  const slashMenuItems = getSlashMenuItems();
  let slashMenuVisibleItems: SlashMenuItem[] = slashMenuItems;

  let tablePromptOpen = false;
  let tablePromptPosition: { x: number; y: number } | null = null;
  let tablePromptRows = 3;
  let tablePromptCols = 3;
  let tablePromptElement: HTMLDivElement | null = null;

  let embedPromptOpen = false;
  let embedPromptPosition: { x: number; y: number } | null = null;
  let embedPromptUrl = "";
  let embedPromptError = "";
  let embedPromptElement: HTMLDivElement | null = null;
  let embedPromptInput: HTMLInputElement | null = null;

  let imagePickerInput: HTMLInputElement | null = null;

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
  let tableToolbarVisible = false;

  const menuWidth = 240;
  const menuHeight = 320;
  const menuMargin = 8;
  const wikiMenuItemLimit = 12;

  const applyEditorCommand = (command: EditorCommand): void => {
    if (!editor) {
      return;
    }
    if (!noteId || command.noteId !== noteId) {
      return;
    }
    if (command.type === "replace-wiki-link") {
      const next = replaceWikiLinksInPmDocument({
        pmDocument: editor.getJSON() as Record<string, unknown>,
        replacements: [{ raw: command.raw, targetId: command.targetId }],
      });
      editor.commands.setContent(next as JSONContent, { emitUpdate: true });
    }
    if (command.type === "replace-wiki-links") {
      const next = replaceWikiLinksInPmDocument({
        pmDocument: editor.getJSON() as Record<string, unknown>,
        replacements: command.replacements,
      });
      editor.commands.setContent(next as JSONContent, { emitUpdate: true });
    }
  };

  $: if (editor) {
    editor.view.dom.setAttribute("spellcheck", spellcheck ? "true" : "false");
  }

  $: if (editor) {
    const smartStorage = (editor.storage as unknown as { smartListContinuation?: { enabled?: boolean } }).smartListContinuation;
    if (smartStorage) {
      smartStorage.enabled = smartListContinuation;
    }
  }

  const clamp = (value: number, min: number, max: number): number =>
    Math.min(Math.max(value, min), max);

  const getFirstEnabledIndex = (items: SlashMenuItem[]): number => {
    const index = items.findIndex(item => item.enabled);
    return index === -1 ? 0 : index;
  };

  const getNextEnabledIndex = (
    items: SlashMenuItem[],
    startIndex: number,
    direction: 1 | -1
  ): number => {
    if (items.length === 0) {
      return 0;
    }
    let nextIndex = startIndex;
    for (let step = 0; step < items.length; step += 1) {
      nextIndex =
        (nextIndex + direction + items.length) %
        items.length;
      if (items[nextIndex]?.enabled) {
        return nextIndex;
      }
    }
    return startIndex;
  };

  const normalizeSlashMenuQuery = (value: string): string =>
    value.trim().toLowerCase();

  const filterSlashMenuItems = (
    items: SlashMenuItem[],
    query: string
  ): SlashMenuItem[] => {
    const normalized = normalizeSlashMenuQuery(query);
    if (!normalized) {
      return items;
    }
    return items.filter(item => {
      const label = item.label.toLowerCase();
      return label.includes(normalized) || item.id.includes(normalized);
    });
  };

  const updateSlashMenuQuery = (): void => {
    if (!editor || !slashMenuOpen || slashMenuSlashPosition === null) {
      slashMenuQuery = "";
      return;
    }
    const selectionPos = editor.state.selection.from;
    if (selectionPos <= slashMenuSlashPosition) {
      closeSlashMenu();
      return;
    }
    const trigger = editor.state.doc.textBetween(
      slashMenuSlashPosition,
      slashMenuSlashPosition + 1,
      "\0",
      "\0"
    );
    if (trigger !== "/") {
      closeSlashMenu();
      return;
    }
    slashMenuQuery = editor.state.doc.textBetween(
      slashMenuSlashPosition + 1,
      selectionPos,
      "\0",
      "\0"
    );
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
    closeTablePrompt();
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    slashMenuPosition = resolveMenuPosition({
      left: coords.left,
      bottom: coords.bottom,
    });
    slashMenuOpen = true;
    slashMenuSlashPosition = slashPos;
    slashMenuQuery = "";
    slashMenuVisibleItems = filterSlashMenuItems(slashMenuItems, slashMenuQuery);
    slashMenuSelectedIndex = getFirstEnabledIndex(slashMenuVisibleItems);
  };

  const closeSlashMenu = (): void => {
    slashMenuOpen = false;
    slashMenuPosition = null;
    slashMenuSlashPosition = null;
    slashMenuQuery = "";
    slashMenuVisibleItems = slashMenuItems;
  };

  const closeTablePrompt = (): void => {
    tablePromptOpen = false;
    tablePromptPosition = null;
  };

  const openTablePrompt = (): void => {
    if (!editor) {
      return;
    }
    const chain = editor.chain().focus() as SlashMenuChain;
    deleteSlashCommandTextIfPresent(chain);
    chain.run();
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    tablePromptPosition = resolveMenuPosition({
      left: coords.left,
      bottom: coords.bottom,
    });
    tablePromptRows = 3;
    tablePromptCols = 3;
    tablePromptOpen = true;
    closeSlashMenu();
  };

  const clampTableValue = (value: number): number => {
    if (!Number.isFinite(value)) {
      return 3;
    }
    return Math.min(12, Math.max(1, Math.round(value)));
  };

  const insertTableFromPrompt = (): void => {
    if (!editor) {
      return;
    }
    const rows = clampTableValue(tablePromptRows);
    const cols = clampTableValue(tablePromptCols);
    editor
      .chain()
      .focus()
      .insertTable({ rows, cols, withHeaderRow: true })
      .run();
    closeTablePrompt();
  };

  const closeEmbedPrompt = (): void => {
    embedPromptOpen = false;
    embedPromptPosition = null;
    embedPromptUrl = "";
    embedPromptError = "";
  };

  const openEmbedPrompt = (): void => {
    if (!editor) {
      return;
    }
    closeWikiLinkMenu();
    closeTablePrompt();
    const chain = editor.chain().focus() as SlashMenuChain;
    deleteSlashCommandTextIfPresent(chain);
    chain.run();
    const coords = editor.view.coordsAtPos(editor.state.selection.from);
    embedPromptPosition = resolveMenuPosition({
      left: coords.left,
      bottom: coords.bottom,
    });
    embedPromptUrl = "";
    embedPromptError = "";
    embedPromptOpen = true;
    closeSlashMenu();
  };

  const resolveEmbedUrl = (value: string): string => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return "";
    }
    if (!/^https?:\/\/\S+$/u.test(trimmed)) {
      return "";
    }
    return trimmed;
  };

  const insertEmbedFromPrompt = (): void => {
    if (!editor) {
      return;
    }
    const url = resolveEmbedUrl(embedPromptUrl);
    if (!url) {
      embedPromptError = "Enter a valid http(s) URL.";
      return;
    }
    editor.chain().focus().insertContent({ type: "embed", attrs: { url } }).run();
    closeEmbedPrompt();
  };

  const openImagePicker = (): void => {
    imagePickerInput?.click();
  };

  const handleImagePickerChange = (): void => {
    const input = imagePickerInput;
    const file = input?.files?.[0] ?? null;
    if (!file) {
      return;
    }
    if (input) {
      input.value = "";
    }
    void handleImagePaste(file);
  };

  const updateTableToolbar = (): void => {
    if (!editor) {
      tableToolbarVisible = false;
      return;
    }
    tableToolbarVisible = editor.isActive("table");
  };

  const addTableRow = (): void => {
    if (!editor) {
      return;
    }
    editor.chain().focus().addRowAfter().run();
  };

  const addTableColumn = (): void => {
    if (!editor) {
      return;
    }
    editor.chain().focus().addColumnAfter().run();
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


  const deleteSlashCommandTextIfPresent = (chain: SlashMenuChain): void => {
    if (!editor) {
      return;
    }
    if (slashMenuSlashPosition === null) {
      return;
    }
    const slashPos = slashMenuSlashPosition;
    const selectionPos = editor.state.selection.from;
    if (selectionPos <= slashPos) {
      return;
    }
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
      chain.deleteRange({ from: slashPos, to: selectionPos });
    }
  };

  const selectSlashMenuItem = (itemId: SlashMenuItemId): void => {
    if (!editor || !isSlashMenuItemEnabled(itemId)) {
      return;
    }
    if (itemId === "table") {
      openTablePrompt();
      return;
    }
    if (itemId === "embed") {
      openEmbedPrompt();
      return;
    }
    if (itemId === "image") {
      const chain = editor.chain().focus() as SlashMenuChain;
      deleteSlashCommandTextIfPresent(chain);
      chain.run();
      closeSlashMenu();
      openImagePicker();
      return;
    }
    if (itemId === "callout") {
      const chain = editor.chain().focus() as SlashMenuChain;
      deleteSlashCommandTextIfPresent(chain);
      chain.run();
      editor
        .chain()
        .focus()
        .insertContent({
          type: "callout",
          attrs: { tone: "info" },
          content: [
            { type: "paragraph", content: [{ type: "text", text: "Callout" }] },
          ],
        })
        .run();
      closeSlashMenu();
      return;
    }
    const chain = editor.chain().focus() as SlashMenuChain;
    deleteSlashCommandTextIfPresent(chain);
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

  $: slashMenuVisibleItems = filterSlashMenuItems(slashMenuItems, slashMenuQuery);

  $: if (slashMenuOpen) {
    if (slashMenuVisibleItems.length === 0) {
      slashMenuSelectedIndex = 0;
    } else if (slashMenuSelectedIndex >= slashMenuVisibleItems.length) {
      slashMenuSelectedIndex = getFirstEnabledIndex(slashMenuVisibleItems);
    } else if (!slashMenuVisibleItems[slashMenuSelectedIndex]?.enabled) {
      slashMenuSelectedIndex = getFirstEnabledIndex(slashMenuVisibleItems);
    }
  }

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
                slashMenuVisibleItems,
                slashMenuSelectedIndex,
                1
              );
              return true;
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              slashMenuSelectedIndex = getNextEnabledIndex(
                slashMenuVisibleItems,
                slashMenuSelectedIndex,
                -1
              );
              return true;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              const selected = slashMenuVisibleItems[slashMenuSelectedIndex];
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
      extensions: createTiptapExtensions({
        smartListContinuation,
      }),
      content: content as JSONContent,
      editable,
      onUpdate: ({ editor }) => {
        if (wikiLinkOpen) {
          updateWikiLinkQuery();
        }
        if (slashMenuOpen) {
          updateSlashMenuQuery();
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
        updateTableToolbar();
        return;
      }
      slashMenuSlashPosition = transaction.mapping.map(slashMenuSlashPosition);
      if (wikiLinkOpen && wikiLinkStartPos !== null) {
        wikiLinkStartPos = transaction.mapping.map(wikiLinkStartPos);
        updateWikiLinkQuery();
      }
      updateTableToolbar();
    });
    editor.on("selectionUpdate", () => {
      updateTableToolbar();
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
    updateTableToolbar();
  };

  onMount(() => {
    initializeEditor();
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (tablePromptOpen) {
        if (tablePromptElement && tablePromptElement.contains(target)) {
          return;
        }
        closeTablePrompt();
      }
      if (embedPromptOpen) {
        // If the prompt just opened, the element may not be bound yet; avoid
        // immediately closing it on the same click event.
        if (!embedPromptElement) {
          return;
        }
        if (embedPromptElement.contains(target)) {
          return;
        }
        closeEmbedPrompt();
      }
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
      if (tablePromptOpen) {
        closeTablePrompt();
        return;
      }
      if (embedPromptOpen) {
        closeEmbedPrompt();
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

  $: if ($editorCommandStore && editor && noteId) {
    if ($editorCommandStore.noteId === noteId) {
      applyEditorCommand($editorCommandStore);
      editorCommandStore.set(null);
    }
  }

  $: if (lightboxOpen && lightboxBackdrop) {
    queueMicrotask(() => {
      lightboxBackdrop?.focus();
    });
  }

  $: if (embedPromptOpen && embedPromptInput) {
    queueMicrotask(() => {
      embedPromptInput?.focus();
    });
  }
</script>

<div class="editor-surface" data-testid="tiptap-surface" data-chrome={chrome}>
  {#if tableToolbarVisible}
    <div class="table-toolbar" role="group" aria-label="Table controls">
      <button
        class="table-action"
        type="button"
        aria-label="Add table row"
        on:click={addTableRow}
      >
        <TableRowsSplit aria-hidden="true" size={14} />
        <span>Add row</span>
      </button>
      <button
        class="table-action"
        type="button"
        aria-label="Add table column"
        on:click={addTableColumn}
      >
        <TableColumnsSplit aria-hidden="true" size={14} />
        <span>Add column</span>
      </button>
    </div>
  {/if}
  <div
    bind:this={element}
    class="editor-mount"
  ></div>
</div>

<input
  class="hidden-image-picker"
  type="file"
  accept="image/*"
  data-testid="slash-image-input"
  bind:this={imagePickerInput}
  on:change={handleImagePickerChange}
/>

<SlashMenu
  open={slashMenuOpen}
  position={slashMenuPosition}
  items={slashMenuVisibleItems}
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

{#if tablePromptOpen && tablePromptPosition}
  <div
    class="table-prompt"
    bind:this={tablePromptElement}
    style={`left:${tablePromptPosition.x}px; top:${tablePromptPosition.y}px;`}
  >
    <div class="table-prompt-title">Insert table</div>
    <div class="table-prompt-field">
      <label for="table-rows">Rows</label>
      <input
        id="table-rows"
        type="number"
        min="1"
        max="12"
        value={tablePromptRows}
        on:input={(event) => {
          const target = event.currentTarget;
          if (target instanceof HTMLInputElement) {
            tablePromptRows = Number.parseInt(target.value, 10);
          }
        }}
      />
    </div>
    <div class="table-prompt-field">
      <label for="table-cols">Columns</label>
      <input
        id="table-cols"
        type="number"
        min="1"
        max="12"
        value={tablePromptCols}
        on:input={(event) => {
          const target = event.currentTarget;
          if (target instanceof HTMLInputElement) {
            tablePromptCols = Number.parseInt(target.value, 10);
          }
        }}
      />
    </div>
    <div class="table-prompt-actions">
      <button class="table-prompt-button ghost" type="button" on:click={closeTablePrompt}>
        Cancel
      </button>
      <button
        class="table-prompt-button primary"
        type="button"
        on:click={insertTableFromPrompt}
      >
        Insert
      </button>
    </div>
  </div>
{/if}

{#if embedPromptOpen && embedPromptPosition}
  <div
    class="embed-prompt"
    data-testid="embed-prompt"
    bind:this={embedPromptElement}
    style={`left:${embedPromptPosition.x}px; top:${embedPromptPosition.y}px;`}
  >
    <div class="embed-prompt-title">Embed URL</div>
    <input
      class="embed-prompt-input"
      data-testid="embed-prompt-input"
      bind:this={embedPromptInput}
      value={embedPromptUrl}
      placeholder="https://example.com"
      on:input={(event) => {
        const target = event.currentTarget;
        if (target instanceof HTMLInputElement) {
          embedPromptUrl = target.value;
          embedPromptError = "";
        }
      }}
      on:keydown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          insertEmbedFromPrompt();
        }
      }}
    />
    {#if embedPromptError}
      <div class="embed-prompt-error" data-testid="embed-prompt-error">
        {embedPromptError}
      </div>
    {/if}
    <div class="embed-prompt-actions">
      <button
        class="embed-prompt-button ghost"
        type="button"
        data-testid="embed-prompt-cancel"
        on:click={closeEmbedPrompt}
      >
        Cancel
      </button>
      <button
        class="embed-prompt-button primary"
        type="button"
        data-testid="embed-prompt-insert"
        on:click={insertEmbedFromPrompt}
      >
        Insert
      </button>
    </div>
  </div>
{/if}

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
    position: relative;
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

  .table-toolbar {
    position: absolute;
    top: 8px;
    right: 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px;
    border-radius: var(--r-md);
    background: color-mix(in srgb, var(--bg-1) 70%, transparent);
    border: 1px solid var(--stroke-0);
    z-index: 2;
  }

  .table-action {
    height: 28px;
    padding: 0 8px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    cursor: pointer;
  }

  .table-action:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .table-action:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .table-action :global(svg) {
    width: 14px;
    height: 14px;
    display: block;
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

  .table-prompt {
    position: fixed;
    width: 220px;
    padding: 12px;
    border-radius: var(--r-md);
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    box-shadow: var(--shadow-popover);
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 120;
  }

  .table-prompt-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-0);
  }

  .table-prompt-field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: var(--text-1);
  }

  .table-prompt-field input {
    width: 72px;
    height: 28px;
    border-radius: var(--r-sm);
    border: 1px solid var(--stroke-0);
    background: var(--bg-1);
    color: var(--text-0);
    padding: 0 8px;
    font-size: 12px;
  }

  .table-prompt-field input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .table-prompt-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .table-prompt-button {
    height: 28px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    font-size: 12px;
    cursor: pointer;
  }

  .table-prompt-button.primary {
    background: var(--accent-0);
    color: #0b0d10;
  }

  .table-prompt-button.primary:hover {
    background: var(--accent-1);
  }

  .table-prompt-button.ghost:hover {
    background: var(--bg-3);
    color: var(--text-0);
  }

  .hidden-image-picker {
    position: fixed;
    left: -9999px;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .embed-prompt {
    position: fixed;
    width: 320px;
    padding: 12px;
    border-radius: var(--r-md);
    background: var(--bg-2);
    border: 1px solid var(--stroke-0);
    box-shadow: var(--shadow-popover);
    display: flex;
    flex-direction: column;
    gap: 10px;
    z-index: 120;
  }

  .embed-prompt-title {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-0);
  }

  .embed-prompt-input {
    width: 100%;
    height: 32px;
    border-radius: var(--r-sm);
    border: 1px solid var(--stroke-0);
    background: var(--bg-1);
    color: var(--text-0);
    padding: 0 10px;
    font-size: 12px;
  }

  .embed-prompt-input:focus-visible {
    outline: 2px solid var(--focus-ring);
    outline-offset: 2px;
  }

  .embed-prompt-error {
    font-size: 12px;
    color: var(--danger);
  }

  .embed-prompt-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  .embed-prompt-button {
    height: 28px;
    padding: 0 10px;
    border-radius: var(--r-sm);
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-1);
    font-size: 12px;
    cursor: pointer;
  }

  .embed-prompt-button.primary {
    background: var(--accent-0);
    color: #0b0d10;
  }

  .embed-prompt-button.primary:hover {
    background: var(--accent-1);
  }

  .embed-prompt-button.ghost:hover {
    background: var(--bg-3);
    color: var(--text-0);
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

  .editor-surface :global(div[data-type="callout"]) {
    margin: 12px 0;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-3);
    padding: 10px 12px;
    border-left: 3px solid var(--accent-0);
  }

  .editor-surface :global(div[data-type="callout"][data-tone="info"]) {
    border-left-color: var(--info);
  }

  .editor-surface :global(div[data-type="callout"] > div[data-callout-body]) {
    display: block;
  }

  .editor-surface :global(div[data-type="embed"]) {
    margin: 12px 0;
    border-radius: var(--r-md);
    border: 1px solid var(--stroke-0);
    background: var(--bg-3);
    padding: 10px 12px;
  }

  .editor-surface :global(div[data-type="embed"] a[data-embed-link="true"]) {
    color: var(--accent-0);
    text-decoration: none;
    word-break: break-word;
  }

  .editor-surface
    :global(div[data-type="embed"] a[data-embed-link="true"]:hover) {
    text-decoration: underline;
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
