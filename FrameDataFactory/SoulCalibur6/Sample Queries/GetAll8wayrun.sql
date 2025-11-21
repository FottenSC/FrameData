

SELECT MoveID, group_concat(Command)
FROM Inputs AS I
WHERE 
	EXISTS(
		SELECT *
		FROM Inputs AS I2
		WHERE 
			I2.MoveID = I.MoveID
		GROUP BY MoveID, SortOrder
		HAVING COUNT(*) > 1
	)
GROUP BY MoveID


