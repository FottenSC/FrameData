
import pandas as pd
import sys
import re
import os
import json
from pathlib import Path


def project_root() -> Path:
    return Path(sys.path[0]).parent.parent


print("Loading Soulcalibur 6 Frame Data from Google Sheets...")
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

# Store the original command before translation
frameData["stringCommand"] = frameData["Command"].copy()
frameData["Command"] = frameData["Command"].apply(translate_command)

# Extract properties from Notes column into a Properties array
def note_has(note, token: str) -> bool:
    try:
        return token in str(note)
    except Exception:
        return False

# Property tokens to check for in Notes
PROPERTY_TOKENS = {
    ":UA:": "UA",  # Unblockable
    ":BA:": "BA",  # Break Attack
    ":GI:": "GI",  # Guard Impact
    ":TH:": "TH",  # Throw
    ":SS:": "SS",  # Soul Strike
    ":RE:": "RE",  # Reversal Edge
    ":LH:": "LH",  # Lethal Hit
}

def extract_properties(row):
    """Extract properties from Notes and Stance columns into a list."""
    properties = []
    notes = row.get("Notes")
    stance = row.get("Stance")
    
    for token, prop_name in PROPERTY_TOKENS.items():
        if note_has(notes, token):
            properties.append(prop_name)
    
    # Special case: RE can also be detected from Stance
    if "RE" not in properties:
        if isinstance(stance, str) and "RE" in stance:
            properties.append("RE")
    
    return properties if properties else None

frameData["Properties"] = frameData.apply(extract_properties, axis=1)


# Stance case fixer
stanceTranslator = [
    ["bt", "BT"],
    ["enemy in sc", "Enemy in SC"],
    ["sch", "SCH"],
    ["sc", "SC"],

    ["back throw", "Back Side"],
    ["back side throw", "Back Side"],
    ["left side throw", "Left Side"],
    ["left side", "Left Side"],
    ["left", "Left Side"],
    ["right side throw", "Right Side"],
    ["right side", "Right Side"],
    ["right", "Right Side"],
    ["re  second round", "RE2"],
    ["re  2nd round", "RE2"],
    ["se mid-air opponent", "SE Midair Opponent"],
    ["downed opponent", "Downed Opponent"],
    ["manji dragonfly", ""],
    ["midair opponent", "Midair Opponent"],
    ["even activation", "even activation"],
    ["sky  stage iii", "SKY stage III"],
    ["odd activation", "odd activation"],
    ["during motion", "During Motion"],
    ["indian stance", ""],
    ["sky  stage ii", "SKY stage II"],
    ["sky  stage i", "SKY stage I"],
    ["flea stance", ""],
    ["short hold", "Short"],
    ["short hold", "Short"],
    ["full hold", "Full"],
    ["weaponless", "Weaponless"],
    ["tip range", "Tip"],
    ["vs crouch", "vs crouch"],
    ["any stance", "Any Stance"],
    ["grounded", "GROUNDED"],
    ["mcft far", "MCFT far"],
    ["almighty", "almighty"],
    ["partial", "partial"],
    ["revenge", "Revenge"],
    ["medium", "Medium"],
    ["evade", "Evade"],
    ["shura", "Shura"],
    ["quake", "Quake"],
    ["short", "Short"],
    ["spear", "spear"],
    ["sword", "sword"],
    ["wall", "Wall"],
    ["down", "DOWN"],
    ["down", "Down"],
    ["jump", "JUMP"],
    ["mcft", "MCFT"],
    ["mcht", "MCHT"],
    ["sgdf", "SGDF"],
    ["srsh", "SRSH"],
    ["long", "Long"],
    ["full", "Full"],
    ["miss", "Miss"],
    ["tip", "Tip"],
    ["ags", "AGS"],
    ["air", "AIR"],
    ["ang", "ANG"],
    ["avn", "AVN"],
    ["bhh", "BHH"],
    ["bkn", "BKN"],
    ["bob", "BOB"],
    ["coe", "COE"],
    ["dgf", "DGF"],
    ["fle", "FLE"],
    ["ind", "IND"],
    ["mst", "MST"],
    ["nbs", "NBS"],
    ["nls", "NLS"],
    ["nss", "NSS"],
    ["ntc", "NTC"],
    ["pxs", "PXS"],
    ["rlc", "RLC"],
    ["rrp", "RRP"],
    ["run", "RUN"],
    ["rxp", "RXP"],
    ["sbh", "SBH"],
    ["spr", "SPR"],
    ["ssh", "SSH"],
    ["ssr", "SSR"],
    ["stg", "STG"],
    ["stk", "STK"],
    ["swr", "SWR"],
    ["sxs", "SXS"],
    ["tas", "TAS"],
    ["tow", "TOW"],
    ["ts1", "TS1"],
    ["ts2", "TS2"],
    ["ts3", "TS3"],
    ["wnb", "WNB"],
    ["wnc", "WNC"],
    ["wnf", "WNF"],
    ["wns", "WNS"],
    ["wro", "WRO"],
    ["wrp", "WRP"],
    ["woh", "WoH"],
    ["yyt", "YYT"],
    ["on hit", "Hit"],
    ["hit", "Hit"],
    ["run", "Run"],
    ["sky", "Sky"],
    ["lh", "LH"],
    ["ag", "AG"],
    ["dr", "DR"],
    ["ts", "TS"],
    ["al", "AL"],
    ["as", "AS"],
    ["at", "AT"],
    ["be", "BE"],
    ["bl", "BL"],
    ["bp", "BP"],
    ["bs", "BS"],
    ["ch", "CH"],
    ["cr", "CR"],
    ["db", "DB"],
    ["dc", "DC"],
    ["df", "DF"],
    ["dl", "DL"],
    ["ds", "DS"],
    ["dw", "DW"],
    ["fc", "FC"],
    ["fj", "FJ"],
    ["gi", "GI"],
    ["gs", "GS"],
    ["hl", "HL"],
    ["hp", "HP"],
    ["js", "JS"],
    ["li", "LI"],
    ["lo", "LO"],
    ["lp", "LP"],
    ["ls", "LS"],
    ["mc", "MC"],
    ["mo", "MO"],
    ["mp", "MP"],
    ["ms", "MS"],
    ["ng", "NG"],
    ["po", "PO"],
    ["pr", "PR"],
    ["qp", "QP"],
    ["rc", "RC"],
    ["re", "RE"],
    ["rg", "RG"],
    ["ro", "RO"],
    ["rs", "RS"],
    ["rt", "RT"],
    ["se", "SE"],
    ["sg", "SG"],
    ["sl", "SL"],
    ["ss", "SS"],
    ["ud", "UD"],
    ["vg", "VG"],
    ["vs", "VS"],
    ["wd", "WD"],
    ["wf", "WF"],
    ["wr", "WR"],
    ["ws", "WS"],
    ["wt", "WT"],
    ["ax", "ax"],
    ["c", "c"],
]

