"""Import Peters_May_WhatsApp_Enquiry_Tracker.xlsx rows into whatsapp_enquiries."""
from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

try:
    import urllib.request
except ImportError:
    raise

base = Path(__file__).resolve().parent
root = base.parent
env_path = root / ".env.local"


def load_env(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        out[k.strip()] = v.strip().strip('"').strip("'")
    return out


def hub_status(s: str | None) -> str:
    s = (s or "").strip().lower()
    if s in ("quoted", "sent to accounts"):
        return "done"
    if s in ("", "unknown"):
        return "new"
    return "in_progress"


def to_row(r: dict) -> dict | None:
    eid = str(r.get("ID") or "").strip()
    if not eid:
        return None
    rid = "wa_" + re.sub(r"[^a-zA-Z0-9_-]+", "_", eid)
    created = r.get("Date Sent to Office")
    created_at = f"{created}T00:00:00Z" if created else None
    office = (r.get("Team / Office Sent To") or "").strip()
    service = (r.get("Enquiry Type") or "").strip()
    vessel = (r.get("Vessel / Cargo") or "").strip()
    origin = (r.get("Origin / Collection") or "").strip()
    dest = (r.get("Destination") or "").strip()
    dims = (r.get("Dimensions / Key Specs") or "").strip()
    timeframe = (r.get("Preferred Timeframe") or "").strip()
    excel_status = (r.get("Status") or "").strip()
    notes = (r.get("Notes") or "").strip()
    company = (r.get("Company") or "").strip()
    category = (r.get("Category") or "").strip()
    chase = (r.get("Follow-up / Chase Date") or "").strip()
    value = r.get("Declared / Insured Value")

    msg_bits = [
        x
        for x in [
            service,
            vessel,
            (f"{origin} → {dest}" if origin or dest else ""),
            dims,
            (f"Timeframe: {timeframe}" if timeframe else ""),
        ]
        if x
    ]
    note_bits = [
        x
        for x in [
            notes,
            (f"Excel status: {excel_status}" if excel_status else ""),
            (f"Company: {company}" if company else ""),
            (f"Category: {category}" if category else ""),
            (f"Chase: {chase}" if chase else ""),
            (f"Value: {value}" if value not in (None, "") else ""),
        ]
        if x
    ]

    return {
        "id": rid,
        "external_id": eid,
        "created_at": created_at,
        "customer_name": (r.get("Customer") or "").strip(),
        "customer_email": (r.get("Email") or "").strip(),
        "customer_phone": (r.get("Telephone") or "").strip(),
        "customer_country": "",
        "service": service,
        "collection_location": origin,
        "delivery_location": dest,
        "selected_office": office,
        "office_email": "",
        "message": " | ".join(msg_bits),
        "notes": " | ".join(note_bits),
        "needs_manual_review": not bool(office),
        "is_test": False,
        "status": hub_status(excel_status),
        "raw_payload": {
            "source": "excel_import",
            "import_file": "Peters_May_WhatsApp_Enquiry_Tracker.xlsx",
            "excel_id": eid,
            "excel_status": excel_status,
            "company": company,
            "category": category,
            "vessel_cargo": vessel,
            "dimensions": dims,
            "declared_value": value,
            "preferred_timeframe": timeframe,
            "follow_up_date": chase,
            "email_subject": (r.get("Email Subject") or "").strip(),
            "tracker_source": (r.get("Source") or "").strip(),
        },
        "received_at": created_at,
        "updated_at": created_at or None,
    }


def main() -> int:
    env = load_env(env_path)
    url = env.get("NEXT_PUBLIC_SUPABASE_URL", "").rstrip("/")
    key = env.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not key:
        print("Missing Supabase URL or service role key", file=sys.stderr)
        return 1

    rows = json.loads((base / "_wa_import.json").read_text(encoding="utf-8"))
    payload = [row for row in (to_row(r) for r in rows) if row]
    # Ensure updated_at / received_at have values
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    for row in payload:
        if not row.get("updated_at"):
            row["updated_at"] = now
        if not row.get("received_at"):
            row["received_at"] = now
        if not row.get("created_at"):
            row["created_at"] = now

    endpoint = f"{url}/rest/v1/whatsapp_enquiries?on_conflict=external_id"
    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        endpoint,
        data=body,
        method="POST",
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "resolution=merge-duplicates,return=representation",
        },
    )
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        err = getattr(e, "read", lambda: b"")()
        print(f"Import failed: {e}", file=sys.stderr)
        if err:
            print(err.decode("utf-8", errors="replace"), file=sys.stderr)
        return 1

    print(json.dumps({"imported": len(data), "external_ids": [d.get("external_id") for d in data[:5]], "total_returned": len(data)}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
