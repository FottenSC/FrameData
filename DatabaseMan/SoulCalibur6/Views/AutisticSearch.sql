SELECT 
    UD.Command,
    Input.Command
FROM UnicornData AS UD
INNER JOIN (
	SELECT 
		I.MoveID, 
		group_concat(I.Command,'') as Command
	FROM Inputs AS I
	WHERE 
		EXISTS(
			SELECT *
			FROM Inputs AS I2
			WHERE 
				I2.MoveID = I.MoveID
				--AND (
				--	(I2.SortOrder = 0 AND I2.Command = '2')
				--	OR (I2.SortOrder = 1 AND I2.Command = '3')
				--	OR (I2.SortOrder = 2 AND I2.Command = '6')
				--)
			GROUP BY MoveID
			--HAVING COUNT(*) = 3 --Count of searches
		)
	GROUP BY MoveID
) AS Input
	ON Input.MoveID = UD.ID

