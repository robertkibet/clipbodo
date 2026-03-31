import { RiGithubFill } from "@remixicon/react"
import { ClipboardInspector } from "@/components/clipboard-inspector"

export function App() {
  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <main className="min-h-0 flex-1 overflow-y-auto p-6">
        <ClipboardInspector />
      </main>
      <footer className="flex shrink-0 items-center justify-center gap-1.5 border-t border-border px-6 py-3 text-[10px] text-muted-foreground">
        <a
          href="https://github.com/robertkibet/clipbodo"
          target="_blank"
          rel="noreferrer"
          className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
        >
          <RiGithubFill className="size-4" />
          Clipbodo on GitHub
        </a>
      </footer>
    </div>
  )
}

export default App
