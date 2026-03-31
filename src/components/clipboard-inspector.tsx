import { useCallback, useEffect, useMemo, useState } from "react"
import {
  RiClipboardLine,
  RiFileCopyLine,
  RiCheckLine,
  RiArrowLeftLine,
  RiDragDropLine,
  RiSunLine,
  RiMoonLine,
} from "@remixicon/react"
import { Button } from "@/components/ui/button"
import { useTheme } from "@/components/theme-provider"
import { Logo } from "@/components/logo"

interface FileInfo {
  name: string
  size: number
  type: string
  url: string
}

interface TypeEntry {
  type: string
  data: string | FileInfo | null
}

interface ItemEntry {
  kind: string
  type: string
  value: string | FileInfo | null
}

interface ClipboardData {
  source: string
  types: TypeEntry[]
  items: ItemEntry[] | null
  files: FileInfo[] | null
}

function fileInfo(file: File | Blob | null): FileInfo | null {
  if (!file) return null
  return {
    name: file instanceof File ? file.name : "blob",
    size: file.size,
    type: file.type,
    url: URL.createObjectURL(file),
  }
}

async function extractFromDataTransfer(
  dt: DataTransfer,
  source: string
): Promise<ClipboardData> {
  const types: TypeEntry[] = Array.from(dt.types).map((type) => ({
    type,
    data: dt.getData(type),
  }))

  const items: ItemEntry[] | null = dt.items
    ? await Promise.all(
        Array.from(dt.items).map(async (item) => ({
          kind: item.kind,
          type: item.type,
          value:
            item.kind === "string"
              ? await new Promise<string>((r) => item.getAsString(r))
              : fileInfo(item.getAsFile()),
        }))
      )
    : null

  const files: FileInfo[] | null = dt.files
    ? Array.from(dt.files).map((f) => fileInfo(f)!)
    : null

  return { source, types, items, files }
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
      results.push({ source: "ClipboardItem", types, items: null, files: null })
    }
  }
  return results
}

export function ClipboardInspector() {
  const [data, setData] = useState<ClipboardData[]>([])
  const [error, setError] = useState<string | null>(null)
  const [copiedType, setCopiedType] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)

  const isMac = useMemo(
    () => /mac|iphone|ipad|ipod/i.test(navigator.userAgent),
    []
  )
  const modKey = isMac ? "⌘" : "Ctrl"
  const { theme, setTheme } = useTheme()

  const toggleTheme = useCallback(() => {
    setTheme(theme === "dark" ? "light" : theme === "light" ? "dark" : "light")
  }, [theme, setTheme])

  const clear = useCallback(() => {
    setData([])
    setError(null)
  }, [])

  const readClipboardApi = useCallback(async () => {
    try {
      setError(null)
      const items = await navigator.clipboard.read()
      const results = await extractFromClipboardItems(items)
      if (results.length === 0 || results.every((r) => r.types.length === 0)) {
        setError(
          `No readable types found. The Clipboard API only supports standard types (text/plain, text/html, image/png). Try pasting with ${isMac ? "⌘" : "Ctrl+"}V instead.`
        )
        return
      }
      setData(results)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to read clipboard")
    }
  }, [])

  const copyAsText = useCallback(async (text: string, type: string) => {
    await navigator.clipboard.writeText(text)
    setCopiedType(type)
    setTimeout(() => setCopiedType(null), 1500)
  }, [])

  // Paste event handler — captures ALL types via DataTransfer
  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      e.preventDefault()
      if (!e.clipboardData) return
      setError(null)
      const result = await extractFromDataTransfer(
        e.clipboardData,
        "clipboardData"
      )
      setData([result])
    }

    const onDragOver = (e: DragEvent) => {
      e.preventDefault()
      setDragging(true)
    }

    const onDragLeave = () => setDragging(false)

    const onDrop = async (e: DragEvent) => {
      e.preventDefault()
      setDragging(false)
      if (!e.dataTransfer) return
      setError(null)
      const result = await extractFromDataTransfer(
        e.dataTransfer,
        "dataTransfer"
      )
      setData([result])
    }

    document.addEventListener("paste", onPaste)
    document.addEventListener("dragover", onDragOver)
    document.addEventListener("dragleave", onDragLeave)
    document.addEventListener("drop", onDrop)
    return () => {
      document.removeEventListener("paste", onPaste)
      document.removeEventListener("dragover", onDragOver)
      document.removeEventListener("dragleave", onDragLeave)
      document.removeEventListener("drop", onDrop)
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
          <Button variant="ghost" size="icon-sm" onClick={toggleTheme}>
            {theme === "dark" ? <RiSunLine /> : <RiMoonLine />}
          </Button>
          {hasData && (
            <Button variant="ghost" size="sm" onClick={clear}>
              <RiArrowLeftLine data-icon="inline-start" />
              Clear
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={readClipboardApi}>
            <RiClipboardLine data-icon="inline-start" />
            Read Clipboard
          </Button>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* Empty state */}
      {!hasData && (
        <div
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
      {data.map((entry, idx) => (
        <div key={idx} className="flex flex-col gap-3">
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
                <div key={t.type} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between">
                    <span className="bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {t.type}
                    </span>
                    {typeof t.data === "string" && t.data && (
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => copyAsText(t.data as string, t.type)}
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
                      <pre className="max-h-64 min-w-0 overflow-auto border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground">
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
                        <a href={t.data.url} target="_blank" rel="noreferrer">
                          <img
                            src={t.data.url}
                            alt={t.data.name}
                            className="max-h-64 object-contain"
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

              {entry.items.map((item, i) => (
                <div
                  key={i}
                  className="flex flex-col gap-1.5 border border-border p-3"
                >
                  <div className="flex gap-3 font-mono text-[10px] text-muted-foreground">
                    <span>kind: {item.kind}</span>
                    <span>type: {item.type}</span>
                  </div>
                  {typeof item.value === "string" ? (
                    item.value ? (
                      <pre className="max-h-48 min-w-0 overflow-auto bg-muted/50 p-2 font-mono text-xs leading-relaxed break-words whitespace-pre-wrap text-foreground">
                        {item.value}
                      </pre>
                    ) : (
                      <p className="text-xs text-muted-foreground italic">
                        Empty string
                      </p>
                    )
                  ) : item.value ? (
                    item.value.type.startsWith("image/") ? (
                      <a href={item.value.url} target="_blank" rel="noreferrer">
                        <img
                          src={item.value.url}
                          alt={item.value.name}
                          className="max-h-48 object-contain"
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

              {entry.files.map((file, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border border-border p-3"
                >
                  {file.type.startsWith("image/") ? (
                    <a href={file.url} target="_blank" rel="noreferrer">
                      <img
                        src={file.url}
                        alt={file.name}
                        className="max-h-32 object-contain"
                      />
                    </a>
                  ) : null}
                  <div className="font-mono text-xs text-muted-foreground">
                    <p>{file.name}</p>
                    <p>
                      {file.size} bytes — {file.type}
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
