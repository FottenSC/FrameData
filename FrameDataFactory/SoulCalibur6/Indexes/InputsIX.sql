
CREATE INDEX MoveID_IX ON Inputs(MoveID)
CREATE INDEX MoveIDSortOrder_IX ON Inputs(MoveID,SortOrder)
CREATE INDEX MoveIDSortOrderCommand_IX ON Inputs(MoveID,SortOrder, Command)