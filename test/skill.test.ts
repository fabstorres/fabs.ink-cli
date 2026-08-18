import { afterEach, describe, expect, test } from "bun:test"
import { exists, mkdir, mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { BunContext } from "@effect/platform-bun"
import { Effect } from "effect"

import {
  installSkill,
  resolveSkillDestinations,
  SKILL_NAME,
  uninstallSkill,
} from "../src/skill.ts"

const temporaryDirectories: Array<string> = []

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

const run = <A, E>(effect: Effect.Effect<A, E, BunContext.BunContext>) =>
  Effect.runPromise(effect.pipe(Effect.provide(BunContext.layer)))

describe("Ink skill", () => {
  test("uses one shared project destination for compatible providers", () => {
    expect(
      resolveSkillDestinations(
        "project",
        ["codex", "cursor", "gemini-cli", "github-copilot"],
        { cwd: "/work/project", home: "/users/fabiola" },
      ),
    ).toEqual([
      join("/work/project", ".agents", "skills", SKILL_NAME, "SKILL.md"),
    ])
  })

  test("installs the bundled skill into every selected global provider", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fabs-ink-skill-"))
    temporaryDirectories.push(directory)
    const roots = {
      cwd: join(directory, "project"),
      home: join(directory, "home"),
    }

    const destinations = await run(
      installSkill("global", ["claude-code", "codex"], roots),
    )

    expect(destinations).toEqual([
      join(roots.home, ".claude", "skills", SKILL_NAME, "SKILL.md"),
      join(roots.home, ".codex", "skills", SKILL_NAME, "SKILL.md"),
    ])
    for (const destination of destinations) {
      expect(await readFile(destination, "utf8")).toContain(
        "name: ink",
      )
    }
  })

  test("uninstall removes config and global skills but leaves project skills", async () => {
    const directory = await mkdtemp(join(tmpdir(), "fabs-ink-skill-"))
    temporaryDirectories.push(directory)
    const roots = {
      cwd: join(directory, "project"),
      home: join(directory, "home"),
    }
    const configPath = join(roots.home, ".fabs.ink", "config.json")
    await mkdir(join(roots.home, ".fabs.ink"), { recursive: true })
    await Bun.write(configPath, '{"version":1,"profiles":{}}\n')
    const [globalSkill] = await run(installSkill("global", ["codex"], roots))
    const [projectSkill] = await run(installSkill("project", ["codex"], roots))

    const result = await run(uninstallSkill(configPath, roots.home))

    expect(result).toEqual({
      configRemoved: true,
      skillFiles: [globalSkill],
    })
    expect(await exists(configPath)).toBeFalse()
    expect(await exists(globalSkill)).toBeFalse()
    expect(await exists(projectSkill)).toBeTrue()
  })
})