alreadyExported = {}

def caseFixer(stance):
    stances = []
    originalStance = stance

    if not isinstance(stance, str):
        return stance

    for test in stanceTranslator:
        keepLooping = True
        while keepLooping:
            if test[0] in stance.lower():
                stances.append(test[1])
                stance = stance.lower().replace(test[0], "")
            else:
                keepLooping = False
        
    # if (not alreadyExported.get(originalStance)):
    #     with open("debugStances.txt", "a", encoding="utf-8") as f:
    #         f.write(f"{stances} , {originalStance}\n")
    # alreadyExported[originalStance] = True

    stance = stance.strip()
    if len(stance) > 0:
        print(f"Warning: Unknown stance case: {stance} | output {stances} | Original: {originalStance}")
        
    return stances

frameData["Stance"] = frameData["Stance"].apply(caseFixer)



#region Character and Stance export
root = project_root()
output_base = root / "public" / "Games" / "Soulcalibur6"
moves_dir = output_base / "Characters"
os.makedirs(moves_dir, exist_ok=True)

# Read existing Game.json to preserve user-edited data
existing_game_data = {}
game_json_path = output_base / "Game.json"
if game_json_path.exists():
    try:
        with open(game_json_path, "r", encoding="utf-8") as f:
            existing_game_data = json.load(f)
    except (json.JSONDecodeError, IOError) as e:
        print(f"Warning: Could not read existing Game.json: {e}")

# Preserve existing game-level stances (shared stances moved from characters)
existing_game_stances = existing_game_data.get("stances", {})
existing_game_properties = existing_game_data.get("properties", {})
existing_characters = {c["name"]: c for c in existing_game_data.get("characters", [])}

# Get max character ID from existing data for new entries
max_char_id = max((c.get("id", 0) for c in existing_game_data.get("characters", [])), default=0)

# Build characters manifest with per-character stances
characters = sorted(set([c for c in frameData["Character"].dropna().tolist()]))
characters_manifest = []

