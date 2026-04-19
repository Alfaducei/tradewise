"""
Congress-legislator lookup: name → bioguide_id → official photo URL.

Source: unitedstates/congress-legislators JSON (open-data project, served
via GitHub Pages). Photos come from bioguide.congress.gov, the official
Congressional biographical directory. Both are free, public, and stable.

One fetch per 7 days (members only change after elections).
"""
from __future__ import annotations
import httpx
import logging
import re
import time

logger = logging.getLogger(__name__)

LEGISLATORS_URL = "https://unitedstates.github.io/congress-legislators/legislators-current.json"
PHOTO_URL_TEMPLATE = "https://bioguide.congress.gov/photo/{bioguide}.jpg"
_CACHE_TTL = 7 * 24 * 3600  # 7 days

# Party lookup: latest term's party ('Democrat'/'Republican'/'Independent').
_state: dict = {
    "at": 0.0,
    "by_full": {},   # "dan sullivan" → bioguide
    "by_last": {},   # "sullivan" → bioguide (only if unique)
    "party": {},     # bioguide → 'D'/'R'/'I'
}


def _norm(s: str) -> str:
    """Lowercase, strip punctuation, collapse whitespace."""
    s = re.sub(r"[.,'`\"]", "", (s or "").lower())
    return re.sub(r"\s+", " ", s).strip()


def _strip_middle_initial(full: str) -> str:
    """'W. Gregory Steube' → 'gregory steube' (drop single-letter tokens)."""
    tokens = [t for t in _norm(full).split() if len(t) > 1]
    return " ".join(tokens)


async def _refresh() -> None:
    try:
        async with httpx.AsyncClient(timeout=20) as client:
            r = await client.get(LEGISLATORS_URL)
            r.raise_for_status()
            data = r.json()
    except Exception as e:
        logger.warning(f"Could not load legislators JSON: {e}")
        _state["at"] = time.time()  # avoid hammering on repeated failures
        return

    by_full: dict[str, str] = {}
    by_last: dict[str, str] = {}
    last_collisions: set[str] = set()
    party: dict[str, str] = {}

    for m in data:
        bioguide = (m.get("id") or {}).get("bioguide", "")
        if not bioguide:
            continue
        name = m.get("name") or {}
        first = name.get("first", "")
        last = name.get("last", "")
        official = name.get("official_full") or f"{first} {last}"
        nickname = name.get("nickname") or ""

        for variant in filter(None, {official, f"{first} {last}", _strip_middle_initial(official),
                                     f"{nickname} {last}" if nickname else ""}):
            by_full[_norm(variant)] = bioguide

        last_key = _norm(last)
        if last_key in by_last and by_last[last_key] != bioguide:
            last_collisions.add(last_key)
        else:
            by_last[last_key] = bioguide

        terms = m.get("terms") or []
        if terms:
            p = (terms[-1].get("party") or "").strip()
            party[bioguide] = p[:1].upper() if p else ""

    for k in last_collisions:
        by_last.pop(k, None)

    _state["by_full"] = by_full
    _state["by_last"] = by_last
    _state["party"] = party
    _state["at"] = time.time()
    logger.info(f"Legislators loaded: {len(by_full)} name variants, {len(by_last)} unique last names")


async def _ensure_loaded() -> None:
    if time.time() - _state["at"] < _CACHE_TTL and _state["by_full"]:
        return
    await _refresh()


async def resolve(first: str, last: str, official_full: str = "") -> tuple[str, str]:
    """Return (photo_url, party_letter). Empty strings when not matched."""
    await _ensure_loaded()
    candidates = [
        official_full,
        f"{first} {last}",
        _strip_middle_initial(official_full or f"{first} {last}"),
    ]
    for c in candidates:
        key = _norm(c)
        if key and key in _state["by_full"]:
            bio = _state["by_full"][key]
            return PHOTO_URL_TEMPLATE.format(bioguide=bio), _state["party"].get(bio, "")
    last_key = _norm(last)
    if last_key and last_key in _state["by_last"]:
        bio = _state["by_last"][last_key]
        return PHOTO_URL_TEMPLATE.format(bioguide=bio), _state["party"].get(bio, "")
    return "", ""
