import fs from "node:fs";
import path from "node:path";

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  console.error("❌ GITHUB_TOKEN environment variable is required.");
  process.exit(1);
}

const TIER_CONFIGS = [
  {
    tier: 'all-time',
    target: 4000,
    windows: [
      { query: "is:public archived:false stars:>=50000", sort: "stars" },
      { query: "is:public archived:false stars:20000..49999", sort: "stars" },
      { query: "is:public archived:false stars:10000..19999", sort: "stars" },
      { query: "is:public archived:false stars:5000..9999", sort: "stars" },
      { query: "is:public archived:false stars:2000..4999", sort: "stars" },
    ]
  },
  {
    tier: 'yearly',
    target: 2000,
    windows: [
      { query: `is:public archived:false pushed:>=${daysAgoIso(365)} stars:>=500`, sort: "updated" }
    ]
  },
  {
    tier: '6-month',
    target: 800,
    windows: [
      { query: `is:public archived:false pushed:>=${daysAgoIso(180)} stars:>=200`, sort: "updated" }
    ]
  },
  {
    tier: 'monthly',
    target: 500,
    windows: [
      { query: `is:public archived:false pushed:>=${daysAgoIso(30)} stars:>=100`, sort: "updated" }
    ]
  },
  {
    tier: 'weekly',
    target: 300,
    windows: [
      { query: `is:public archived:false pushed:>=${daysAgoIso(7)} stars:>=50`, sort: "updated" }
    ]
  }
];

function daysAgoIso(days) {
  const date = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return date.toISOString().slice(0, 10);
}

const SLEEP_MS = 1000;
const PER_PAGE = 100;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchPage(query, sort, page) {
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", query);
  url.searchParams.set("sort", sort);
  url.searchParams.set("order", "desc");
  url.searchParams.set("per_page", String(PER_PAGE));
  url.searchParams.set("page", String(page));

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "RepoMind-Tiered-Catalog",
    },
  });

  if (response.status === 403) {
    const reset = response.headers.get("x-ratelimit-reset");
    const waitMs = reset ? Math.max(0, (Number(reset) * 1000) - Date.now()) : 60000;
    console.warn(`⏳ Rate limited. Waiting ${Math.ceil(waitMs / 1000)}s...`);
    await sleep(waitMs + 1000);
    return fetchPage(query, sort, page);
  }

  if (!response.ok) {
    throw new Error(`GitHub API error ${response.status}: ${response.statusText}`);
  }

  const payload = await response.json();
  return payload.items || [];
}

function normalizeRepo(repo, tier, rank) {
  return {
    owner: repo?.owner?.login ?? "",
    repo: repo?.name ?? "",
    stars: Number(repo?.stargazers_count ?? 0),
    description: typeof repo?.description === "string" ? repo.description : null,
    topics: Array.isArray(repo?.topics) ? repo.topics : [],
    language: repo?.language ?? null,
    tier,
    rank
  };
}

async function run() {
  const collected = [];
  const seen = new Set();
  let globalRank = 1;

  console.log("🚀 Starting Tiered Repository Catalog Fetch...");

  for (const config of TIER_CONFIGS) {
    console.log(`\n📦 Tier: ${config.tier} (Target: ${config.target})`);
    let tierCollectedCount = 0;

    for (const window of config.windows) {
      if (tierCollectedCount >= config.target) break;

      for (let page = 1; page <= 10; page++) { // GitHub search limit is 1000 results (10 pages)
        if (tierCollectedCount >= config.target) break;

        console.log(`   🔍 Fetching ${config.tier} - ${window.query.slice(0, 40)}... (Page ${page})`);
        try {
          const items = await fetchPage(window.query, window.sort, page);
          if (!items.length) break;

          for (const item of items) {
            const key = `${item.owner.login.toLowerCase()}/${item.name.toLowerCase()}`;
            if (seen.has(key)) continue;

            seen.add(key);
            collected.push(normalizeRepo(item, config.tier, globalRank++));
            tierCollectedCount++;

            if (tierCollectedCount >= config.target) break;
          }
          await sleep(SLEEP_MS);
        } catch (err) {
          console.error(`   ❌ Error: ${err.message}`);
          break;
        }
      }
    }
    console.log(`   ✅ Finished ${config.tier}: +${tierCollectedCount} repos`);
  }

  const dataDir = path.resolve(process.cwd(), "public/data");
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  const outputPath = path.join(dataDir, "top-repos.json");
  fs.writeFileSync(outputPath, JSON.stringify(collected, null, 2));

  console.log(`\n🎉 Process complete! Total repos: ${collected.length}`);
  console.log(`📄 Saved to ${outputPath}`);
}

run().catch(console.error);
