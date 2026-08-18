import { homedir } from "node:os"
import { dirname, join } from "node:path"

import { FileSystem } from "@effect/platform"
import { Effect } from "effect"

import { SkillInstallError } from "./domain.ts"

export const SKILL_NAME = "ink"

export type SkillScope = "global" | "project"

export type SkillProvider =
  | "claude-code"
  | "codex"
  | "cursor"
  | "gemini-cli"
  | "github-copilot"

export interface SkillProviderDefinition {
  readonly id: SkillProvider
  readonly name: string
  readonly projectDirectory: string
  readonly globalDirectory: string
}

export interface SkillRoots {
  readonly cwd: string
  readonly home: string
}

export interface UninstallResult {
  readonly configRemoved: boolean
  readonly skillFiles: ReadonlyArray<string>
}

// Keep provider paths explicit so install behavior stays easy to audit.
export const SKILL_PROVIDERS: ReadonlyArray<SkillProviderDefinition> = [
  {
    id: "claude-code",
    name: "Claude Code",
    projectDirectory: ".claude/skills",
    globalDirectory: ".claude/skills",
  },
  {
    id: "codex",
    name: "Codex",
    projectDirectory: ".agents/skills",
    globalDirectory: ".codex/skills",
  },
  {
    id: "cursor",
    name: "Cursor",
    projectDirectory: ".agents/skills",
    globalDirectory: ".cursor/skills",
  },
  {
    id: "gemini-cli",
    name: "Gemini CLI",
    projectDirectory: ".agents/skills",
    globalDirectory: ".gemini/skills",
  },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    projectDirectory: ".agents/skills",
    globalDirectory: ".copilot/skills",
  },
]

const providerById = new Map(
  SKILL_PROVIDERS.map((provider) => [provider.id, provider] as const),
)

const reasonOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause)

const bundledSkillPath = join(
  import.meta.dir,
  "..",
  "skills",
  SKILL_NAME,
  "SKILL.md",
)

// Resolve selected providers to unique destinations because project providers share .agents.
export const resolveSkillDestinations = (
  scope: SkillScope,
  providers: ReadonlyArray<SkillProvider>,
  roots: SkillRoots,
): Array<string> => {
  const destinations = providers.map((providerId) => {
    const provider = providerById.get(providerId)
    if (!provider) throw new Error(`Unknown skill provider: ${providerId}`)
    const root = scope === "global" ? roots.home : roots.cwd
    const directory =
      scope === "global" ? provider.globalDirectory : provider.projectDirectory
    return join(root, directory, SKILL_NAME, "SKILL.md")
  })

  return [...new Set(destinations)]
}

// Copy the bundled skill into every selected provider destination.
export const installSkill = (
  scope: SkillScope,
  providers: ReadonlyArray<SkillProvider>,
  roots: SkillRoots = { cwd: process.cwd(), home: homedir() },
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const destinations = resolveSkillDestinations(scope, providers, roots)
    if (destinations.length === 0) {
      return yield* new SkillInstallError({
        path: bundledSkillPath,
        reason: "select at least one provider",
      })
    }

    const contents = yield* fs.readFileString(bundledSkillPath).pipe(
      Effect.mapError(
        (cause) =>
          new SkillInstallError({
            path: bundledSkillPath,
            reason: reasonOf(cause),
          }),
      ),
    )

    for (const destination of destinations) {
      yield* fs.makeDirectory(dirname(destination), { recursive: true }).pipe(
        Effect.andThen(fs.writeFileString(destination, contents)),
        Effect.mapError(
          (cause) =>
            new SkillInstallError({ path: destination, reason: reasonOf(cause) }),
        ),
      )
    }

    return destinations
  })

// Remove only global skill files and the CLI config; project locations are unknowable later.
export const uninstallSkill = (
  configPath: string,
  home: string = homedir(),
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem
    const destinations = resolveSkillDestinations(
      "global",
      SKILL_PROVIDERS.map(({ id }) => id),
      { cwd: process.cwd(), home },
    )
    const removed: Array<string> = []

    for (const destination of destinations) {
      const exists = yield* fs.exists(destination).pipe(
        Effect.mapError(
          (cause) =>
            new SkillInstallError({ path: destination, reason: reasonOf(cause) }),
        ),
      )
      if (!exists) continue

      yield* fs.remove(destination).pipe(
        Effect.mapError(
          (cause) =>
            new SkillInstallError({ path: destination, reason: reasonOf(cause) }),
        ),
      )
      removed.push(destination)
    }

    const configExists = yield* fs.exists(configPath).pipe(
      Effect.mapError(
        (cause) =>
          new SkillInstallError({ path: configPath, reason: reasonOf(cause) }),
      ),
    )
    if (configExists) {
      yield* fs.remove(configPath).pipe(
        Effect.mapError(
          (cause) =>
            new SkillInstallError({ path: configPath, reason: reasonOf(cause) }),
        ),
      )
    }

    return {
      configRemoved: configExists,
      skillFiles: removed,
    } satisfies UninstallResult
  })
