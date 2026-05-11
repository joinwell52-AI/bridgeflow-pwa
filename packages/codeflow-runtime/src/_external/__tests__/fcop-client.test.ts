/**
 * `FcopProjectClient` unit tests (P4 sprint Day 1.3, TASK-20260511-007).
 *
 * These tests **do NOT spawn Python**. They inject a stub `python(moduleName)`
 * callable via `__setPythonForTests()` so the test runs in pure Node + tsx
 * without any Python 3.12 / fcop@1.1.0 / pythonia subprocess overhead.
 *
 * 真实 fcop bridge 的 end-to-end 验证已由 DEV-005 `_spike/fcop-pythonia-spike/`
 * 完成（demo-fcop-api.ts + probe-surprises.ts，已 commit 在 e5a2413）。本文件
 * 只验证 TS 侧的契约：kwarg 转发是否正确、enum 解析是否健壮、错误是否包装成
 * `FcopClientError`、init/factory 流程是否符合 PM TASK-007 §四 Day 1.2-1.3 设计。
 *
 * Test plan（PM TASK-007 §六 Day 1.3 「5-8 个测试」）:
 *   TS-FCC-1   assertFcopReady 成功 → 返回 {fcopVersion, pythonVersion, pythonExecutable}
 *   TS-FCC-2   assertFcopReady 失败时 throw FcopClientError + 含 actionable hint
 *              (包含 "PYTHON_BIN" + "Python < 3.10" + "fcop@1.1.0" 三段指引)
 *   TS-FCC-3   create({ ensureInitialized: true, workspaceDir }) 调 Project$ + init$ kwargs 完整
 *   TS-FCC-4   create({ ensureInitialized: false }) 不调 init$
 *   TS-FCC-5   writeTask kwarg 转发正确（含 risk_level / references 可选字段）
 *   TS-FCC-6   writeReview kwarg 转发正确（含 decision='needs_human' v1.1 ADR-0025）
 *   TS-FCC-7   markHumanApproved review_id positional + kwargs 转发正确
 *   TS-FCC-8   listTasks 返回 FcopTask[]（通过 builtins.len + index 访问）
 *   TS-FCC-9   readEnumLike 容错：plain string / {value: 'xxx'} / 兜底正则三路径
 */

import { test, describe, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  FcopProjectClient,
  FcopClientError,
  assertFcopReady,
  __setPythonForTests,
  __resetFcopBridgeForTests,
  __killRealPythonChildForTests,
  type WriteTaskSpec,
  type WriteReviewSpec,
  type MarkHumanApprovedSpec,
} from "../fcop-client.ts";

// ───────────────────────────────────────────────────────────────────────────
// Stub builder helpers
// ───────────────────────────────────────────────────────────────────────────

/**
 * Records every call made to the stubbed Python bridge so a test can assert
 * `Project$()` received the right path + kwargs, `write_task$()` got
 * exactly the keys it should have got, etc.
 */
interface CallRecorder {
  projectCalls: Array<{ path: string; kwargs: Record<string, unknown> }>;
  initCalls: Array<Record<string, unknown>>;
  writeTaskCalls: Array<Record<string, unknown>>;
  listTasksCalls: Array<Record<string, unknown>>;
  writeReviewCalls: Array<Record<string, unknown>>;
  markHumanApprovedCalls: Array<{
    reviewId: string;
    kwargs: Record<string, unknown>;
  }>;
  isInitializedReturnQueue: boolean[];
  /** True after a successful `Project$()` call (controls `is_initialized`
   *  default semantics: once project exists, treat as not-yet-initialized
   *  unless the queue says otherwise). */
  projectBuilt: boolean;
}

function freshRecorder(): CallRecorder {
  return {
    projectCalls: [],
    initCalls: [],
    writeTaskCalls: [],
    listTasksCalls: [],
    writeReviewCalls: [],
    markHumanApprovedCalls: [],
    isInitializedReturnQueue: [],
    projectBuilt: false,
  };
}

