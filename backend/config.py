"""Pydantic v2 config models + YAML loader (plan §8, reduced schema).

Reduced schema: ``server``, ``cscli``, ``logging`` only. Legacy ``auth`` /
``session`` blocks are tolerated and ignored via ``extra="ignore"``.

Importing this module MUST NOT read any file — it is pure models +
functions (task-03/task-04 call ``load_config``/``resolve_cscli_path``).
"""

import functools
import re
from pathlib import Path

import yaml
from pydantic import BaseModel, ConfigDict, Field, field_validator

_FALLBACK_CSCLI_PATHS = [
    "/usr/bin/cscli",
    "/usr/local/bin/cscli",
    "/opt/crowdsec/bin/cscli",
]

_TIMEOUT_RE = re.compile(r"^(\d+)s$")


class ServerConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")

    bind: str = "127.0.0.1"
    port: int = 8090
    static_dir: str | None = None

    @field_validator("bind")
    @classmethod
    def _bind_not_wildcard(cls, v: str) -> str:
        if v == "0.0.0.0":
            raise ValueError("server.bind 0.0.0.0 is not allowed; bind to loopback or a NIC IP")
        return v

    @field_validator("port")
    @classmethod
    def _port_not_lapi(cls, v: int) -> int:
        if v == 8080:
            raise ValueError("server.port 8080 is reserved for CrowdSec LAPI")
        return v


class CscliConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")

    executable_path: str | None = None
    timeout: str = "30s"

    @field_validator("timeout")
    @classmethod
    def _timeout_syntax(cls, v: str) -> str:
        m = _TIMEOUT_RE.fullmatch(v)
        if m is None:
            raise ValueError("cscli.timeout must match ^\\d+s$ (e.g. '30s')")
        seconds = int(m.group(1))
        if not 1 <= seconds <= 120:
            raise ValueError("cscli.timeout must be between 1s and 120s")
        return v


class LoggingConfig(BaseModel):
    model_config = ConfigDict(extra="ignore")

    level: str = "info"
    format: str = "text"
    output: str = "stderr"

    @field_validator("level")
    @classmethod
    def _level_allowed(cls, v: str) -> str:
        if v not in {"debug", "info", "warn", "error"}:
            raise ValueError("logging.level must be one of: debug, info, warn, error")
        return v

    @field_validator("format")
    @classmethod
    def _format_allowed(cls, v: str) -> str:
        if v not in {"text", "json"}:
            raise ValueError("logging.format must be one of: text, json")
        return v

    @field_validator("output")
    @classmethod
    def _output_allowed(cls, v: str) -> str:
        if not v:
            raise ValueError("logging.output must be 'stderr', 'stdout', or a file path")
        return v


class Config(BaseModel):
    model_config = ConfigDict(extra="ignore")

    server: ServerConfig = Field(default_factory=ServerConfig)
    cscli: CscliConfig = Field(default_factory=CscliConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)

    @functools.cached_property
    def cscli_timeout_seconds(self) -> int:
        """Parsed ``cscli.timeout`` in whole seconds (already validated)."""
        return int(self.cscli.timeout[:-1])


def load_config(path: Path | str) -> Config:
    """Load *path* (reduced YAML schema) into a validated ``Config``.

    A missing (or empty) file yields a default ``Config()`` built purely
    from model defaults — ``cscli.executable_path`` stays ``None`` until
    task-03's probe resolver fills it.
    """
    p = Path(path)
    if not p.is_file():
        return Config()
    data = yaml.safe_load(p.read_text(encoding="utf-8"))
    if data is None:
        return Config()
    if not isinstance(data, dict):
        raise ValueError("config file must contain a YAML mapping (server/cscli/logging)")
    return Config(**data)


def resolve_cscli_path(cfg: Config) -> str | None:
    """Resolve the cscli executable path (config first, then fallbacks).

    Returns the configured path when set and present on disk; otherwise the
    first existing fallback; otherwise ``None`` (probes then mark all ops
    ``unsupported``).
    """
    if cfg.cscli.executable_path:
        configured = Path(cfg.cscli.executable_path)
        if configured.is_file():
            return str(configured)
    for candidate in _FALLBACK_CSCLI_PATHS:
        if Path(candidate).is_file():
            return candidate
    return None
