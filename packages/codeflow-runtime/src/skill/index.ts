/**
 * Public barrel for the skill subsystem (Sprint S5 Phase E).
 *
 * Components live in this single subdir because they share a fcop-mcp
 * hard-dependency narrative — Phase E §0.5 + §0.7.5 + §3.6. Mirrors the
 * Phase D `src/review/` layout choice (decision K).
 */

export {
  SkillRegistry,
  type SkillRecord,
  type SkillToolSpec,
  type SkillProvider,
  type SkillRegistryOptions,
  type SkillRegistryLogger,
  type SkillSkippedEntry,
} from "./SkillRegistry.ts";

export {
  KernelDependencyValidator,
  FCOP_KERNEL_PATTERN,
  type KernelDependencyValidatorOptions,
  type KernelDependencyValidatorLogger,
  type ValidationFailure,
} from "./KernelDependencyValidator.ts";

export {
  MCPInjector,
  type MCPInjectorOptions,
  type MCPInjectorLogger,
  type MCPMount,
} from "./MCPInjector.ts";