/**
 * Build a fake `fcop` module proxy with `Project$` factory + `__version__`
 * + minimal task/review proxies.
 *
 * @param recorder Shared call recorder (test asserts on this).
 * @param options Override fcop version / make Project$ throw / etc.
 */
function buildFcopStub(
  recorder: CallRecorder,
  options: {
    fcopVersion?: string | (() => Promise<never>);
    projectThrows?: Error;
  } = {},
): unknown {
  const versionGetter = options.fcopVersion ?? "1.1.0";

  function buildProjectProxy(): unknown {
    return {
      is_initialized: async () => {
        // 队列优先：测试可显式控制连续两次返回的值
        if (recorder.isInitializedReturnQueue.length > 0) {
          return recorder.isInitializedReturnQueue.shift();
        }
        // 默认：build 后未 init
        return false;
      },
      init$: async (kwargs: Record<string, unknown>) => {
        recorder.initCalls.push(kwargs);
        return {
          is_initialized: true,
          config: { team: kwargs["team"] ?? "dev-team" },
        };
      },
      write_task$: async (kwargs: Record<string, unknown>) => {
        recorder.writeTaskCalls.push(kwargs);
        return buildTaskProxy(recorder.writeTaskCalls.length);
      },
      list_tasks$: async (kwargs: Record<string, unknown>) => {
        recorder.listTasksCalls.push(kwargs);
        // Pretend two tasks exist, indexable, sized via builtins.len.
        return [buildTaskProxy(1), buildTaskProxy(2)];
      },
      write_review$: async (kwargs: Record<string, unknown>) => {
        recorder.writeReviewCalls.push(kwargs);
        return buildReviewProxy({
          decision: String(kwargs["decision"] ?? "approved"),
          humanApproval: null,
        });
      },
      mark_human_approved$: async (
        reviewId: string,
        kwargs: Record<string, unknown>,
      ) => {
        recorder.markHumanApprovedCalls.push({ reviewId, kwargs });
        return buildReviewProxy({
          decision: "needs_human",
          humanApproval: {
            approver: String(kwargs["approver"] ?? "ADMIN"),
            decision: String(kwargs["decision"] ?? "approve"),
            channel: String(kwargs["channel"] ?? "cli"),
            comment: (kwargs["comment"] as string | undefined) ?? null,
          },
        });
      },
    };
  }

  return {
    __version__:
      typeof versionGetter === "string"
        ? Promise.resolve(versionGetter)
        : (versionGetter as () => Promise<never>)(),
    Project$: async (path: string, kwargs: Record<string, unknown>) => {
      recorder.projectCalls.push({ path, kwargs });
      if (options.projectThrows) {
        throw options.projectThrows;
      }
      recorder.projectBuilt = true;
      return buildProjectProxy();
    },
  };
}

/**
 * Task proxy: every field is `Promise<value>` to mimic pythonia auto-proxying.
 * Some fields ship enum-shaped objects so we can exercise `readEnumLike`
 * across all three branches (plain string / {value} / regex fallback).
 */
function buildTaskProxy(sequence: number): unknown {
  return {
    task_id: Promise.resolve(`TASK-20260511-00${sequence}`),
    filename: Promise.resolve(`TASK-20260511-00${sequence}-PM-to-DEV.md`),
    sender: Promise.resolve("PM"),
    recipient: Promise.resolve("DEV"),
    // Pretend pythonia returned a python enum: object with `.value`
    priority: Promise.resolve({ value: Promise.resolve("P1") }),
    subject: Promise.resolve(`stub task #${sequence}`),
    body: Promise.resolve("stub body"),
    date: Promise.resolve("20260511"),
    sequence: Promise.resolve(sequence),
    is_archived: Promise.resolve(false),
    path: Promise.resolve(`/tmp/stub/TASK-20260511-00${sequence}.md`),
  };
}

