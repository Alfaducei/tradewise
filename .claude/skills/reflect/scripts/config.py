#!/usr/bin/env python3
"""
Centralized configuration for reflect scripts.
Provides paths and settings that can be overridden via environment variables.
"""

import os
from pathlib import Path


def get_skills_dir() -> Path:
    """
    Get the skills directory path.

    Can be overridden with CLAUDE_SKILLS_DIR environment variable.
    Defaults to ~/.claude/skills

    Returns:
        Path: Absolute path to skills directory
    """
    env_path = os.getenv('CLAUDE_SKILLS_DIR')
    if env_path:
        return Path(env_path).expanduser().resolve()
    return Path.home() / '.claude' / 'skills'


def get_reflect_dir() -> Path:
    """
    Get the reflect data directory path.

    Can be overridden with CLAUDE_REFLECT_DIR environment variable.
    Defaults to ~/.claude/reflect

    Returns:
        Path: Absolute path to reflect directory
    """
    env_path = os.getenv('CLAUDE_REFLECT_DIR')
    if env_path:
        return Path(env_path).expanduser().resolve()
    return Path.home() / '.claude' / 'reflect'


def get_session_dir() -> Path:
    """
    Get the session directory path.

    Can be overridden with SESSION_DIR environment variable.
    Defaults to ~/.claude/session-env

    Returns:
        Path: Absolute path to session directory
    """
    env_path = os.getenv('SESSION_DIR')
    if env_path:
        return Path(env_path).expanduser().resolve()
    return Path.home() / '.claude' / 'session-env'


def get_global_claude_md() -> Path:
    """
    Get the global CLAUDE.md file path.

    Can be overridden with CLAUDE_GLOBAL_MD environment variable.
    Defaults to ~/.claude/CLAUDE.md

    Returns:
        Path: Absolute path to global CLAUDE.md
    """
    env_path = os.getenv('CLAUDE_GLOBAL_MD')
    if env_path:
        return Path(env_path).expanduser().resolve()
    return Path.home() / '.claude' / 'CLAUDE.md'


def get_backup_dir() -> Path:
    """
    Get the backups directory path.

    Can be overridden with CLAUDE_BACKUP_DIR environment variable.
    Defaults to ~/.claude/backups

    Returns:
        Path: Absolute path to backups directory
    """
    env_path = os.getenv('CLAUDE_BACKUP_DIR')
    if env_path:
        return Path(env_path).expanduser().resolve()
    return Path.home() / '.claude' / 'backups'


# Configurable constants
LOCK_TIMEOUT_SECONDS = int(os.getenv('CLAUDE_LOCK_TIMEOUT', '600'))  # 10 minutes default
BACKUP_RETENTION_DAYS = int(os.getenv('CLAUDE_BACKUP_RETENTION_DAYS', '30'))
SEMANTIC_ANALYSIS_ENABLED = os.getenv('CLAUDE_SEMANTIC_ANALYSIS', 'true').lower() == 'true'


def get_config_summary() -> dict:
    """
    Get a summary of current configuration.

    Returns:
        dict: Configuration values
    """
    return {
        'skills_dir': str(get_skills_dir()),
        'reflect_dir': str(get_reflect_dir()),
        'session_dir': str(get_session_dir()),
        'global_claude_md': str(get_global_claude_md()),
        'backup_dir': str(get_backup_dir()),
        'lock_timeout_seconds': LOCK_TIMEOUT_SECONDS,
        'backup_retention_days': BACKUP_RETENTION_DAYS,
        'semantic_analysis_enabled': SEMANTIC_ANALYSIS_ENABLED,
    }


if __name__ == '__main__':
    # Print configuration when run directly
    import json
    print(json.dumps(get_config_summary(), indent=2))
