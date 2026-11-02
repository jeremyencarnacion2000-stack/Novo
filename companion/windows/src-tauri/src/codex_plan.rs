// Codex plan usage — the same source as CodexPlanGauge.swift on the Mac.
//
// Coucou asks the Codex CLI itself: `codex app-server` (the JSON-RPC server
// behind Codex's /status) is started, asked `account/rateLimits/read`, and
// stopped. Coucou makes no network call of its own and reads no credential:
// Codex answers with its own sign-in, exactly as /status does, and nothing is
// installed or written. It runs only when the pill shows or is clicked, at most
// once at a time, for 15 s at most, and is skipped while Coucou is paused.

use std::cmp::Ordering;
use std::io::{BufRead, BufReader, Read, Write};
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::atomic::{self, AtomicBool};
use std::sync::mpsc;
use std::time::Duration;

use serde_json::{json, Value};

use crate::platform;

/// The Mac gives Codex the same 15 s.
const TIMEOUT: Duration = Duration::from_secs(15);
/// One JSON-RPC line we are willing to read; the answer is a few hundred bytes.
const MAX_LINE: usize = 256 * 1024;
/// Everything we are willing to read before the answer shows up.
const MAX_TOTAL: usize = 2 * 1024 * 1024;

/// What the Mac sends: initialize, initialized, then the one question.
const REQUESTS: &str = concat!(
    r#"{"id":1,"method":"initialize","params":{"clientInfo":{"name":"coucou","version":"1"}}}"#,
    "\n",
    r#"{"method":"initialized"}"#,
    "\n",
    r#"{"id":2,"method":"account/rateLimits/read"}"#,
    "\n",
);

static BUSY: AtomicBool = AtomicBool::new(false);

struct NotBusy;
impl Drop for NotBusy {
    fn drop(&mut self) {
        BUSY.store(false, atomic::Ordering::Release);
    }
}

/// The limits part of Codex's `account/rateLimits/read` answer, or `None` when
/// Codex is not installed, not signed in, slow, already being asked, or Coucou
/// is paused. Blocking: call it off the main thread.
pub fn read() -> Option<Value> {
    if crate::integrations::PAUSED.load(atomic::Ordering::Relaxed) {
        return None;
    }
    if BUSY.swap(true, atomic::Ordering::AcqRel) {
        return None;
    }
    let _busy = NotBusy;

    let exe = platform::codex_candidates().into_iter().next()?;
    query(&exe, REQUESTS).map(|result| limits_only(&result))
}

/// Local account metadata avoids doctor's unrelated network/sandbox probes.
pub fn uses_chatgpt_login(exe: &Path) -> bool {
    let requests = concat!(
        r#"{"id":1,"method":"initialize","params":{"clientInfo":{"name":"novo","version":"1"}}}"#, "\n",
        r#"{"method":"initialized"}"#, "\n",
        r#"{"id":2,"method":"account/read","params":{"refreshToken":false}}"#, "\n",
    );
    query(exe, requests).is_some_and(|result| chatgpt_account(&result))
}

fn chatgpt_account(result: &Value) -> bool {
    result["account"]["type"] == "chatgpt"
}

fn private_environment_key(key: &str) -> bool {
    let upper = key.to_ascii_uppercase();
    upper.contains("TOKEN")
        || upper.contains("SECRET")
        || upper.ends_with("API_KEY")
        || upper.starts_with("GIT_")
        || upper.starts_with("OPENAI_")
        || upper.starts_with("CODEX_") && upper != "CODEX_HOME"
        || ["DATABASE_URL", "DIRECT_URL", "PGPASSWORD", "NODE_OPTIONS", "RUSTC_WRAPPER", "NPM_CONFIG_USERCONFIG"].contains(&upper.as_str())
}

/// Retain protected CLI login, never credentials or tools from a parent agent.
pub(crate) fn isolate_command_environment(command: &mut Command) {
    for (key, _) in std::env::vars() {
        if private_environment_key(&key) {
            command.env_remove(key);
        }
    }
    command.env("GIT_CONFIG_NOSYSTEM", "1")
        .env("GIT_CONFIG_GLOBAL", if cfg!(windows) { "NUL" } else { "/dev/null" })
        .env_remove("GIT_CONFIG_COUNT").env_remove("GIT_CONFIG_PARAMETERS");
}

