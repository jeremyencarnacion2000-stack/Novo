import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDeveloperContext, developerContextErrorMessage } from '../src/developer-context.ts';

test('formats GitHub review, PR and CI counts plus Vercel state without provider content', () => {
  const lines = formatDeveloperContext({
    github: {
      connected: true, sourceExcluded: false,
      repositories: [{ repository: 'acme/app', openPullRequests: 2, requestedReviewers: 1, latestReviewState: 'approved', ci: { passed: 3, failed: 0, pending: 1 }, title: 'private PR title' }],
    },
    vercel: {
      connected: true, sourceExcluded: false,
      projects: [{ id: 'prj_1', name: 'novo-web' }],
      deployments: [{ id: 'dep_1', projectId: 'prj_1', projectName: 'novo-web', state: 'READY', createdAt: '2026-10-08T10:00:00Z', url: 'https://novo.example', meta: { token: 'secret' } }],
    },
  });

  assert.deepEqual(lines, [
    'GitHub · acme/app · 2 PR abiertas · revisión aprobada · CI 3 correctos, 0 fallidos, 1 pendientes',
    'Vercel · novo-web · despliegue READY',
  ]);
  assert.doesNotMatch(JSON.stringify(lines), /private PR title|novo\.example|secret|dep_1/);
});

test('does not display a source the user excluded and returns a generic read-permission hint', () => {
  const lines = formatDeveloperContext({
    github: { connected: true, sourceExcluded: true, repositories: [{ repository: 'acme/private', openPullRequests: 99 }] },
    vercel: { connected: false, sourceExcluded: false, projects: [], deployments: [] },
  });

  assert.deepEqual(lines, []);
  assert.equal(developerContextErrorMessage('integration_read_permission_required'), 'Crea un token revocable con el permiso «Leer integraciones».');
  assert.equal(developerContextErrorMessage('provider leaked secret'), 'No se pudo consultar el contexto de desarrollo.');
});

test('turns provider errors into safe, actionable summaries instead of exposing error codes', () => {
  const lines = formatDeveloperContext({
    github: { connected: true, sourceExcluded: false, repositories: [], error: 'provider_auth_required' },
    vercel: { connected: true, sourceExcluded: false, deployments: [], error: 'provider_rate_limited' },
  });

  assert.deepEqual(lines, [
    'GitHub · vuelve a autorizar la conexión.',
    'Vercel · límite temporal del proveedor; reintenta más tarde.',
  ]);
  assert.doesNotMatch(JSON.stringify(lines), /provider_auth_required|provider_rate_limited/);
});
