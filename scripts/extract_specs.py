#!/usr/bin/env python3
"""Normalize product spec strings (e.g. "1-5LPM", "93% ± 3%", "45db") into typed
numeric + boolean fields, and merge them into the content JSON files under
src/content/{products,cpap-bipap}/ as a `normalized_specs` object that the browse
UI can filter on.

Reads and writes in place.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

SITE = Path.home() / "hhz-site"


def parse_number(s: str) -> float | None:
    if not s or s == "-":
        return None
    m = re.search(r"(\d+(?:\.\d+)?)", s)
    return float(m.group(1)) if m else None


def parse_range(s: str) -> tuple[float, float] | None:
    """Parse '1-5LPM' → (1,5), '90-96%' → (90,96), '93% ± 3%' → (90,96),
    '≤48 dB' → (0,48), '45dB' → (45,45)."""
    if not s:
        return None
    s = s.strip()
    if not s or s == "-":
        return None

    # "X ± Y"
    m = re.search(r"(\d+(?:\.\d+)?)\s*[±]\s*(\d+(?:\.\d+)?)", s)
    if m:
        c = float(m.group(1))
        sp = float(m.group(2))
        return (c - sp, c + sp)

    # "X-Y" or "X–Y" or "X—Y"
    m = re.search(r"(\d+(?:\.\d+)?)\s*[-–—]\s*(\d+(?:\.\d+)?)", s)
    if m:
        return (float(m.group(1)), float(m.group(2)))

    # "≤X", "<=X", "<X"
    m = re.search(r"[<≤]\s*=?\s*(\d+(?:\.\d+)?)", s)
    if m:
        return (0.0, float(m.group(1)))

    n = parse_number(s)
    return (n, n) if n is not None else None


_NO_VALUES = {"", "-", "no", "none", "not available", "n/a", "na", "nil"}


def is_yes(v: str | None) -> bool | None:
    """None if the spec wasn't present; True/False if it was."""
    if v is None:
        return None
    s = v.strip().lower()
    if s in _NO_VALUES:
        return False
    return True


def find_spec(combined: dict[str, str], *needles: str) -> str | None:
    """Return the first value whose key contains any needle (case-insensitive)."""
    lower = {k.lower(): v for k, v in combined.items()}
    for needle in needles:
        ndl = needle.lower()
        for key, value in lower.items():
            if ndl in key:
                return value
    return None


def find_exact(combined: dict[str, str], *needles: str) -> str | None:
    """Return the first value whose key EQUALS any needle (case-insensitive)."""
    lower = {k.lower(): v for k, v in combined.items()}
    for needle in needles:
        v = lower.get(needle.lower())
        if v is not None:
            return v
    return None


def extract(product: dict) -> dict:
    combined: dict[str, str] = {}
    combined.update(product.get("key_features") or {})
    for table in (product.get("spec_tables") or {}).values():
        combined.update(table)

    out: dict = {}

    # --- Weight (kg) ---
    w = find_spec(combined, "weight")
    if w:
        n = parse_number(w)
        if n is not None and 0 < n < 200:
            out["weight_kg"] = round(n, 2)

    # --- Flow (LPM) — concentrator output ---
    f = find_spec(combined, "continuous flow", "flow rate", "output flow", "flow range")
    if f:
        r = parse_range(f)
        if r and r[0] is not None and 0 <= r[0] < 50:
            out["flow_min_lpm"] = round(r[0], 1)
            out["flow_max_lpm"] = round(r[1], 1)

    # --- Pulse flow (bool) ---
    pf = find_spec(combined, "pulse flow", "pulse dose", "pulse mode")
    pf_yes = is_yes(pf)
    if pf_yes is not None:
        out["has_pulse_flow"] = pf_yes

    # --- Purity (%) — skip anything labeled "indicator" or "analyzer" ---
    # Scan keys; prefer "Purity" exact or "Oxygen Purity" over indicator/analyzer.
    purity_raw = None
    for k, v in combined.items():
        kl = k.lower()
        if "purity" not in kl:
            continue
        if "indicator" in kl or "analyzer" in kl or "opi" in kl:
            continue
        purity_raw = v
        break
    if purity_raw:
        r = parse_range(purity_raw)
        if r and r[0] is not None and 50 <= r[0] <= 100:
            out["purity_min"] = round(r[0], 1)
            out["purity_max"] = round(r[1], 1)

    # --- Noise / sound level (dB) ---
    noise_raw = find_spec(combined, "sound level", "noise level", "noise")
    if noise_raw:
        r = parse_range(noise_raw)
        if r and r[1] is not None and 10 <= r[1] <= 100:
            out["noise_db"] = round(r[1], 1)

    # --- Power consumption (W) ---
    pw = find_spec(combined, "power consumption", "power draw")
    if pw:
        n = parse_number(pw)
        if n is not None and 50 < n < 2000:
            out["power_w"] = round(n)

    # --- Pressure range (cmH2O) — CPAP/BiPAP ---
    # Only match CPAP/BiPAP-specific keys, not "Outlet pressure" (concentrator PSI output).
    pr = find_exact(combined, "Pressure Range", "Pressure range", "IPAP Range", "EPAP Range")
    if pr:
        r = parse_range(pr)
        if r and r[0] is not None and 2 <= r[0] <= 40 and r[1] <= 40:
            out["pressure_min_cmh2o"] = round(r[0], 1)
            out["pressure_max_cmh2o"] = round(r[1], 1)

    # --- Booleans ---
    h = find_spec(combined, "humidifier", "humidification")
    h_yes = is_yes(h)
    if h_yes is not None:
        out["has_humidifier"] = h_yes

    opi = find_spec(combined, "purity indicator", "oxygen purity indicator", "opi")
    opi_yes = is_yes(opi)
    if opi_yes is not None:
        out["has_opi"] = opi_yes

    faa = find_exact(combined, "FAA Approved", "FAA approved")
    faa_yes = is_yes(faa)
    if faa_yes is not None:
        out["faa_approved"] = faa_yes

    ce = find_exact(combined, "CE Certified", "CE Certification")
    ce_yes = is_yes(ce)
    if ce_yes is not None:
        out["ce_certified"] = ce_yes

    indian = find_spec(combined, "indian voltage")
    indian_yes = is_yes(indian)
    if indian_yes is not None:
        out["indian_voltage"] = indian_yes

    # --- Warranty (years) ---
    wa = find_spec(combined, "warranty")
    if wa:
        n = parse_number(wa)
        if n is not None and 0 < n <= 10:
            out["warranty_years"] = round(n, 1)

    # --- Altitude (feet) ---
    alt = find_spec(combined, "operating altitude", "max altitude")
    if alt:
        n = parse_number(alt)
        if n is not None:
            out["altitude_ft"] = round(n)

    return out


def update_dir(dir_path: Path) -> tuple[int, dict[str, int]]:
    updated = 0
    field_counts: dict[str, int] = {}
    for f in sorted(dir_path.glob("*.json")):
        product = json.loads(f.read_text())
        normalized = extract(product)
        product["normalized_specs"] = normalized
        f.write_text(
            json.dumps(product, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        updated += 1
        for k in normalized:
            field_counts[k] = field_counts.get(k, 0) + 1
    return updated, field_counts


def main() -> int:
    for subdir in ("products", "cpap-bipap"):
        dir_path = SITE / "src" / "content" / subdir
        updated, counts = update_dir(dir_path)
        print(f"\n=== {subdir}: updated {updated} files ===")
        for key in sorted(counts, key=lambda k: -counts[k]):
            print(f"  {counts[key]:4d}  {key}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