fn query(exe: &Path, requests: &str) -> Option<Value> {
    let mut cmd = Command::new(exe);
    cmd.arg("app-server").stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::null());
    isolate_command_environment(&mut cmd);
    // An npm install is a `#!/usr/bin/env node` script (or a .cmd calling node):
    // its own folder first on PATH, as the Mac does, so it finds its Node.
    if let Some(dir) = exe.parent() {
        let mut dirs = vec![dir.to_path_buf()];
        if let Some(path) = std::env::var_os("PATH") {
            dirs.extend(std::env::split_paths(&path));
        }
        if let Ok(joined) = std::env::join_paths(dirs) {
            cmd.env("PATH", joined);
        }
    }
    platform::no_console(&mut cmd);
    let mut child = cmd.spawn().ok()?;

    let answer = (|| {
        let mut stdin = child.stdin.take()?;
        let stdout = child.stdout.take()?;
        let (tx, rx) = mpsc::channel();
        std::thread::spawn(move || {
            let _ = tx.send(first_answer(BufReader::new(stdout)));
        });
        stdin.write_all(requests.as_bytes()).ok()?;
        stdin.flush().ok()?;
        let answer = rx.recv_timeout(TIMEOUT).ok().flatten();
        // Closing its input is how app-server learns we are done.
        drop(stdin);
        answer
    })();
    // An npm install runs `codex.cmd`: killing cmd.exe alone would leave the
    // node app-server under it running. End the whole tree there.
    #[cfg(windows)]
    {
        let mut kill = Command::new("taskkill");
        kill.args(["/T", "/F", "/PID", &child.id().to_string()]).stdout(Stdio::null()).stderr(Stdio::null());
        platform::no_console(&mut kill);
        let _ = kill.status();
    }
    let _ = child.kill();
    let _ = child.wait();
    answer
}

/// Reads JSON-RPC lines until the answer to request 2 and returns its `result`.
/// Gives up on a line or a stream that is far too long for what we expect.
pub fn first_answer(reader: impl BufRead) -> Option<Value> {
    let mut reader = reader;
    let mut total = 0usize;
    let mut line = Vec::new();
    loop {
        line.clear();
        let n = (&mut reader).take(MAX_LINE as u64 + 1).read_until(b'\n', &mut line).ok()?;
        if n == 0 {
            return None;
        }
        total += n;
        if total > MAX_TOTAL || line.len() > MAX_LINE {
            return None;
        }
        let Ok(message) = serde_json::from_slice::<Value>(&line) else { continue };
        if message.get("id").and_then(Value::as_i64) == Some(2) {
            return message.get("result").filter(|r| r.is_object()).cloned();
        }
    }
}

/// Only what the card shows goes to the webview: the limits and the free resets.
fn limits_only(result: &Value) -> Value {
    json!({
        "rateLimits": result.get("rateLimits").cloned().unwrap_or(Value::Null),
        "rateLimitResetCredits": result.get("rateLimitResetCredits").cloned().unwrap_or(Value::Null),
    })
}

