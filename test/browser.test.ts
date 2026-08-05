import { describe, expect, test } from "bun:test"

import { browserCommand } from "../src/browser.ts"

describe("browserCommand", () => {
  test("uses the native browser helper on each supported platform", () => {
    const url = "https://fabs.ink/auth?code=ABCD-EFGH"
    expect(browserCommand(url, "darwin")).toEqual(["open", url])
    expect(browserCommand(url, "linux")).toEqual(["xdg-open", url])
    expect(browserCommand(url, "win32")).toEqual([
      "rundll32.exe",
      "url.dll,FileProtocolHandler",
      url,
    ])
  })
})
