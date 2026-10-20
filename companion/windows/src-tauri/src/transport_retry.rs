use std::time::{Duration, Instant};

#[derive(Default)]
pub struct TransportRetry {
    failures: u32,
    retry_at: Option<Instant>,
}

impl TransportRetry {
    pub fn remaining_seconds(&self, now: Instant) -> Option<u64> {
        self.retry_at.filter(|deadline| *deadline > now)
            .map(|deadline| deadline.duration_since(now).as_secs().max(1))
    }

    pub fn fail(&mut self, now: Instant, retry_after_seconds: Option<u64>) {
        if self.remaining_seconds(now).is_some() {
            if let Some(seconds) = retry_after_seconds {
                self.retry_at = self.retry_at.map(|deadline| deadline.max(now + Duration::from_secs(seconds.min(3600))));
            }
            return;
        }
        let delay = (15 * (1u64 << self.failures.min(5))).min(300)
            .max(retry_after_seconds.unwrap_or(0).min(3600));
        self.failures = self.failures.saturating_add(1);
        self.retry_at = Some(now + Duration::from_secs(delay));
    }

    pub fn reset(&mut self) { *self = Self::default(); }

    pub fn succeed(&mut self, now: Instant) {
        if self.remaining_seconds(now).is_none() { self.reset(); }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn transient_failures_back_off_until_five_minutes_then_recover() {
        let mut retry = TransportRetry::default();
        let mut now = Instant::now();
        for delay in [15, 30, 60, 120, 240, 300, 300] {
            assert_eq!(retry.remaining_seconds(now), None);
            retry.fail(now, None);
            assert!(retry.remaining_seconds(now).is_some());
            assert!(retry.remaining_seconds(now + Duration::from_secs(delay - 1)).is_some());
            now += Duration::from_secs(delay);
            assert_eq!(retry.remaining_seconds(now), None);
        }
        retry.reset();
        retry.fail(now, None);
        assert_eq!(retry.remaining_seconds(now + Duration::from_secs(15)), None);
    }

    #[test]
    fn concurrent_failures_do_not_extend_an_active_wait() {
        let mut retry = TransportRetry::default();
        let now = Instant::now();
        retry.fail(now, None);
        retry.fail(now + Duration::from_secs(5), None);
        assert_eq!(retry.remaining_seconds(now + Duration::from_secs(14)), Some(1));
        assert_eq!(retry.remaining_seconds(now + Duration::from_secs(15)), None);
    }

    #[test]
    fn server_retry_after_is_respected_and_reset_clears_the_wait() {
        let mut retry = TransportRetry::default();
        let now = Instant::now();
        retry.fail(now, Some(600));
        assert!(retry.remaining_seconds(now + Duration::from_secs(599)).is_some());
        retry.reset();
        assert_eq!(retry.remaining_seconds(now), None);
    }

    #[test]
    fn later_server_retry_after_extends_a_concurrent_short_wait() {
        let mut retry = TransportRetry::default();
        let now = Instant::now();
        retry.fail(now, None);
        retry.fail(now + Duration::from_secs(5), Some(600));
        retry.succeed(now + Duration::from_secs(6));
        assert!(retry.remaining_seconds(now + Duration::from_secs(604)).is_some());
        assert_eq!(retry.remaining_seconds(now + Duration::from_secs(605)), None);
        retry.fail(now + Duration::from_secs(605), None);
        assert_eq!(retry.remaining_seconds(now + Duration::from_secs(635)), None);
    }
}
