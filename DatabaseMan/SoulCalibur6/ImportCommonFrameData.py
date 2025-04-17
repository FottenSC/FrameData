
import pandas as pd
import sqlite3

import sys
import re

dbName = "FrameData.db"
con = sqlite3.connect(sys.path[0] + "\\" + dbName)
cur = con.cursor()



# Test connection
# res = cur.execute("SELECT ID, Name FROM Characters")
# test = res.fetchone()
# print(test)


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

# Uppercase Character
frameData["Character"] = frameData["Character"].apply(
    lambda x: x[0].upper() + x[1:]
)

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

frameData["DamageDec"] = frameData["Damage"].apply(
    lambda x: sumAndCleanDamage(x)
)

# Create Block decimal
def cleanUpBlock(block):
    blockClean = re.findall(r'[-+]?\d+', str(block))

    if(len(blockClean) == 0):
        return None
    else:
        return int(blockClean[0])

frameData["BlockDec"] = frameData["Block"].apply(
    lambda x: cleanUpBlock(x)
)


# Create Hit decimal
def cleanUpHit(hit):
    hitClean = re.findall(r'[-+]?\d+', str(hit))

    if(len(hitClean) == 0):
        return None
    else:
        return int(hitClean[0])

frameData["HitDec"] = frameData["Hit"].apply(
    lambda x: cleanUpHit(x)
)


# Create CounterHit decimal
def cleanUpCounterHit(ch):
    if(str(ch) in ["LNC, STN (2nd)"]):
        return None
    

    chClean = re.findall(r'[-+]?\d+', str(ch))
    if(len(chClean) == 0):
        return None
    else:
        return int(chClean[0])

frameData["CounterHitDec"] = frameData["Counter Hit"].apply(
    lambda x: cleanUpCounterHit(x)
)


# print(frameData.head(250))
# # Insert the DataFrame into the SQLite database
frameData.to_sql(
    name = 'UnicornData', 
    con = con, 
    if_exists='replace', 
    index = False
)


# update Inputs table
if(1 == 1):
    # Split commands into seperate table
    commands = []
    for index, row in frameData.iterrows():
        if(str(row["Command"]) == "nan"):
            pass
        else:
            buttons = re.findall(r':([^:]+)', row["Command"])
            sortOrder = 0
            for buttonIndex, button in enumerate(buttons):
                if(button == "_"):
                    sortOrder -= 1
                else:
                    commands.append({
                        "MoveID": row["ID"], 
                        "SortOrder": sortOrder,
                        "Command": button
                    })
                    sortOrder += 1

    commands = pd.DataFrame.from_dict(commands) 

    # Create command table
    commands.to_sql(
        name = 'Inputs', 
        con = con, 
        if_exists='replace', 
        index = False
    )


# Create stance list 
# TODO : Add priority for splitting stances
if(1 == 1):
    stances = []
    for index, row in frameData.iterrows():
        if(str(row["Stance"]) == "nan"):
            pass
        else:
            stances.append({
                "MoveID": row["ID"], 
                "Stance": row["Stance"]
            })

    stances = pd.DataFrame.from_dict(stances) 

    # Create command table
    stances.to_sql(
        name = 'MovesStances', 
        con = con, 
        if_exists='replace', 
        index = False
    )




# Create schema
with open('DatabaseMan/SoulCalibur6/schema.sql', 'r') as schemaFile:
    schemaSQL = schemaFile.read()
cur.executescript(schemaSQL)
print("Created database schema")



# Post process
with open('DatabaseMan/SoulCalibur6/PostProcess.sql', 'r') as postProcessFile:
    postProcessSQL = postProcessFile.read()
print("Started post process")
cur.executescript(postProcessSQL)
print("Finished post processing")


# Commit the changes and close the connection
con.commit()
con.close()

