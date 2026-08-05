import { Effect } from "effect"

export const browserCommand = (
  url: string,
  platform: NodeJS.Platform = process.platform,
): Array<string> => {
  switch (platform) {
    case "darwin":
      return ["open", url]
    case "win32":
      return ["rundll32.exe", "url.dll,FileProtocolHandler", url]
    default:
      return ["xdg-open", url]
  }
}

/** Best-effort browser handoff. Headless and remote environments remain usable. */
export const openBrowserOptional = (url: string) =>
  Effect.sync(() => {
    try {
      const subprocess = Bun.spawn(browserCommand(url), {
        stdin: "ignore",
        stdout: "ignore",
        stderr: "ignore",
      })
      subprocess.unref()
    } catch {
      // The complete URL is already printed, so a missing browser helper is harmless.
    }
  })
