//! No supported Windows confinement has been demonstrated for this adapter.
pub fn available() -> Result<(), String> {
    Err("unsupported_sandbox".into())
}
