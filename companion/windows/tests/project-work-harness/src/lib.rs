#[path = "../../../src-tauri/src/project_work/codex.rs"]
mod codex;
#[path = "../../../src-tauri/src/project_work/process.rs"]
mod process;
#[path = "../../../src-tauri/src/project_work/protocol.rs"]
mod protocol;
#[path = "../../../src-tauri/src/project_work/workspace.rs"]
mod workspace;
mod platform {
    pub fn no_console(cmd: &mut std::process::Command) -> &mut std::process::Command {
        cmd
    }
    pub fn ensure_private_dir(path: &std::path::Path) -> std::io::Result<()> {
        std::fs::create_dir_all(path)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn argv_has_explicit_confinement_and_no_bypass() {
        let args =
            codex::agent_args(std::path::Path::new("C:/fixture"), "gpt-6-luna", false).unwrap();
        let joined = args.join(" ");
        for required in [
            "--json",
            "--ignore-user-config",
            "--ignore-rules",
            "approval_policy=\"never\"",
            "network.enabled=false",
            "windows.sandbox=\"elevated\"",
            "web_search=\"disabled\"",
        ] {
            assert!(joined.contains(required), "{required}");
        }
        assert!(!joined.contains("danger-full-access"));
        assert!(!joined.contains("bypass"));
        assert!(
            codex::agent_args(std::path::Path::new("C:/fixture"), "model;unsafe", true).is_err()
        );
    }
    #[test]
    fn decoder_requires_thread_and_completed_turn_and_bounds_every_line() {
        let mut decoder = protocol::JsonlDecoder::default();
        assert!(decoder.finish().is_err());
        decoder
            .line(
                br#"{"type":"thread.started","thread_id":"11111111-1111-4111-8111-111111111111"}"#,
            )
            .unwrap();
        decoder
            .line(br#"{"type":"turn.completed","usage":{"input_tokens":1}}"#)
            .unwrap();
        assert!(decoder.finish().is_ok());
        assert!(decoder.line(&vec![b'x'; 65537]).is_err());
        assert!(protocol::JsonlDecoder::default()
            .line(br#"{"type":"thread.started","thread_id":"sk-private-token"}"#)
            .is_err());
    }
    #[test]
    fn artifact_paths_reject_secrets_and_escapes() {
        for path in [
            "../secrets",
            "C:/private",
            ".env.local",
            ".git/config",
            ".GIT/config",
            ".npmrc",
            "nested/.netrc",
            ".codex/config.toml",
            "nested/.env",
            "file\\escape",
            "",
            "a//b",
        ] {
            assert!(!workspace::safe_relative(path), "{path}");
        }
        assert!(workspace::safe_relative("app/route.ts"));
    }
    #[test]
    fn failed_turn_never_becomes_a_success() {
        let mut decoder = protocol::JsonlDecoder::default();
        decoder
            .line(
                br#"{"type":"thread.started","thread_id":"11111111-1111-4111-8111-111111111111"}"#,
            )
            .unwrap();
        assert!(decoder
            .line(br#"{"type":"turn.failed","error":{"message":"sk-private C:/private"}}"#)
            .is_err());
        assert!(decoder.finish().is_err());
    }
    #[test]
    fn cancelled_step_does_not_spawn_and_output_is_bounded() {
        let cancel = std::sync::Arc::new(std::sync::atomic::AtomicBool::new(true));
        assert!(process::run_guarded(
            std::path::Path::new("does-not-exist.exe"),
            &[],
            None,
            None,
            1,
            1024,
            cancel
        )
        .is_err());
        #[cfg(windows)]
        {
            let output = process::capture(
                &codex::system_powershell(),
                &[
                    "-NoProfile".into(),
                    "-NonInteractive".into(),
                    "-Command".into(),
                    "'x' * 2000".into(),
                ],
                None,
                5,
                100,
            );
            assert!(output.is_err());
            let timeout = process::capture(
                &codex::system_powershell(),
                &[
                    "-NoProfile".into(),
                    "-NonInteractive".into(),
                    "-Command".into(),
                    "Start-Sleep -Seconds 5".into(),
                ],
                None,
                1,
                100,
            );
            assert!(timeout.is_err());
        }
    }
    #[cfg(windows)]
    #[test]
    fn isolated_copy_omits_private_config_preserves_dirty_checkout_and_records_actual_diff() {
        use std::{
            fs,
            sync::{atomic::AtomicBool, Arc},
        };
        let root = std::env::temp_dir().join(format!("novo-work-fixture-{}", uuid::Uuid::new_v4()));
        let source = root.join("selected");
        fs::create_dir_all(source.join(".codex")).unwrap();
        fs::write(source.join("app.ts"), "export const value=1;\n").unwrap();
        fs::write(source.join(".env.local"), "FIXTURE=private\n").unwrap();
        fs::write(source.join(".codex/config.toml"), "# untrusted fixture\n").unwrap();
        fs::write(
            source.join("package.json"),
            r#"{"scripts":{"test":"node test.js"}}"#,
        )
        .unwrap();
        let git = |args: &[&str]| {
            let mut argv = vec![
                "-c".into(),
                "core.hooksPath=".into(),
                "-c".into(),
                "user.name=Fixture".into(),
                "-c".into(),
                "user.email=fixture@example.invalid".into(),
                "-C".into(),
                source.to_string_lossy().into(),
            ];
            argv.extend(args.iter().map(|s| s.to_string()));
            assert!(
                process::capture(std::path::Path::new("git"), &argv, None, 10, 65536)
                    .unwrap()
                    .success
            );
        };
        git(&["init"]);
        git(&["add", "."]);
        git(&["commit", "-m", "fixture"]);
        fs::write(source.join("app.ts"), "user dirty checkout\n").unwrap();
        let cancel = Arc::new(AtomicBool::new(false));
        let prepared =
            workspace::prepare(&source, &root.join("artifacts"), cancel.clone()).unwrap();
        assert_eq!(
            fs::read_to_string(source.join("app.ts")).unwrap(),
            "user dirty checkout\n"
        );
        assert!(!prepared.path.join(".env.local").exists());
        assert!(!prepared.path.join(".codex").exists());
        assert!(workspace::verification_scripts_unchanged(&prepared).unwrap());
        fs::write(
            prepared.path.join("package.json"),
            r#"{"scripts":{"test":"exit 0"}}"#,
        )
        .unwrap();
        assert!(!workspace::verification_scripts_unchanged(&prepared).unwrap());
        fs::write(
            prepared.path.join("package.json"),
            r#"{"scripts":{"test":"node test.js"}}"#,
        )
        .unwrap();
        fs::create_dir(prepared.path.join("new")).unwrap();
        fs::write(prepared.path.join("new/file.ts"), "export const next=2;\n").unwrap();
        let (paths, hash) = workspace::manifest(&prepared, cancel).unwrap();
        assert_eq!(paths, vec!["new/file.ts"]);
        assert_eq!(hash.len(), 64);
        let patch =
            fs::read_to_string(prepared.path.parent().unwrap().join("prepared.patch")).unwrap();
        assert!(patch.contains("next=2"));
        assert!(!patch.contains("FIXTURE"));
        workspace::release_clone(&root.join("artifacts"), &prepared).unwrap();
        assert!(!prepared.path.exists());
        assert!(prepared
            .path
            .parent()
            .unwrap()
            .join("prepared.patch")
            .is_file());
        assert_eq!(
            fs::read_to_string(source.join("app.ts")).unwrap(),
            "user dirty checkout\n"
        );
        // Leave the tiny uniquely named fixture available for inspection.
    }
}