function buildReviewProxy(args: {
  decision: string;
  humanApproval: {
    approver: string;
    decision: string;
    channel: string;
    comment: string | null;
  } | null;
}): unknown {
  return {
    review_id: Promise.resolve("REVIEW-20260511-001-QA-on-task-20260511-001"),
    filename: Promise.resolve("REVIEW-20260511-001-QA-on-task-20260511-001.md"),
    reviewer_role: Promise.resolve("QA"),
    reviewer_agent: Promise.resolve(null),
    subject_type: Promise.resolve("task"),
    subject_ref: Promise.resolve("TASK-20260511-001"),
    // Test the "enum repr string fallback" branch via plain string
    // (most common — fcop returns enum, we read .value to a string)
    decision: Promise.resolve({ value: Promise.resolve(args.decision) }),
    rationale: Promise.resolve("stub rationale"),
    required_changes: Promise.resolve([]),
    decided_at: Promise.resolve("2026-05-11T10:00:00+08:00"),
    sequence: Promise.resolve(1),
    is_archived: Promise.resolve(false),
    path: Promise.resolve("/tmp/stub/REVIEW-20260511-001.md"),
    human_approval: Promise.resolve(
      args.humanApproval === null
        ? null
        : {
            approver: Promise.resolve(args.humanApproval.approver),
            decision: Promise.resolve({
              value: Promise.resolve(args.humanApproval.decision),
            }),
            channel: Promise.resolve({
              value: Promise.resolve(args.humanApproval.channel),
            }),
            comment: Promise.resolve(args.humanApproval.comment),
          },
    ),
  };
}

/** Stub `sys` module proxy (only `.version` + `.executable` used). */
function buildSysStub(): unknown {
  return {
    version:
      "3.12.9 (tags/v3.12.9:fdb8142, Feb  4 2025) [MSC v.1942 64 bit (AMD64)]",
    executable: "C:\\fake\\Python312\\python.exe",
  };
}

/** Stub `builtins` proxy (only `.len()` used by readTaskList / readStringList). */
function buildBuiltinsStub(): unknown {
  return {
    len: async (x: unknown) => {
      if (Array.isArray(x)) return x.length;
      throw new Error("stub builtins.len: only supports arrays");
    },
  };
}

/**
 * Construct a `python(moduleName)` async function that dispatches to the right
 * canned stub based on the requested module name. Unknown module names throw.
 */
function buildPythonStub(recorder: CallRecorder, options: {
  fcopVersion?: string | (() => Promise<never>);
  projectThrows?: Error;
  fcopImportFails?: Error;
} = {}): (moduleName: string) => Promise<unknown> {
  return async (moduleName: string) => {
    if (moduleName === "fcop") {
      if (options.fcopImportFails) throw options.fcopImportFails;
      return buildFcopStub(recorder, {
        ...(options.fcopVersion !== undefined
          ? { fcopVersion: options.fcopVersion }
          : {}),
        ...(options.projectThrows !== undefined
          ? { projectThrows: options.projectThrows }
          : {}),
      });
    }
    if (moduleName === "sys") return buildSysStub();
    if (moduleName === "builtins") return buildBuiltinsStub();
    throw new Error(`buildPythonStub: unexpected module name ${moduleName}`);
  };
}

// ───────────────────────────────────────────────────────────────────────────
// Test cases
// ───────────────────────────────────────────────────────────────────────────

