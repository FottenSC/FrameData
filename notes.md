



new structure


Transformers:{
    //functions that transform input, 236B = AGS B / 236236B = TAS
}

FilterFunctions{
    List of filter functions
}


// Badge collections?
CaliburBadges???
BaseBadges: {
    "H": {
        Width: 123
        "BackgroundColor": #123
        "FontColor": #fff
    }
}


Json files???
Games [{
    Game SC6
        Name,
        Abbr,
        Transformers:{
            Which functions this game uses?
        },
        Credits // who provided the data 
        Characters[{
            "Name":"Astaroth",
            "DisplayName": "Astaroth"
            "ID": ""
        }]
        Data
            Avaliable columns? 
                Base ColName
                Int ColName
                Applicable Filter Functions
            Data
                Location???
}]

Data
    Character,
    Stance, Command, HitLevel,
    Impact,
    ActiveFrames, RecoveryFrames,
    Hit, Block, Damage,
    CounterHit, GuardDamage, 
    Notes,
    Tags?
        Cancelable
        Unblockable


User Settings
    Table Layout dream

Routing?
    CurrentGame Abbr
    CurrentCharacter? fullName



Features:
Sorting on all columns 
    breaking columns into multiple 

Link to specific move
    framedata.horseface.no/sc6/Astaroth/214A?
    framedata.horseface.no/sc6/Astaroth/{moveID}
    framedata.horseface.no/{gameAbbr}/{Character}/{moveID}