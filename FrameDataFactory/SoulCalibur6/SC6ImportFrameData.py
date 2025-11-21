
import pandas as pd
import sys
import re
import os
import json
from pathlib import Path



def project_root() -> Path:
    # This file lives in FrameDataFactory/SoulCalibur6 -> root is two levels up
    return Path(sys.path[0]).parent.parent


frameDataSheetLink = "https://docs.google.com/spreadsheets/d/1R3I_LXfqhvFjlHTuj-wSWwwqYmlUf299a3VY9pVyGEw/export?exportFormat=csv"
frameData = pd.read_csv(
    filepath_or_buffer=frameDataSheetLink,
    skiprows=3,
    index_col=4
)

#Id to matchz
frameData.reset_index(inplace=True)
idOffset = 5
frameData["ID"] = list(range(idOffset, len(frameData) + idOffset))


# Remove the column named 'Unnamed'
frameData.drop(columns=[col for col in frameData.columns if 'Unnamed' in col], inplace=True)

# Normalize Character casing (capitalize first letter only when possible)
def normalize_character(name):
    if isinstance(name, str) and len(name) > 0:
        return name[0].upper() + name[1:]
    return name

frameData["Character"] = frameData["Character"].apply(normalize_character)

# Sum damage 
def sumAndCleanDamage(row):
    if(str(row) == "nan"):
        return 0
    elif str(row) == "77(50)":
        return 77

    hits = []
    # Convert Comma seperated damage to float list
    for num in str(row).split(","):
        num = num.replace("(", "").replace(")", "").replace("-", "")
        if str(num) =="5.5.12":
            hits = [5.0, 5.0, 12.0]
        elif str(num) == "":
            hits.append(0.0)
        else:
            hits.append(float(num))

    return int(sum(hits))

frameData["DamageDec"] = frameData["Damage"].apply(lambda x: sumAndCleanDamage(x))

# Create Block decimal
def cleanUpBlock(block):
    blockClean = re.findall(r'[-+]?\d+', str(block))

    if(len(blockClean) == 0):
        return None
    else:
        return int(blockClean[0])

frameData["BlockDec"] = frameData["Block"].apply(lambda x: cleanUpBlock(x))


# Create Hit decimal
def cleanUpHit(hit):
    hitClean = re.findall(r'[-+]?\d+', str(hit))

    if(len(hitClean) == 0):
        return None
    else:
        return int(hitClean[0])

frameData["HitDec"] = frameData["Hit"].apply(lambda x: cleanUpHit(x))


# Create CounterHit decimal
def cleanUpCounterHit(ch):
    if(str(ch) in ["LNC, STN (2nd)"]):
        return None
    

    chClean = re.findall(r'[-+]?\d+', str(ch))
    if(len(chClean) == 0):
        return None
    else:
        return int(chClean[0])

frameData["CounterHitDec"] = frameData["Counter Hit"].apply(lambda x: cleanUpCounterHit(x))

# PostProcess.sql: translate to universal command format (K->C, k->c, G->D, g->d)
def translate_command(cmd):
    if not isinstance(cmd, str):
        return cmd
    return (
        cmd.replace('K', 'C')
           .replace('k', 'c')
           .replace('G', 'D')
           .replace('g', 'd')
    )

frameData["Command"] = frameData["Command"].apply(translate_command)

# Compute flag columns as in PostProcess (not used in JSON, but kept here if needed later)
def note_has(note, token: str) -> bool:
    try:
        return token in str(note)
    except Exception:
        return False

frameData["isUB"] = frameData["Notes"].apply(lambda n: 1 if note_has(n, ":UA:") and True else 0)
frameData["isBA"] = frameData["Notes"].apply(lambda n: 1 if note_has(n, ":BA:") and True else 0)
frameData["isGI"] = frameData["Notes"].apply(lambda n: 1 if note_has(n, ":GI:") and True else 0)
frameData["isTH"] = frameData["Notes"].apply(lambda n: 1 if note_has(n, ":TH:") and True else 0)
frameData["isSS"] = frameData["Notes"].apply(lambda n: 1 if note_has(n, ":SS:") and True else 0)
frameData["isRE"] = frameData.apply(lambda r: 1 if note_has(r.get("Notes"), ":RE:") or (isinstance(r.get("Stance"), str) and ("RE" in r.get("Stance"))) else 0, axis=1)
frameData["isLH"] = frameData["Notes"].apply(lambda n: 1 if note_has(n, ":LH:") and True else 0)

# Prepare Characters list (dedupe and sort)
characters = sorted(set([c for c in frameData["Character"].dropna().tolist()]))
characters_manifest = [
    {"id": idx + 1, "name": name}
    for idx, name in enumerate(characters)
]
char_id_map = {c["name"]: c["id"] for c in characters_manifest}

# Assign CharacterID
frameData["CharacterID"] = frameData["Character"].map(char_id_map)

# Helpers to coerce values for JSON
def to_int_or_none(v):
    try:
        if pd.isna(v):
            return None
    except Exception:
        pass
    try:
        return int(v)
    except Exception:
        try:
            return int(float(v))
        except Exception:
            return None

def to_str_or_none(v):
    try:
        if pd.isna(v):
            return None
    except Exception:
        pass
    return str(v) if v is not None else None

# Export to JSON under public/SoulCalibur6
root = project_root()
output_base = root / "public" / "Games" / "SoulCalibur6"
moves_dir = output_base / "Characters"
os.makedirs(moves_dir, exist_ok=True)

# Write Characters.json
with open(output_base / "Characters.json", "w", encoding="utf-8") as f:
    json.dump(characters_manifest, f, ensure_ascii=False, indent=2)

# Columns mapping to UI Move interface
def move_row_to_dict(row: pd.Series):
    return {
        "ID": to_int_or_none(row.get("ID")),
        "Command": to_str_or_none(row.get("Command")),
        "Stance": to_str_or_none(row.get("Stance")),
        "HitLevel": to_str_or_none(row.get("Hit level")),
        "Impact": to_int_or_none(row.get("Impact")),
        "Damage": to_str_or_none(row.get("Damage")),
        "DamageDec": to_int_or_none(row.get("DamageDec")),
        "Block": to_str_or_none(row.get("Block")),
        "BlockDec": to_int_or_none(row.get("BlockDec")),
        "Hit": to_str_or_none(row.get("Hit")),
        "HitDec": to_int_or_none(row.get("HitDec")),
        "CounterHit": to_str_or_none(row.get("Counter Hit")),
        "CounterHitDec": to_int_or_none(row.get("CounterHitDec")),
        "GuardBurst": to_int_or_none(row.get("Guard Burst")),
        "Notes": to_str_or_none(row.get("Notes")),
    }

# Per-character files
for c in characters_manifest:
    cid = c["id"]
    cname = c["name"]
    moves_df = frameData[frameData["Character"] == cname]
    moves_list = [move_row_to_dict(row) for _, row in moves_df.iterrows()]
    with open(moves_dir / f"{cid}.json", "w", encoding="utf-8") as f:
        json.dump(moves_list, f, ensure_ascii=False, indent=2)


