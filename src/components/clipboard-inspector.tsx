import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useId,
} from "react"
import {
  RiClipboardLine,
  RiFileCopyLine,
  RiCheckLine,
  RiArrowLeftLine,
  RiDragDropLine,
  RiSunLine,
  RiMoonLine,
  RiLoader2Line,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { Logo } from "@/components/logo"

// ─── Types ───────────────────────────────────────────────────────────

interface FileInfo {
  name: string
  size: number
  type: string
  url: string
}

interface TypeEntry {
  id: string
  type: string
  data: string | FileInfo | null
}

interface ItemEntry {
  id: string
  kind: string
  type: string
  value: string | FileInfo | null
}

interface FileEntry {
  id: string
  info: FileInfo
}

interface ClipboardData {
  id: string
  source: string
  types: TypeEntry[]
  items: ItemEntry[] | null
  files: FileEntry[] | null
}

// ─── Helpers ─────────────────────────────────────────────────────────

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const editableParent = target.closest(
    "input, textarea, select, [contenteditable='true']"
  )
  return editableParent !== null
}

function fileInfo(file: File | Blob): FileInfo | null {
  if (!file) return null
  return {
    name: file instanceof File ? file.name : "blob",
    size: file.size,
    type: file.type,
    url: URL.createObjectURL(file),
  }
}

function revokeEntries(entries: ClipboardData[]) {
  for (const entry of entries) {
    for (const t of entry.types) {
      if (t.data && typeof t.data !== "string") {
        URL.revokeObjectURL(t.data.url)
      }
    }
    if (entry.items) {
      for (const item of entry.items) {
        if (item.value && typeof item.value !== "string") {
          URL.revokeObjectURL(item.value.url)
        }
      }
    }
    if (entry.files) {
      for (const f of entry.files) {
        URL.revokeObjectURL(f.info.url)
      }
    }
  }
}

let nextId = 0
function genId() {
  return `cb-${++nextId}`
}

// ─── Extraction ──────────────────────────────────────────────────────

async function extractFromDataTransfer(
  dt: DataTransfer,
  source: string
): Promise<ClipboardData> {
  const types: TypeEntry[] = Array.from(dt.types).map((type) => ({
    id: genId(),
    type,
    data: dt.getData(type),
  }))

  const items: ItemEntry[] | null = dt.items
    ? await Promise.all(
        Array.from(dt.items).map(async (item) => ({
          id: genId(),
          kind: item.kind,
          type: item.type,
          value:
            item.kind === "string"
              ? await new Promise<string>((r) => item.getAsString(r))
              : fileInfo(item.getAsFile()),
        }))
      )
    : null

  const files: FileEntry[] | null = dt.files
    ? Array.from(dt.files)
        .map((f) => {
          const info = fileInfo(f)
          return info ? { id: genId(), info } : null
        })
        .filter((f): f is FileEntry => f !== null)
    : null

  return { id: genId(), source, types, items, files }
}

async function extractFromClipboardItems(
  clipboardItems: ClipboardItems
): Promise<ClipboardData[]> {
  const results: ClipboardData[] = []
  for (const item of clipboardItems) {
    const types: TypeEntry[] = (
      await Promise.all(
        Array.from(item.types).map(async (type) => {
          try {
            const blob = await item.getType(type)
            const isText =
              blob.type.startsWith("text/") || blob.type === "image/svg+xml"
            return {
              id: genId(),
              type,
              data: isText ? await blob.text() : fileInfo(blob),
            }
          } catch {
            return null
          }
        })
      )
    ).filter((t): t is TypeEntry => t !== null)
    if (types.length > 0) {
      results.push({
        id: genId(),
        source: "ClipboardItem",
        types,
        items: null,
        files: null,
      })
    }
  }
  return results
}

// ─── Component ───────────────────────────────────────────────────────

