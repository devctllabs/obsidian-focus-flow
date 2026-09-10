#!/usr/bin/env python3
"""Compute and validate the next stable Focus Flow release version."""

from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
from pathlib import Path
from typing import Callable


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
STABLE_TAG_PATTERN = re.compile(
    r"^v(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$"
)
BUMP_KINDS = ("patch", "minor", "major")
Runner = Callable[[list[str]], subprocess.CompletedProcess[str]]


def run_command(arguments: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        arguments,
        cwd=REPOSITORY_ROOT,
        check=False,
        capture_output=True,
        text=True,
    )


def stable_tags(runner: Runner = run_command) -> list[tuple[tuple[int, int, int], str]]:
    result = runner(["git", "tag", "--list", "v*"])
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "failed to list git tags")

    tags: list[tuple[tuple[int, int, int], str]] = []
    for candidate in result.stdout.splitlines():
        match = STABLE_TAG_PATTERN.fullmatch(candidate.strip())
        if match:
            tags.append((tuple(map(int, match.groups())), candidate.strip()))
    return sorted(tags)


def bump_version(version: tuple[int, int, int], bump: str) -> tuple[int, int, int]:
    major, minor, patch = version
    if bump == "major":
        return major + 1, 0, 0
    if bump == "minor":
        return major, minor + 1, 0
    if bump == "patch":
        return major, minor, patch + 1
    raise ValueError(f"unsupported bump: {bump}")


def compute_release(
    bump: str, runner: Runner = run_command
) -> tuple[str, str]:
    if bump not in BUMP_KINDS:
        raise ValueError(f"unsupported bump: {bump}")

    tags = stable_tags(runner)
    previous_version, previous_tag = tags[-1] if tags else ((0, 0, 0), "")
    next_version = bump_version(previous_version, bump)
    next_tag = f"v{next_version[0]}.{next_version[1]}.{next_version[2]}"
    return previous_tag, next_tag


def require_new_commits(
    previous_tag: str, runner: Runner = run_command
) -> None:
    revision = f"{previous_tag}..HEAD" if previous_tag else "HEAD"
    result = runner(["git", "rev-list", "--count", revision])
    if result.returncode != 0:
        raise RuntimeError(result.stderr.strip() or "failed to inspect commits")
    if int(result.stdout.strip()) == 0:
        raise RuntimeError("no unreleased commits")


def require_absent_tag(tag: str, runner: Runner = run_command) -> None:
    local = runner(
        ["git", "rev-parse", "--verify", "--quiet", f"refs/tags/{tag}"]
    )
    if local.returncode == 0:
        raise RuntimeError(f"tag already exists locally: {tag}")
    if local.returncode != 1:
        raise RuntimeError(local.stderr.strip() or "failed to inspect local tags")

    remote = runner(
        ["git", "ls-remote", "--exit-code", "--tags", "origin", f"refs/tags/{tag}"]
    )
    if remote.returncode == 0:
        raise RuntimeError(f"tag already exists on origin: {tag}")
    if remote.returncode != 2:
        raise RuntimeError(remote.stderr.strip() or "failed to inspect remote tags")


def require_plugin_version(expected_version: str) -> None:
    package = json.loads((REPOSITORY_ROOT / "package.json").read_text(encoding="utf-8"))
    manifest = json.loads((REPOSITORY_ROOT / "manifest.json").read_text(encoding="utf-8"))
    versions = json.loads((REPOSITORY_ROOT / "versions.json").read_text(encoding="utf-8"))

    if package.get("version") != expected_version:
        raise RuntimeError(
            f"package.json version {package.get('version')} must equal {expected_version}"
        )
    if manifest.get("version") != expected_version:
        raise RuntimeError(
            f"manifest.json version {manifest.get('version')} must equal {expected_version}"
        )
    if versions.get(expected_version) != manifest.get("minAppVersion"):
        raise RuntimeError(
            f"versions.json must map {expected_version} to manifest.minAppVersion"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--bump", choices=BUMP_KINDS, required=True)
    parser.add_argument("--previous", action="store_true")
    parser.add_argument("--require-new-commits", action="store_true")
    parser.add_argument("--require-absent-tag", action="store_true")
    parser.add_argument("--require-plugin-version", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        previous_tag, next_tag = compute_release(args.bump)
        if args.require_new_commits:
            require_new_commits(previous_tag)
        if args.require_absent_tag:
            require_absent_tag(next_tag)
        if args.require_plugin_version:
            require_plugin_version(next_tag.removeprefix("v"))
    except (RuntimeError, ValueError, json.JSONDecodeError) as error:
        print(error, file=sys.stderr)
        return 1
    print(previous_tag if args.previous else next_tag)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
