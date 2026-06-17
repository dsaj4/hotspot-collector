type Command =
  | "collect:subscriptions"
  | "collect:official-accounts"
  | "collect:wechat"
  | "video:intake-bilibili"
  | "video:notes-bilibili"
  | "video:notes-bilibili-list"
  | "video:intake-bilibili-latest"
  | "video:setup-bilisum"
  | "video:bilisum-status"
  | "collect:hotspots"
  | "collect:all"
  | "schedule:plan"
  | "schedule:run"
  | "secrets:set"
  | "secrets:status"
  | "secrets:delete"
  | "browser:login"
  | "browser:cdp"
  | "browser:status"
  | "browser:clear"
  | "social:ingest"
  | "social:fallback"
  | "feed:generate"
  | "source:detect"
  | "source:template"
  | "validate:fixtures"
  | "materials:generate"
  | "sync:content-system"
  | "report:daily"
  | "material:intake-link"
  | "material:export-source-items"
  | "material:digest-sources"
  | "material:aggregate-cards"
  | "material:process"
  | "material:run"
  | "material:config-status"
  | "workflow:hotspots"
  | "workflow:subscriptions"
  | "material:from-link";

function printJson(value: unknown): void {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function printText(value: string): void {
  process.stdout.write(`${value.trimEnd()}\n`);
}

function isHelpRequested(): boolean {
  return process.argv.includes("--help") || process.argv.includes("-h");
}

function printOfficialAccountsHelp(command: "collect:official-accounts" | "collect:wechat"): void {
  printText(`
Usage: npm.cmd run ${command}

Collect official-account subscriptions from the configured local WeWe RSS service.

The command writes raw snapshots, normalized subscription records, and source health
under HOTSPOT_DATA_ROOT. If the local WeWe RSS service is unavailable, it exits
cleanly with source health marked unavailable and emits no fake articles.
`);
}

function readOption(name: string): string | undefined {
  const prefix = `--${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefix));
  return match ? match.slice(prefix.length) : undefined;
}

function parsePositiveIntegerOption(value: string | undefined): number | undefined {
  if (value === undefined) return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function requiredOption(name: string): string {
  const value = readOption(name);
  if (!value) throw new Error(`--${name}=... is required.`);
  return value;
}

function readCollectMode(value: string | undefined): "skip" | "hotspots" | "subscriptions" | "all" {
  if (value === "hotspots" || value === "subscriptions" || value === "all" || value === "skip") return value;
  return "skip";
}

function readWorkflowStage(value: string | undefined): "collect" | "digest" | "material" {
  if (value === "digest" || value === "material" || value === "collect") return value;
  return "collect";
}

function readNoteModes(): string[] | undefined {
  const single = readOption("note-mode");
  const multiple = readOption("note-modes");
  const raw = single ?? multiple;
  if (!raw) return undefined;
  const values = raw.split(",").map((item) => item.trim()).filter(Boolean);
  return values.length ? values : undefined;
}

async function main(): Promise<void> {
  const command = process.argv[2] as Command | undefined;

  if (command === "collect:subscriptions") {
    const { collectSubscriptions } = await import("../collection/subscriptions/collect.js");
    printJson(await collectSubscriptions());
    return;
  }

  if (command === "collect:official-accounts" || command === "collect:wechat") {
    if (isHelpRequested()) {
      printOfficialAccountsHelp(command);
      return;
    }
    const { collectOfficialAccountSubscriptions } = await import("../collection/subscriptions/collect.js");
    printJson(await collectOfficialAccountSubscriptions());
    return;
  }

  if (command === "video:intake-bilibili") {
    const { intakeBilibiliVideo } = await import("../video-notes/bilibili.js");
    printJson(
      await intakeBilibiliVideo({
        url: requiredOption("url"),
        title: readOption("title"),
        sourceKind: (readOption("source-kind") as never) ?? "temporary-link",
        noteModes: readNoteModes(),
        primaryNoteMode: readOption("primary-note-mode")
      })
    );
    return;
  }

  if (command === "video:notes-bilibili") {
    const { intakeBilibiliVideo } = await import("../video-notes/bilibili.js");
    printJson(
      await intakeBilibiliVideo({
        url: requiredOption("url"),
        title: readOption("title"),
        sourceKind: "temporary-link",
        noteModes: readNoteModes(),
        primaryNoteMode: readOption("primary-note-mode"),
        publishToMaterialHub: false
      })
    );
    return;
  }

  if (command === "video:notes-bilibili-list") {
    const { intakeBilibiliVideoList } = await import("../video-notes/bilibili.js");
    printJson(
      await intakeBilibiliVideoList({
        inputPath: requiredOption("input"),
        limit: parsePositiveIntegerOption(readOption("limit")),
        publishToMaterialHub: false
      })
    );
    return;
  }

  if (command === "video:intake-bilibili-latest") {
    const { intakeLatestBilibiliVideos } = await import("../video-notes/bilibili.js");
    printJson(await intakeLatestBilibiliVideos({ limit: parsePositiveIntegerOption(readOption("max-items")) }));
    return;
  }

  if (command === "video:setup-bilisum") {
    const { setupBiliSum } = await import("../integrations/bilisum/setup.js");
    printJson(
      await setupBiliSum({
        projectRoot: readOption("project-root"),
        baseUrl: readOption("base-url"),
        start: readOption("start") !== "false",
        waitMs: parsePositiveIntegerOption(readOption("wait-ms"))
      })
    );
    return;
  }

  if (command === "video:bilisum-status") {
    const { bilisumSetupStatus } = await import("../integrations/bilisum/setup.js");
    printJson(await bilisumSetupStatus());
    return;
  }

  if (command === "collect:hotspots") {
    const { collectHotspots } = await import("../collection/hotspots/collect.js");
    printJson(await collectHotspots());
    return;
  }

  if (command === "collect:all") {
    const { collectSubscriptions } = await import("../collection/subscriptions/collect.js");
    const { collectHotspots } = await import("../collection/hotspots/collect.js");
    const subscriptions = await collectSubscriptions();
    const hotspots = await collectHotspots();
    printJson({ subscriptions, hotspots });
    return;
  }

  if (command === "schedule:plan") {
    const { schedulerPlan } = await import("../scheduler/run.js");
    printJson(await schedulerPlan());
    return;
  }

  if (command === "schedule:run") {
    const { schedulerRunDue } = await import("../scheduler/run.js");
    const { isTaskId } = await import("../scheduler/tasks.js");
    const taskId = readOption("task");
    printJson(
      await schedulerRunDue({
        taskId: isTaskId(taskId) ? taskId : undefined,
        maxTasks: parsePositiveIntegerOption(readOption("max-tasks"))
      })
    );
    return;
  }

  if (command === "secrets:set") {
    const { saveSecret } = await import("../core/secrets.js");
    const type = requiredOption("type");
    if (type !== "cookie" && type !== "token" && type !== "note") throw new Error("--type must be cookie, token, or note.");
    printJson(await saveSecret({ platform: requiredOption("platform"), type, value: requiredOption("value") }));
    return;
  }

  if (command === "secrets:status") {
    const { secretStatuses } = await import("../core/secrets.js");
    printJson(await secretStatuses());
    return;
  }

  if (command === "secrets:delete") {
    const { deleteSecret } = await import("../core/secrets.js");
    printJson(await deleteSecret(requiredOption("platform")));
    return;
  }

  if (command === "browser:login") {
    const { openBrowserLogin } = await import("../core/browser-session.js");
    printJson(
      await openBrowserLogin({
        platform: requiredOption("platform"),
        loginUrl: readOption("url"),
        browserPath: readOption("browser")
      })
    );
    return;
  }

  if (command === "browser:cdp") {
    const { openBrowserCdp } = await import("../core/browser-session.js");
    printJson(
      await openBrowserCdp({
        platform: requiredOption("platform"),
        port: parsePositiveIntegerOption(readOption("port")),
        url: readOption("url"),
        browserPath: readOption("browser")
      })
    );
    return;
  }

  if (command === "browser:status") {
    const { browserSessionStatus } = await import("../core/browser-session.js");
    printJson(await browserSessionStatus(requiredOption("platform")));
    return;
  }

  if (command === "browser:clear") {
    const { clearBrowserSession } = await import("../core/browser-session.js");
    printJson(await clearBrowserSession(requiredOption("platform")));
    return;
  }

  if (command === "social:ingest") {
    const { ingestBrowserObservationFile } = await import("../collection/social/ingest.js");
    printJson(await ingestBrowserObservationFile(requiredOption("input")));
    return;
  }

  if (command === "social:fallback") {
    const { runSocialFallback } = await import("../collection/social/fallback.js");
    const stream = requiredOption("stream");
    if (!["subscription", "search", "favorite", "hotspot", "home-feed"].includes(stream)) throw new Error("--stream must be a known social stream.");
    printJson(await runSocialFallback(requiredOption("source"), stream as never));
    return;
  }

  if (command === "feed:generate") {
    const { generateFeeds, isFeedKind } = await import("../reporting/feeds/generate.js");
    const kind = readOption("kind");
    printJson(await generateFeeds(isFeedKind(kind) ? kind : undefined));
    return;
  }

  if (command === "source:detect" || command === "source:template") {
    const { detectSource } = await import("../sources/detect.js");
    const inputUrl = process.argv[3];
    if (!inputUrl) throw new Error(`${command} requires a URL argument.`);
    const detected = detectSource(inputUrl);
    printJson(command === "source:template" ? detected.source : detected);
    return;
  }

  if (command === "validate:fixtures") {
    const { validateFixtures } = await import("../validation/fixtures.js");
    const result = await validateFixtures();
    printJson(result);
    if (!result.ok) process.exitCode = 1;
    return;
  }

  if (command === "report:daily") {
    const { generateDailyReport } = await import("../reporting/daily.js");
    printJson(await generateDailyReport());
    return;
  }

  if (command === "materials:generate") {
    const { generateMaterialCards } = await import("../material-hub/export/generate.js");
    printJson(await generateMaterialCards());
    return;
  }

  if (command === "sync:content-system") {
    const { syncLatestContentSystemAssets } = await import("../material-hub/export/sync-content-system.js");
    printJson(await syncLatestContentSystemAssets(process.argv[3]));
    return;
  }

  if (command === "material:intake-link") {
    const { intakeTemporaryLink } = await import("../material-hub/link-intake.js");
    const inputUrl = process.argv[3];
    if (!inputUrl) throw new Error("material:intake-link requires a URL argument.");
    printJson(await intakeTemporaryLink(inputUrl));
    return;
  }

  if (command === "material:export-source-items") {
    const { exportNormalizedSourceItems } = await import("../material-hub/export-source-items.js");
    printJson(await exportNormalizedSourceItems({ day: readOption("day") }));
    return;
  }

  if (command === "material:digest-sources") {
    const { digestSources } = await import("../material-hub/digest.js");
    printJson(
      await digestSources({
        day: readOption("day"),
        limit: parsePositiveIntegerOption(readOption("limit")),
        sourceItemsPath: readOption("source-items"),
        mode: readOption("mode") as never
      })
    );
    return;
  }

  if (command === "material:aggregate-cards") {
    const { aggregateMaterialCards } = await import("../material-hub/aggregate.js");
    printJson(
      await aggregateMaterialCards({
        day: readOption("day"),
        limit: parsePositiveIntegerOption(readOption("limit")),
        digestPath: readOption("digests"),
        template: readOption("template") as never,
        mode: readOption("mode") as never
      })
    );
    return;
  }

  if (command === "material:process") {
    const { processMaterialRecords } = await import("../material-hub/processing.js");
    printJson(
      await processMaterialRecords({
        day: readOption("day"),
        limit: parsePositiveIntegerOption(readOption("limit")),
        type: readOption("type") as never
      })
    );
    return;
  }

  if (command === "material:run") {
    const { runMaterialPipeline } = await import("../material-hub/pipeline.js");
    printJson(
      await runMaterialPipeline({
        collect: readCollectMode(readOption("collect")),
        day: readOption("day"),
        limit: parsePositiveIntegerOption(readOption("limit"))
      })
    );
    return;
  }

  if (command === "material:config-status") {
    const { materialHubConfigStatus } = await import("../material-hub/config-status.js");
    printJson(materialHubConfigStatus());
    return;
  }

  if (command === "workflow:hotspots" || command === "workflow:subscriptions") {
    const { runCollectionContentWorkflow } = await import("../workflows/content-workflows.js");
    printJson(await runCollectionContentWorkflow({
      kind: command === "workflow:hotspots" ? "hotspot" : "subscription",
      stage: readWorkflowStage(readOption("stage")),
      day: readOption("day"),
      limit: parsePositiveIntegerOption(readOption("limit")),
      template: readOption("template") as never,
      mode: readOption("mode") as never
    }));
    return;
  }

  if (command === "material:from-link") {
    const { createMaterialFromLink } = await import("../workflows/content-workflows.js");
    printJson(await createMaterialFromLink({
      url: requiredOption("url"),
      title: readOption("title"),
      contentFile: readOption("content-file"),
      limit: parsePositiveIntegerOption(readOption("limit")),
      template: readOption("template") as never,
      mode: readOption("mode") as never
    }));
    return;
  }

  throw new Error(`Unknown command: ${command ?? "(missing)"}`);
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
