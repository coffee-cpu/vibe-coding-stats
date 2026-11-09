import { test, expect, type Page, type Route } from '@playwright/test';

/**
 * End-to-end tests for the demo. The GitHub API is mocked, so these run
 * offline and never hit rate limits.
 */

interface MockCommit {
  login: string;
  date: string;
}

function commitJson({ login, date }: MockCommit, i: number) {
  return {
    sha: `${login}-${i}`,
    commit: { author: { name: login, email: `${login}@example.com`, date }, message: 'commit' },
    author: { login, type: 'User' },
    parents: [{ sha: 'parent' }],
  };
}

interface ApiCall {
  url: string;
  authorization?: string;
}

/**
 * Route GitHub API calls: `handler` returns the commits for a repo path
 * (e.g. "one/repo"), or a Response-like override.
 */
async function mockGitHub(
  page: Page,
  handler: (
    repoPath: string,
    url: URL
  ) => { status?: number; body: unknown; headers?: Record<string, string> }
): Promise<ApiCall[]> {
  const calls: ApiCall[] = [];
  await page.route('https://api.github.com/**', async (route: Route) => {
    const url = new URL(route.request().url());
    calls.push({ url: url.toString(), authorization: route.request().headers()['authorization'] });
    const repoPath = url.pathname.replace(/^\/repos\//, '').replace(/\/commits$/, '');
    const { status = 200, body, headers } = handler(repoPath, url);
    await route.fulfill({
      status,
      contentType: 'application/json',
      headers,
      body: JSON.stringify(body),
    });
  });
  return calls;
}

const oneCommit = (login: string) => [commitJson({ login, date: '2024-01-15T14:00:00Z' }, 0)];

test('loads the repository from the ?repo= URL parameter', async ({ page }) => {
  await mockGitHub(page, (repo) => ({ body: oneCommit(repo === 'one/repo' ? 'alice' : 'bob') }));

  await page.goto('?repo=one/repo');

  await expect(page.getByText('alice').first()).toBeVisible();
  await expect(page.locator('#repo-url')).toHaveValue('one/repo');
});

test('analyzes a URL, normalizes the address bar and supports back/forward', async ({ page }) => {
  await mockGitHub(page, (repo) => ({ body: oneCommit(repo === 'one/repo' ? 'alice' : 'bob') }));
  await page.goto('?repo=one/repo');
  await expect(page.getByText('alice').first()).toBeVisible();

  await page.locator('#repo-url').fill('https://github.com/two/repo.git');
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.getByText('bob').first()).toBeVisible();
  expect(new URL(page.url()).searchParams.get('repo')).toBe('two/repo');

  await page.goBack();
  await expect(page.getByText('alice').first()).toBeVisible();
  await expect(page.locator('#repo-url')).toHaveValue('one/repo');

  await page.goForward();
  await expect(page.getByText('bob').first()).toBeVisible();
});

test('explains rate limits and suggests a token', async ({ page }) => {
  await mockGitHub(page, () => ({ status: 403, body: { message: 'API rate limit exceeded' } }));
  await page.goto('?repo=one/repo');

  const alert = page.getByRole('alert');
  await expect(alert).toContainText('rate limit');
  await expect(alert).toContainText('add a GitHub token');
});

test('sends the token to GitHub but never puts it in the URL', async ({ page }) => {
  const calls = await mockGitHub(page, () => ({ body: oneCommit('alice') }));
  await page.goto('');

  await page.getByText('Advanced').click();
  await page.locator('#github-token').fill('test-token-123');
  await page.locator('#repo-url').fill('one/repo');
  await page.getByRole('button', { name: 'Analyze' }).click();
  await expect(page.getByText('alice').first()).toBeVisible();

  expect(calls.at(-1)?.authorization).toBe('Bearer test-token-123');
  expect(page.url()).not.toContain('test-token-123');
});

test('caps anonymous requests and shows a notice when history is truncated', async ({ page }) => {
  // Every page is full and links to another, like a very large repository
  const calls = await mockGitHub(page, (_repo, url) => {
    const n = Number(url.searchParams.get('page') ?? '1');
    const next = new URL(url);
    next.searchParams.set('page', String(n + 1));
    const body = Array.from({ length: 100 }, (_, i) =>
      commitJson(
        { login: 'alice', date: new Date(Date.UTC(2024, 0, n, 0, i)).toISOString() },
        n * 100 + i
      )
    );
    return { body, headers: { link: `<${next.toString()}>; rel="next"` } };
  });

  await page.goto('?repo=big/repo');

  await expect(page.getByTestId('truncated-notice')).toContainText('most recent 1,000 commits');
  expect(calls).toHaveLength(10);
});

test('does not show the truncation notice for small repositories', async ({ page }) => {
  await mockGitHub(page, () => ({ body: oneCommit('alice') }));
  await page.goto('?repo=one/repo');

  await expect(page.getByText('alice').first()).toBeVisible();
  await expect(page.getByTestId('truncated-notice')).toHaveCount(0);
});
