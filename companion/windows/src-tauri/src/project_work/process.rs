//! Fixed argv only. Prompts enter stdin after the trusted child joins its job.
use std::{
    io::{Read, Write},
    path::Path,
    process::{Command, Stdio},
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    time::{Duration, Instant},
};
pub struct Output {
    pub bytes: Vec<u8>,
    pub success: bool,
    pub exit_code: i32,
}
#[cfg(windows)]
struct ProcessTree(windows::Win32::Foundation::HANDLE);
#[cfg(windows)]
impl ProcessTree {
    fn attach(child: &std::process::Child) -> Result<Self, String> {
        use std::os::windows::io::AsRawHandle;
        use windows::Win32::{
            Foundation::{CloseHandle, HANDLE},
            System::JobObjects::*,
        };
        unsafe {
            let handle = CreateJobObjectW(None, None).map_err(|_| "unsupported_sandbox")?;
            let mut limits = JOBOBJECT_EXTENDED_LIMIT_INFORMATION::default();
            limits.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
            if SetInformationJobObject(
                handle,
                JobObjectExtendedLimitInformation,
                &limits as *const _ as *const _,
                std::mem::size_of_val(&limits) as u32,
            )
            .is_err()
                || AssignProcessToJobObject(handle, HANDLE(child.as_raw_handle())).is_err()
            {
                let _ = CloseHandle(handle);
                return Err("unsupported_sandbox".into());
            }
            Ok(Self(handle))
        }
    }
}
#[cfg(windows)]
impl Drop for ProcessTree {
    fn drop(&mut self) {
        unsafe {
            let _ = windows::Win32::Foundation::CloseHandle(self.0);
        }
    }
}
pub fn capture(
    exe: &Path,
    args: &[String],
    dir: Option<&Path>,
    seconds: u64,
    limit: usize,
) -> Result<Output, String> {
    run_guarded(
        exe,
        args,
        dir,
        None,
        seconds,
        limit,
        Arc::new(AtomicBool::new(false)),
    )
}
pub fn run_guarded(
    exe: &Path,
    args: &[String],
    dir: Option<&Path>,
    input: Option<&[u8]>,
    seconds: u64,
    limit: usize,
    cancel: Arc<AtomicBool>,
) -> Result<Output, String> {
    if cancel.load(Ordering::SeqCst) {
        return Err("execution_failed".into());
    }
    let mut command = Command::new(exe);
    command
        .args(args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::null());
    if let Some(dir) = dir {
        command.current_dir(dir);
    }
    // The only authentication retained is the CLI's own protected login.
    for (key, _) in std::env::vars() {
        let upper = key.to_ascii_uppercase();
        if upper.contains("TOKEN")
            || upper.contains("SECRET")
            || upper.ends_with("API_KEY")
            || upper.starts_with("GIT_")
            || upper.starts_with("OPENAI_")
            || [
                "DATABASE_URL",
                "DIRECT_URL",
                "PGPASSWORD",
                "NODE_OPTIONS",
                "RUSTC_WRAPPER",
                "NPM_CONFIG_USERCONFIG",
            ]
            .contains(&upper.as_str())
        {
            command.env_remove(key);
        }
    }
    command
        .env("GIT_CONFIG_NOSYSTEM", "1")
        .env(
            "GIT_CONFIG_GLOBAL",
            if cfg!(windows) { "NUL" } else { "/dev/null" },
        )
        .env_remove("GIT_CONFIG_COUNT")
        .env_remove("GIT_CONFIG_PARAMETERS");
    let mut child = crate::platform::no_console(&mut command)
        .spawn()
        .map_err(|_| "runtime_unavailable")?;
    #[cfg(windows)]
    let tree = match ProcessTree::attach(&child) {
        Ok(tree) => tree,
        Err(error) => {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error);
        }
    };
    #[cfg(not(windows))]
    {
        let _ = child.kill();
        let _ = child.wait();
        return Err("unsupported_sandbox".into());
    }
    let stdout = child.stdout.take().ok_or("execution_failed")?;
    let overflow = Arc::new(AtomicBool::new(false));
    let too_large = overflow.clone();
    let reader = std::thread::spawn(move || {
        let mut bytes = Vec::new();
        let mut stream = stdout;
        let mut buf = [0u8; 8192];
        loop {
            let count = stream.read(&mut buf).map_err(|_| "execution_failed")?;
            if count == 0 {
                break;
            }
            if bytes.len() + count > limit {
                too_large.store(true, Ordering::SeqCst);
                return Err("execution_failed");
            }
            bytes.extend_from_slice(&buf[..count]);
        }
        Ok::<_, &str>(bytes)
    });
    if let Some(input) = input {
        if input.len() > 8192
            || child
                .stdin
                .take()
                .ok_or("execution_failed")?
                .write_all(input)
                .is_err()
        {
            let _ = child.kill();
            let _ = child.wait();
            return Err("execution_failed".into());
        }
    } else {
        drop(child.stdin.take());
    }
    let started = Instant::now();
    let mut error = None;
    let status = loop {
        if cancel.load(Ordering::SeqCst) || overflow.load(Ordering::SeqCst) {
            error = Some("execution_failed");
            break None;
        }
        if started.elapsed() > Duration::from_secs(seconds) {
            error = Some("timeout");
            break None;
        }
        match child.try_wait() {
            Ok(Some(status)) => break Some(status),
            Ok(None) => std::thread::sleep(Duration::from_millis(25)),
            Err(_) => {
                error = Some("execution_failed");
                break None;
            }
        }
    };
    if error.is_some() {
        let _ = child.kill();
        let _ = child.wait();
    }
    #[cfg(windows)]
    drop(tree); // kills descendants even if the CLI exited first
    let bytes = reader
        .join()
        .map_err(|_| "execution_failed")?
        .map_err(str::to_string)?;
    if let Some(error) = error {
        return Err(error.into());
    }
    let status = status.ok_or("execution_failed")?;
    Ok(Output {
        bytes,
        success: status.success(),
        exit_code: status.code().unwrap_or(-1),
    })
}