for name in characters:
    # Get existing character data if available
    existing_char = existing_characters.get(name, {})
    existing_char_stances = existing_char.get("stances", {})
    # Handle legacy array format
    if isinstance(existing_char_stances, list):
        existing_char_stances = {s.get("name", ""): s for s in existing_char_stances}
    
    # Get character ID (preserve existing or assign new)
    if "id" in existing_char:
        char_id = existing_char["id"]
    else:
        max_char_id += 1
        char_id = max_char_id
    
    # Extract stances for this character from the frame data
    char_moves = frameData[frameData["Character"] == name]
    char_stances = set()
    for stance_list in char_moves["Stance"].dropna():
        if isinstance(stance_list, list):
            for s in stance_list:
                if s and isinstance(s, str):
                    char_stances.add(s)
    
    # Build stances dict for this character, preserving existing data
    # Skip stances that have been moved to game-level stances
    stances_dict = {}
    for stance_name in sorted(char_stances):
        # Skip if this stance exists in game-level stances (it's been moved to shared)
        if stance_name in existing_game_stances:
            continue
            
        if stance_name in existing_char_stances:
            # Preserve existing stance data (including user-edited name/description)
            existing_stance = existing_char_stances[stance_name]
            stances_dict[stance_name] = {
                "name": existing_stance.get("name", ""),
                "description": existing_stance.get("description", "")
            }
        else:
            # New stance with blank name and description
            stances_dict[stance_name] = {
                "name": "",
                "description": ""
            }
    
    char_entry = {
        "id": char_id,
        "name": name,
        "stances": stances_dict
    }
    if "image" in existing_char:
        char_entry["image"] = existing_char["image"]
        
    characters_manifest.append(char_entry)

char_id_map = {c["name"]: c["id"] for c in characters_manifest}
frameData["CharacterID"] = frameData["Character"].map(char_id_map)

# Build properties dict, preserving existing user-edited data
properties_dict = {}
for prop_key in PROPERTY_TOKENS.values():
    if prop_key in existing_game_properties:
        # Preserve existing property data (including user-edited name/description)
        existing_prop = existing_game_properties[prop_key]
        properties_dict[prop_key] = {
            "name": existing_prop.get("name", ""),
            "description": existing_prop.get("description", ""),
            "className": existing_prop.get("className", "")
        }
    else:
        # New property with blank name and description
        properties_dict[prop_key] = {
            "name": "",
            "description": "",
            "className": ""
        }

# Write Game.json
game_manifest = {
    "properties": properties_dict,
    "stances": existing_game_stances,
    "hitLevels": existing_game_data.get("hitLevels", {
        "H": {"name": "High", "description": "", "className": "bg-pink-500"},
        "M": {"name": "Mid", "description": "", "className": "bg-yellow-500"},
        "L": {"name": "Low", "description": "", "className": "bg-cyan-500"},
        "SM": {"name": "Special Mid", "description": "", "className": "bg-purple-500"},
        "SL": {"name": "Special Low", "description": "", "className": "bg-cyan-500"}
    }),
    "characters": characters_manifest
}
with open(game_json_path, "w", encoding="utf-8") as f:
    json.dump(game_manifest, f, ensure_ascii=False, indent=2)
#endregion Character and Stance export


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

def toArrayOrNone(v):
    try:
        if pd.isna(v):
            return None
    except Exception:
        pass
    if isinstance(v, list):
        return v
    return None

def split_by_delimiter(value, delimiter="::"):
    """Split string by delimiter and filter out empty strings, return None if invalid"""
    try:
        if pd.isna(value):
            return None
    except Exception:
        pass
    if not isinstance(value, str):
        return None
    # Split by :: first
    parts = value.split(delimiter)
    
    # Process each part, keeping _ as a separate element
    final_parts = []
    for part in parts:
        if part:
            # Check if this part contains :_: separator
            if ":_:" in part:
                sub_parts = part.split(":_:")
                for i, sub in enumerate(sub_parts):
                    cleaned = sub.strip().strip(":")
                    if cleaned:
                        final_parts.append(cleaned)
                    # Add _ separator between sub-parts (not after the last one)
                    if i < len(sub_parts) - 1:
                        final_parts.append("_")
            else:
                cleaned = part.strip().strip(":")
                if cleaned:
                    final_parts.append(cleaned)
    
    return final_parts if final_parts else None

# Columns mapping to UI Move interface
def move_row_to_dict(row: pd.Series):
    return {
        "ID": to_int_or_none(row.get("ID")),
        "stringCommand": to_str_or_none(row.get("stringCommand")),
        "Command": split_by_delimiter(row.get("Command")),
        "Stance": toArrayOrNone(row.get("Stance")),
        "Properties": toArrayOrNone(row.get("Properties")),
        "HitLevel": split_by_delimiter(row.get("Hit level")),
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

print("Exporting per-character move data to JSON files...")
# Per-character files
for c in characters_manifest:
    cid = c["id"]
    cname = c["name"]
    moves_df = frameData[frameData["Character"] == cname]
    moves_list = [move_row_to_dict(row) for _, row in moves_df.iterrows()]
    with open(moves_dir / f"{cid}.json", "w", encoding="utf-8") as f:
        json.dump(moves_list, f, ensure_ascii=False, indent=2)


print("Soulcalibur6 frame data export complete.")