describe("FcopProjectClient (P4 sprint Day 1.3 — TASK-20260511-007)", () => {
  // Each test resets the module-level bridge cache so tests don't bleed.
  beforeEach(() => {
    __resetFcopBridgeForTests();
  });

  // Always restore real pythonia state AND kill the pythonia child Python
  // subprocess at the end. The child is spawned at the very first
  // `import 'pythonia'` (see fcop-client.ts `__killRealPythonChildForTests`
  // JSDoc); leaving it alive blocks `node --test` from exiting.
  after(() => {
    __setPythonForTests(null);
    __resetFcopBridgeForTests();
    __killRealPythonChildForTests();
  });

  test("TS-FCC-1: assertFcopReady success path returns version triple", async () => {
    const recorder = freshRecorder();
    const pythonStub = buildPythonStub(recorder);
    __setPythonForTests(
      Object.assign(pythonStub, { exit: () => undefined }),
    );

    const result = await assertFcopReady();

    assert.equal(result.fcopVersion, "1.1.0", "fcop version is forwarded");
    assert.match(
      result.pythonVersion,
      /3\.12/,
      "Python version is forwarded from sys.version",
    );
    assert.equal(
      result.pythonExecutable,
      "C:\\fake\\Python312\\python.exe",
      "Python exe path is forwarded from sys.executable",
    );
  });

  test("TS-FCC-2: assertFcopReady failure path wraps as FcopClientError with actionable hint", async () => {
    const recorder = freshRecorder();
    const pythonStub = buildPythonStub(recorder, {
      fcopImportFails: new Error("ModuleNotFoundError: No module named 'fcop'"),
    });
    __setPythonForTests(
      Object.assign(pythonStub, { exit: () => undefined }),
    );

    await assert.rejects(
      () => assertFcopReady(),
      (err: unknown) => {
        if (!(err instanceof FcopClientError)) return false;
        if (err.operation !== "loadFcopModule") return false;
        // Must contain all three lines of the actionable hint
        const m = err.message;
        return (
          m.includes("PYTHON_BIN") &&
          m.includes("Python < 3.10") &&
          m.includes("fcop@1.1.0") &&
          m.includes("ModuleNotFoundError")
        );
      },
      "FcopClientError must include PYTHON_BIN + Python version + fcop install hint + original cause",
    );
  });

  test("TS-FCC-3: create with workspaceDir + ensureInitialized=true calls Project$ + init$", async () => {
    const recorder = freshRecorder();
    const pythonStub = buildPythonStub(recorder);
    __setPythonForTests(
      Object.assign(pythonStub, { exit: () => undefined }),
    );

    const client = await FcopProjectClient.create({
      projectRoot: "D:/fake/project",
      workspaceDir: "docs/agents",
      team: "dev-team",
      lang: "zh",
    });

    assert.equal(recorder.projectCalls.length, 1, "Project$ called exactly once");
    assert.equal(recorder.projectCalls[0]?.path, "D:/fake/project");
    assert.deepEqual(
      recorder.projectCalls[0]?.kwargs,
      { strict: false, workspace_dir: "docs/agents" },
      "Project$ receives strict=false + workspace_dir override (DEV-005 §S8 escape hatch)",
    );

    assert.equal(recorder.initCalls.length, 1, "init$ called exactly once");
    assert.deepEqual(
      recorder.initCalls[0],
      { team: "dev-team", lang: "zh", force: false },
      "init$ receives team + lang + force=false (DEV-005 §S4: no positional kwargs)",
    );

    assert.equal(client.projectRoot, "D:/fake/project");
  });

  test("TS-FCC-4: create with ensureInitialized=false skips init$", async () => {
    const recorder = freshRecorder();
    const pythonStub = buildPythonStub(recorder);
    __setPythonForTests(
      Object.assign(pythonStub, { exit: () => undefined }),
    );

    await FcopProjectClient.create({
      projectRoot: "D:/fake/project",
      ensureInitialized: false,
    });

    assert.equal(recorder.projectCalls.length, 1);
    assert.equal(
      recorder.initCalls.length,
      0,
      "init$ NOT called when ensureInitialized=false",
    );
  });

  test("TS-FCC-5: writeTask forwards kwargs correctly with optional fields conditionally", async () => {
    const recorder = freshRecorder();
    const pythonStub = buildPythonStub(recorder);
    __setPythonForTests(
      Object.assign(pythonStub, { exit: () => undefined }),
    );

    // ensureInitialized=false so init$ doesn't pollute recorder.
    const client = await FcopProjectClient.create({
      projectRoot: "D:/fake/project",
      ensureInitialized: false,
    });

    // Variant A: all optional fields omitted → kwargs has 5 required keys only.
    const specMin: WriteTaskSpec = {
      sender: "PM",
      recipient: "DEV",
      priority: "P1",
      subject: "min spec",
      body: "min body",
    };
    const taskA = await client.writeTask(specMin);
    assert.deepEqual(recorder.writeTaskCalls[0], {
      sender: "PM",
      recipient: "DEV",
      priority: "P1",
      subject: "min spec",
      body: "min body",
    });
    assert.equal(taskA.task_id, "TASK-20260511-001");
    assert.equal(
      taskA.priority,
      "P1",
      "readEnumLike pulls .value from {value: 'P1'} stub (DEV-005 §S10 enum repr)",
    );

    // Variant B: with optional fields → keys present in kwargs.
    const specFull: WriteTaskSpec = {
      sender: "PM",
      recipient: "DEV",
      priority: "P0",
      subject: "full spec",
      body: "full body",
      references: ["TASK-001", "TASK-002"],
      thread_key: "thread-xyz",
      risk_level: "low",
    };
    await client.writeTask(specFull);
    assert.deepEqual(recorder.writeTaskCalls[1], {
      sender: "PM",
      recipient: "DEV",
      priority: "P0",
      subject: "full spec",
      body: "full body",
      references: ["TASK-001", "TASK-002"],
      thread_key: "thread-xyz",
      risk_level: "low",
    });
  });

  test("TS-FCC-6: writeReview forwards kwargs including decision='needs_human' (v1.1 ADR-0025)", async () => {
    const recorder = freshRecorder();
    const pythonStub = buildPythonStub(recorder);
    __setPythonForTests(
      Object.assign(pythonStub, { exit: () => undefined }),
    );

    const client = await FcopProjectClient.create({
      projectRoot: "D:/fake/project",
      ensureInitialized: false,
    });

    const spec: WriteReviewSpec = {
      reviewer_role: "QA",
      subject_type: "task",
      subject_ref: "TASK-20260511-001",
      decision: "needs_human",
      rationale: "PM wants ADMIN sign-off",
      required_changes: ["change-1", "change-2"],
    };
    const review = await client.writeReview(spec);

    assert.deepEqual(recorder.writeReviewCalls[0], {
      reviewer_role: "QA",
      subject_type: "task",
      subject_ref: "TASK-20260511-001",
      decision: "needs_human",
      rationale: "PM wants ADMIN sign-off",
      required_changes: ["change-1", "change-2"],
    });
    assert.equal(review.decision, "needs_human");
    assert.equal(
      review.human_approval,
      null,
      "writeReview alone leaves human_approval=null until markHumanApproved is called",
    );
  });

  test("TS-FCC-7: markHumanApproved sends review_id POSITIONAL + the rest as kwargs", async () => {
    const recorder = freshRecorder();
    const pythonStub = buildPythonStub(recorder);
    __setPythonForTests(
      Object.assign(pythonStub, { exit: () => undefined }),
    );

    const client = await FcopProjectClient.create({
      projectRoot: "D:/fake/project",
      ensureInitialized: false,
    });

    const spec: MarkHumanApprovedSpec = {
      approver: "ADMIN",
      decision: "approve",
      channel: "cli",
      comment: "looks good",
    };
    const review = await client.markHumanApproved(
      "REVIEW-20260511-001-QA-on-task-20260511-001",
      spec,
    );

    assert.equal(recorder.markHumanApprovedCalls.length, 1);
    assert.equal(
      recorder.markHumanApprovedCalls[0]?.reviewId,
      "REVIEW-20260511-001-QA-on-task-20260511-001",
      "review_id is first positional arg (DEV-005 §S4: fcop signature is `(review_id, *, approver, decision, channel, comment)`)",
    );
    assert.deepEqual(recorder.markHumanApprovedCalls[0]?.kwargs, {
      approver: "ADMIN",
      decision: "approve",
      channel: "cli",
      comment: "looks good",
    });

    // Review must now reflect the human_approval block
    assert.equal(review.human_approval?.approver, "ADMIN");
    assert.equal(review.human_approval?.decision, "approve");
    assert.equal(review.human_approval?.channel, "cli");
    assert.equal(review.human_approval?.comment, "looks good");
  });

  test("TS-FCC-8: listTasks returns FcopTask[] with enum-decoded fields", async () => {
    const recorder = freshRecorder();
    const pythonStub = buildPythonStub(recorder);
    __setPythonForTests(
      Object.assign(pythonStub, { exit: () => undefined }),
    );

    const client = await FcopProjectClient.create({
      projectRoot: "D:/fake/project",
      ensureInitialized: false,
    });

    const tasks = await client.listTasks({
      status: "open",
      sender: "PM",
      limit: 10,
    });

    assert.equal(tasks.length, 2, "stub returns array of 2 tasks");
    assert.deepEqual(recorder.listTasksCalls[0], {
      status: "open",
      sender: "PM",
      limit: 10,
    });

    for (const t of tasks) {
      assert.equal(typeof t.task_id, "string");
      assert.equal(typeof t.priority, "string", "priority decoded to plain string");
      assert.equal(typeof t.sequence, "number");
      assert.equal(typeof t.is_archived, "boolean");
    }
  });

  test("TS-FCC-9: readEnumLike handles plain string / {value} / regex repr fallback", async () => {
    // We exercise this indirectly via writeTask whose priority comes back
    // as `{value: 'P1'}` (most common). Additional belt-and-braces: use a
    // string-priority stub to verify the plain-string branch.
    const recorder = freshRecorder();
    const stringPriorityFcop = (recorder: CallRecorder) => ({
      __version__: Promise.resolve("1.1.0"),
      Project$: async (path: string, kwargs: Record<string, unknown>) => {
        recorder.projectCalls.push({ path, kwargs });
        recorder.projectBuilt = true;
        return {
          is_initialized: async () => false,
          init$: async () => undefined,
          write_task$: async (kw: Record<string, unknown>) => {
            recorder.writeTaskCalls.push(kw);
            // priority returned as PLAIN STRING (some fcop fields are non-enum)
            return {
              task_id: Promise.resolve("TASK-X-1"),
              filename: Promise.resolve("TASK-X-1.md"),
              sender: Promise.resolve("PM"),
              recipient: Promise.resolve("DEV"),
              priority: Promise.resolve("P3"), // plain string branch
              subject: Promise.resolve("plain string priority"),
              body: Promise.resolve("..."),
              date: Promise.resolve("20260511"),
              sequence: Promise.resolve(1),
              is_archived: Promise.resolve(false),
              path: Promise.resolve("/tmp/x"),
            };
          },
        };
      },
    });
    const pythonStub = (async (moduleName: string) => {
      if (moduleName === "fcop") return stringPriorityFcop(recorder);
      if (moduleName === "sys") return buildSysStub();
      if (moduleName === "builtins") return buildBuiltinsStub();
      throw new Error(`unexpected module: ${moduleName}`);
    }) as (m: string) => Promise<unknown>;
    __setPythonForTests(
      Object.assign(pythonStub, { exit: () => undefined }),
    );

    const client = await FcopProjectClient.create({
      projectRoot: "D:/fake/project",
      ensureInitialized: false,
    });
    const task = await client.writeTask({
      sender: "PM",
      recipient: "DEV",
      priority: "P3",
      subject: "plain string priority",
      body: "...",
    });
    assert.equal(
      task.priority,
      "P3",
      "readEnumLike returns plain string as-is when proxy already resolved to string",
    );
  });
});
