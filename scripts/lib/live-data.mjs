// Fetches the live numbers the weekly workflow draws: languages across my public
// repositories, contributions in the last year, the status of my open-source pull
// requests, and the latest bugbout release. Uses only Node's built-in fetch.
// Needs GITHUB_TOKEN (the workflow's token is enough; locally, `GH_TOKEN=$(gh auth token)`).
const API = "https://api.github.com";

function token() {
  const t = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!t) throw new Error("Set GITHUB_TOKEN (or GH_TOKEN) to read GitHub data");
  return t;
}

async function json(url, init = {}) {
  const res = await fetch(url, {
    ...init,
    headers: { "User-Agent": "keerthirajan58-profile", Accept: "application/vnd.github+json", ...init.headers },
  });
  if (!res.ok) throw new Error(`${init.method || "GET"} ${url} -> ${res.status} ${await res.text()}`);
  return res.json();
}

const gh = (path) => json(API + path, { headers: { Authorization: `Bearer ${token()}` } });

async function graphql(query, variables) {
  const body = await json(API + "/graphql", {
    method: "POST",
    headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (body.errors) throw new Error("GraphQL: " + JSON.stringify(body.errors));
  return body.data;
}

const REPOS = `query($login: String!, $after: String) {
  user(login: $login) {
    repositories(ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, first: 100, after: $after) {
      pageInfo { hasNextPage endCursor }
      nodes { name languages(first: 25, orderBy: {field: SIZE, direction: DESC}) { edges { size node { name } } } }
    }
  }
}`;

const CONTRIBUTIONS = `query($login: String!) {
  user(login: $login) {
    contributionsCollection { contributionCalendar { totalContributions } }
  }
}`;

/**
 * Each language's share of code, averaged over my own public, non-fork repositories that
 * have code (this repo excluded), each repository counting equally. Summing bytes instead
 * would let one large repository, or a library committed inside one, outweigh the rest.
 */
async function languages(login) {
  const sums = {};
  let after = null;
  let repos = 0;
  do {
    const page = (await graphql(REPOS, { login, after })).user.repositories;
    for (const r of page.nodes) {
      if (r.name.toLowerCase() === login.toLowerCase()) continue; // the profile repo itself
      const size = r.languages.edges.reduce((s, e) => s + e.size, 0);
      if (!size) continue; // no code
      repos++;
      for (const e of r.languages.edges) sums[e.node.name] = (sums[e.node.name] || 0) + e.size / size;
    }
    after = page.pageInfo.hasNextPage ? page.pageInfo.endCursor : null;
  } while (after);
  const list = Object.entries(sums)
    .map(([name, sum]) => ({ name, share: +(sum / repos).toFixed(6) }))
    .sort((a, b) => b.share - a.share || a.name.localeCompare(b.name));
  return { repos, list };
}

async function pullRequests(list) {
  return Promise.all(
    list.map(async (p) => {
      const pr = await gh(`/repos/${p.repo}/pulls/${p.number}`);
      const status = pr.merged_at ? "merged" : pr.state === "open" ? (pr.draft ? "draft" : "open") : "closed";
      return {
        ...p,
        url: pr.html_url,
        title: pr.title,
        status,
        openedAt: pr.created_at,
        mergedAt: pr.merged_at,
        closedAt: pr.closed_at,
      };
    }),
  );
}

async function pypi(name) {
  const d = await json(`https://pypi.org/pypi/${name}/json`, { headers: { Accept: "application/json" } });
  // The newest upload among the current release's files (`urls`; PyPI deprecates `releases`).
  const uploaded = (d.urls || []).map((f) => f.upload_time_iso_8601).sort().at(-1) || null;
  return { name, version: d.info.version, uploaded, url: `https://pypi.org/project/${name}/` };
}

/** Everything the live images show, plus when it was fetched. */
export async function fetchLive(profile, now = new Date()) {
  const [langs, contrib, prs, pkg] = await Promise.all([
    languages(profile.login),
    // Optional: if the token cannot read the contribution calendar, the tile is left out.
    graphql(CONTRIBUTIONS, { login: profile.login }).catch((e) => {
      console.warn("Contributions unavailable:", e.message);
      return null;
    }),
    pullRequests(profile.openSource || []),
    profile.package?.name ? pypi(profile.package.name) : null,
  ]);
  return {
    fetchedAt: now.toISOString(),
    login: profile.login,
    contributionsLastYear: contrib?.user.contributionsCollection.contributionCalendar.totalContributions ?? null,
    languages: langs,
    pullRequests: prs,
    package: pkg,
  };
}
