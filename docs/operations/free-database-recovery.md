# Free database recovery — October 2026

On 20 October 2026, production database requests failed because Neon public
data transfer exceeded the free allowance. The account owner chose to keep
the free plan. The provider reports the quota resets on 1 November (UTC).

This affects authentication, Gmail, chat and Companion synchronization. A
database service error is not evidence that a Google token needs replacing.
The provider quota cannot be repaired by retrying requests or reinstalling
the Companion.

## Recovery changes

- Revision-aware chat saves no longer download the previous message history
  from the database or echo the saved history back to the browser. Legacy
  saves still merge server messages; stale revisions still fail safely.
- Token authorization still reads expiry and revocation on every request.
  The approximate last-use audit timestamp is updated once per five minutes.
- Companion transient failures share an increasing wait from 15 seconds to
  five minutes, respecting longer server Retry-After values. Activity uploads
  preserve queued summaries when the server fails. Account verification
  resumes automatically; credentials are retained during an outage.

## After the quota resets

1. Verify production authorization and the Gmail health endpoint. Complete
   Google consent if health reports `reauthorization_required`.
2. Authorize local work-context scopes if the Companion token does not have
   them. Installing Codex hooks alone does not grant cloud context access.
3. Measure database egress and query sizes on the restored service. These
   changes remove specific repeated work; they do not guarantee a month of
   use stays below the provider allowance. Conversation history lists still
   hydrate full messages and remain a candidate for complete lazy loading.

No provider plan changes, quota overrides, database migrations or user data
deletion are needed for this recovery.