/// Compares version-like names with their numbers as numbers ("v20.1" > "v9.12"),
/// like Foundation's `.numeric` comparison the Mac sorts nvm's folders with.
#[cfg_attr(windows, allow(dead_code))]
pub fn compare_versions(a: &str, b: &str) -> Ordering {
    fn parts(s: &str) -> Vec<Result<u64, String>> {
        let mut out = Vec::new();
        let mut cur = String::new();
        let mut digits = false;
        for c in s.chars() {
            if c.is_ascii_digit() != digits && !cur.is_empty() {
                out.push(if digits { Ok(cur.parse().unwrap_or(u64::MAX)) } else { Err(cur.clone()) });
                cur.clear();
            }
            digits = c.is_ascii_digit();
            cur.push(c);
        }
        if !cur.is_empty() {
            out.push(if digits { Ok(cur.parse().unwrap_or(u64::MAX)) } else { Err(cur) });
        }
        out
    }
    let (pa, pb) = (parts(a), parts(b));
    for (x, y) in pa.iter().zip(pb.iter()) {
        let ord = match (x, y) {
            (Ok(x), Ok(y)) => x.cmp(y),
            (Err(x), Err(y)) => x.cmp(y),
            (Ok(_), Err(_)) => Ordering::Less,
            (Err(_), Ok(_)) => Ordering::Greater,
        };
        if ord != Ordering::Equal {
            return ord;
        }
    }
    pa.len().cmp(&pb.len())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn child_does_not_inherit_desktop_tool_pipes_or_parent_thread_identity() {
        for key in ["CODEX_APP_TOOLS_PIPE_PATH", "CODEX_THREAD_ID", "CODEX_SESSION_ID", "CODEX_MCP_NODE_PATH", "codex_app_tools_pipe_path", "OPENAI_API_KEY", "DATABASE_URL"] {
            assert!(private_environment_key(key), "{key}");
        }
        for key in ["CODEX_HOME", "PATH", "USERPROFILE", "LOCALAPPDATA"] {
            assert!(!private_environment_key(key), "{key}");
        }
        let mut command = Command::new("fixture");
        isolate_command_environment(&mut command);
        for (key, _) in std::env::vars().filter(|(key, _)| private_environment_key(key)) {
            assert!(command.get_envs().any(|(name, value)| name == key.as_str() && value.is_none()), "{key}");
        }
        assert!(!command.get_envs().any(|(name, value)| name == "CODEX_HOME" && value.is_none()));
    }

    #[test]
    fn chatgpt_plan_requires_an_explicit_chatgpt_account() {
        assert!(chatgpt_account(&json!({"account":{"type":"chatgpt"}})));
        for account in [json!({"type":"apiKey"}), json!({"type":"unknown"}), json!({}), Value::Null] {
            assert!(!chatgpt_account(&json!({"account":account})));
        }
    }

    #[test]
    fn the_answer_to_the_question_is_picked_out_of_the_conversation() {
        let stream = concat!(
            r#"{"id":1,"result":{"userAgent":"codex"}}"#, "\n",
            "not json at all\n",
            r#"{"method":"account/updated","params":{}}"#, "\n",
            r#"{"id":2,"result":{"rateLimits":{"primary":{"usedPercent":12.5,"resetsAt":1900000000}}}}"#, "\n",
            r#"{"id":3,"result":{}}"#, "\n",
        );
        let result = first_answer(stream.as_bytes()).unwrap();
        assert_eq!(result["rateLimits"]["primary"]["usedPercent"], 12.5);
    }

    #[test]
    fn an_error_a_closed_stream_or_a_flood_is_no_answer() {
        assert!(first_answer(r#"{"id":2,"error":{"message":"not signed in"}}"#.as_bytes()).is_none());
        assert!(first_answer(r#"{"id":1,"result":{}}"#.as_bytes()).is_none());
        assert!(first_answer(&b""[..]).is_none());
        let huge = "x".repeat(MAX_LINE + 10);
        assert!(first_answer(format!("{huge}\n{}\n", r#"{"id":2,"result":{}}"#).as_bytes()).is_none());
        // Many short lines add up too.
        let chatter = format!("{}\n", "y".repeat(1000)).repeat(MAX_TOTAL / 1000 + 10);
        assert!(first_answer(chatter.as_bytes()).is_none());
    }

    #[test]
    fn only_the_limits_reach_the_webview() {
        let result = json!({
            "rateLimits": { "planType": "plus" },
            "rateLimitResetCredits": { "availableCount": 1 },
            "account": { "email": "me@example.com" }
        });
        let kept = limits_only(&result);
        assert_eq!(kept["rateLimits"]["planType"], "plus");
        assert_eq!(kept["rateLimitResetCredits"]["availableCount"], 1);
        assert!(kept.get("account").is_none());
    }

    #[test]
    fn newest_node_first_like_the_mac() {
        let mut v = vec!["v9.12.0", "v20.1.0", "v18.20.4", "v20.11.1"];
        v.sort_by(|a, b| compare_versions(b, a));
        assert_eq!(v, ["v20.11.1", "v20.1.0", "v18.20.4", "v9.12.0"]);
    }
}
