
INSERT INTO Characters(Name)
SELECT DISTINCT OA.CapName
FROM (
	SELECT UD.*,
		CONCAT(
			UPPER(SUBSTRING(UD.Character, 1, 1)),
			LOWER(SUBSTRING(UD.Character, 2, LENGTH(UD.Character)))
		) AS capName
	FROM UnicornData AS UD
) AS OA
WHERE
	NOT EXISTS(
		SELECT *
		FROM Characters AS C
		WHERE C.Name = OA.CapName
	)
