CREATE TABLE "Moves" (
	"MoveID"	INTEGER NOT NULL UNIQUE,
	"Character"	TEXT NOT NULL,
	"MoveCategory"	TEXT NOT NULL,
	"MoveName"	TEXT NOT NULL,
	"Stance"	TEXT,
	"Command"	TEXT NOT NULL,
	"HitLevel"	TEXT,
	"Impact"	INTEGER NOT NULL,
	"Damage"	TEXT NOT NULL,
	"Block"	TEXT,
	"Hit"	TEXT,
	"CounterHit"	TEXT,
	"GuardBurst"	TEXT,
	"Notes"	TEXT,
	PRIMARY KEY("MoveID" AUTOINCREMENT)
)