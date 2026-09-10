from __future__ import annotations

import json
import subprocess
import tempfile
import unittest
from pathlib import Path

import compute_release_version as release


def completed(
    stdout: str = "", returncode: int = 0, stderr: str = ""
) -> subprocess.CompletedProcess[str]:
    return subprocess.CompletedProcess([], returncode, stdout, stderr)


class ReleaseVersionTests(unittest.TestCase):
    def test_initial_minor_release_is_v0_1_0(self) -> None:
        previous, next_tag = release.compute_release("minor", lambda _: completed())
        self.assertEqual("", previous)
        self.assertEqual("v0.1.0", next_tag)

    def test_bumps_latest_stable_tag_and_ignores_rc_tags(self) -> None:
        tags = "v0.2.9\nv0.3.0-rc.1\nv0.10.1\nother/v9.0.0\n"
        previous, next_tag = release.compute_release(
            "patch", lambda _: completed(tags)
        )
        self.assertEqual("v0.10.1", previous)
        self.assertEqual("v0.10.2", next_tag)

    def test_all_bump_kinds_reset_lower_components(self) -> None:
        self.assertEqual((2, 0, 0), release.bump_version((1, 2, 3), "major"))
        self.assertEqual((1, 3, 0), release.bump_version((1, 2, 3), "minor"))
        self.assertEqual((1, 2, 4), release.bump_version((1, 2, 3), "patch"))

    def test_rejects_unknown_bump(self) -> None:
        with self.assertRaisesRegex(ValueError, "unsupported bump"):
            release.compute_release("preview", lambda _: completed())

    def test_requires_new_commits_after_previous_tag(self) -> None:
        calls: list[list[str]] = []

        def runner(arguments: list[str]) -> subprocess.CompletedProcess[str]:
            calls.append(arguments)
            return completed("0\n")

        with self.assertRaisesRegex(RuntimeError, "no unreleased commits"):
            release.require_new_commits("v0.1.0", runner)
        self.assertEqual(
            ["git", "rev-list", "--count", "v0.1.0..HEAD"], calls[0]
        )

    def test_rejects_existing_remote_tag(self) -> None:
        responses = iter((completed(returncode=1), completed("tag\n")))
        with self.assertRaisesRegex(RuntimeError, "already exists on origin"):
            release.require_absent_tag("v0.1.0", lambda _: next(responses))

    def test_requires_all_plugin_versions_to_match_expected_tag(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "package.json").write_text(
                json.dumps({"version": "0.1.0"}), encoding="utf-8"
            )
            (root / "manifest.json").write_text(
                json.dumps({"version": "0.1.0", "minAppVersion": "1.8.0"}),
                encoding="utf-8",
            )
            (root / "versions.json").write_text(
                json.dumps({"0.1.0": "1.8.0"}), encoding="utf-8"
            )

            original_root = release.REPOSITORY_ROOT
            release.REPOSITORY_ROOT = root
            try:
                release.require_plugin_version("0.1.0")
                with self.assertRaisesRegex(RuntimeError, "must equal"):
                    release.require_plugin_version("0.2.0")
            finally:
                release.REPOSITORY_ROOT = original_root


if __name__ == "__main__":
    unittest.main()