export function ClipboardInspector() {
  const [data, setData] = useState<ClipboardData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copiedType, setCopiedType] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [isReading, setIsReading] = useState(false)

  const dragCounter = useRef(0)
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dataRef = useRef<ClipboardData[]>([])
  const errorId = useId()

  const isMac = /mac|iphone|ipad|ipod/i.test(navigator.userAgent)
  const modKey = isMac ? "⌘" : "Ctrl"
  const { theme, setTheme } = useTheme()

  // Keep ref in sync so unmount / clear can revoke old URLs
  dataRef.current = data

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark")
  }, [theme, setTheme])

  const clear = useCallback(() => {
    revokeEntries(dataRef.current)
    setData([])
    setError(null)
  }, [])

  const copyAsText = useCallback(async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedType(type)
      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current)
      }
      copiedTimeoutRef.current = setTimeout(() => {
        setCopiedType(null)
        copiedTimeoutRef.current = null
      }, 1500)
    } catch {
      setError("Failed to copy to clipboard")
    }
  }, [])

  const readClipboardApi = useCallback(async () => {
    if (isReading) return
    setIsReading(true)
    setError(null)
    try {
      const items = await navigator.clipboard.read()
      const results = await extractFromClipboardItems(items)
      if (results.length === 0 || results.every((r) => r.types.length === 0)) {
        setError(
          `No readable types found. The Clipboard API only supports standard types (text/plain, text/html, image/png). Try pasting with ${isMac ? "⌘" : "Ctrl+"}V instead.`
        )
        setIsReading(false)
        return
      }
      revokeEntries(dataRef.current)
      setData(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read clipboard")
    } finally {
      setIsReading(false)
    }
  }, [isReading, isMac])

  // Paste / Drag-Drop listeners
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      // Don't intercept paste inside editable fields
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      if (!e.clipboardData) return
      setError(null)
      const result = await extractFromDataTransfer(
        e.clipboardData,
        "clipboardData"
      )
      revokeEntries(dataRef.current)
      setData([result])
    }

    const onDragEnter = (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current += 1
      if (dragCounter.current === 1) {
        setDragging(true)
      }
    }

    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const onDragLeave = (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current -= 1
      if (dragCounter.current <= 0) {
        dragCounter.current = 0
        setDragging(false)
      }
    }

    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      dragCounter.current = 0
      setDragging(false)
      if (!e.dataTransfer) return
      setError(null)
      const result = await extractFromDataTransfer(
        e.dataTransfer,
        "dataTransfer"
      )
      revokeEntries(dataRef.current)
      setData([result])
    }

    document.addEventListener("paste", onPaste)
    document.addEventListener("dragenter", onDragEnter)
    document.addEventListener("dragover", onDragOver)
    document.addEventListener("dragleave", onDragLeave)
    document.addEventListener("drop", onDrop)

    return () => {
      document.removeEventListener("paste", onPaste)
      document.removeEventListener("dragenter", onDragEnter)
      document.removeEventListener("dragover", onDragOver)
      document.removeEventListener("dragleave", onDragLeave)
      document.removeEventListener("drop", onDrop)

      if (copiedTimeoutRef.current) {
        clearTimeout(copiedTimeoutRef.current)
      }
      revokeEntries(dataRef.current)
    }
  }, [])

  const hasData = data.length > 0

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col gap-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo className="size-6" />
          <div>
            <h1 className="font-heading text-sm font-medium">Clipbodo</h1>
            <p className="text-[10px] text-muted-foreground">
              Inspect clipboard MIME types, items, and files
            </p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label={
              theme === "dark"
                ? "Switch to light theme"
                : "Switch to dark theme"
            }
          >
            {theme === "dark" ? <RiSunLine /> : <RiMoonLine />}
          </Button>
          {hasData && (
            <Button variant="ghost" size="sm" onClick={clear}>
              <RiArrowLeftLine data-icon="inline-start" />
              Clear
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={readClipboardApi}
            disabled={isReading}
            aria-busy={isReading}
          >
            {isReading ? (
              <RiLoader2Line
                data-icon="inline-start"
                className="animate-spin"
              />
            ) : (
              <RiClipboardLine data-icon="inline-start" />
            )}
            {isReading ? "Reading…" : "Read Clipboard"}
          </Button>
        </div>
      </div>

      {/* Error — aria-live so screen readers announce it */}
      <div aria-live="polite" aria-atomic="true" role="status">
        {error && (
          <p
            id={errorId}
            className="rounded border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive"
          >
            {error}
          </p>
        )}
      </div>

      {/* Empty state */}
      {!hasData && (
        <div
          role="region"
          aria-label="Clipboard drop zone"
          aria-dropeffect="copy"
          className={`flex flex-col items-center gap-3 border border-dashed py-16 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-border"}`}
        >
          <RiDragDropLine className="size-6 text-muted-foreground" />
          <div className="flex flex-col gap-1 text-xs text-muted-foreground">
            <p>
              Paste with{" "}
              <kbd className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                {modKey}
              </kbd>
              {" + "}
              <kbd className="border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground">
                V
              </kbd>{" "}
              or drop something here
            </p>
            <p>
              or click{" "}
              <span className="font-medium text-foreground">
                Read Clipboard
              </span>{" "}
              to use the Clipboard API
            </p>
          </div>
        </div>
      )}

      {/* Results */}
      {data.map((entry) => (
        <div key={entry.id} className="flex flex-col gap-3">
          <p className="font-mono text-[10px] text-muted-foreground">
            source: event.{entry.source}
          </p>

          {/* Types section */}
          {entry.types.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium">.types</span>
                <span className="text-[10px] text-muted-foreground">
                  {entry.types.length} type(s)
                </span>
              </div>

              {entry.types.map((t) => (
                <div key={t.id} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {t.type}
                    </span>
                    {typeof t.data === "string" && t.data && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => copyAsText(t.data as string, t.type)}
                        aria-label={`Copy ${t.type} as text`}
                      >
                        {copiedType === t.type ? (
                          <RiCheckLine data-icon="inline-start" />
                        ) : (
                          <RiFileCopyLine data-icon="inline-start" />
                        )}
                        {copiedType === t.type ? "Copied" : "Copy as text"}
                      </Button>
                    )}
                  </div>
                  {typeof t.data === "string" ? (
                    t.data ? (
                      <pre
                        className="max-h-64 min-w-0 overflow-auto border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground"
                        tabIndex={0}
                        role="region"
                        aria-label={`Content for ${t.type}`}
                      >
                        {t.data}
                      </pre>
                    ) : (
                      <p className="px-3 py-2 text-xs text-muted-foreground italic">
                        Empty string
                      </p>
                    )
                  ) : t.data ? (
                    <div className="border border-border p-3">
                      {t.data.type.startsWith("image/") ? (
                        <a
                          href={t.data.url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${t.data.name} in new tab`}
                        >
                          <img
                            src={t.data.url}
                            alt={`Clipboard image: ${t.data.name}`}
                            className="max-h-64 object-contain"
                            loading="lazy"
                          />
                        </a>
                      ) : (
                        <p className="font-mono text-xs text-muted-foreground">
                          {t.data.name} — {t.data.size} bytes
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* Items section */}
          {entry.items && entry.items.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium">.items</span>
                <span className="text-[10px] text-muted-foreground">
                  {entry.items.length} item(s)
                </span>
              </div>

              {entry.items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-1.5 border border-border p-3"
                >
                  <div className="flex gap-3 font-mono text-[10px] text-muted-foreground">
                    <span>kind: {item.kind}</span>
                    <span>type: {item.type}</span>
                  </div>
                  {typeof item.value === "string" ? (
                    item.value ? (
                      <pre
                        className="max-h-48 min-w-0 overflow-auto bg-muted/50 p-2 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground"
                        tabIndex={0}
                        role="region"
                        aria-label={`Item content for ${item.type}`}
                      >
                        {item.value}
                      </pre>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Empty string
                      </p>
                    )
                  ) : item.value ? (
                    item.value.type.startsWith("image/") ? (
                      <a
                        href={item.value.url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label={`Open ${item.value.name} in new tab`}
                      >
                        <img
                          src={item.value.url}
                          alt={`Clipboard image: ${item.value.name}`}
                          className="max-h-48 object-contain"
                          loading="lazy"
                        />
                      </a>
                    ) : (
                      <p className="font-mono text-xs text-muted-foreground">
                        {item.value.name} — {item.value.size} bytes
                      </p>
                    )
                  ) : null}
                </div>
              ))}
            </div>
          )}

          {/* Files section */}
          {entry.files && entry.files.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-medium">.files</span>
                <span className="text-[10px] text-muted-foreground">
                  {entry.files.length} file(s)
                </span>
              </div>

              {entry.files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 border border-border p-3"
                >
                  {file.info.type.startsWith("image/") ? (
                    <a
                      href={file.info.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${file.info.name} in new tab`}
                    >
                      <img
                        src={file.info.url}
                        alt={`Dropped image: ${file.info.name}`}
                        className="max-h-32 object-contain"
                        loading="lazy"
                      />
                    </a>
                  ) : null}
                  <div className="font-mono text-xs text-muted-foreground">
                    <p>{file.info.name}</p>
                    <p>
                      {file.info.size} bytes — {file.info.type}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
