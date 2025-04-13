import React, { useState, useEffect } from 'react';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { initializeDatabase } from '../utils/initializeDatabase';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import { Button } from './ui/button';

// Using the SQL.js loaded via CDN
declare global {
  interface Window {
    initSqlJs: () => Promise<any>;
  }
}

// Define your data type
type MoveData = {
  id: number;
  character_id: number;
  command: string;
  stance: string | null;
  hit_level: number;
  impact: number;
  damage: number | null;
  block: number | null;
  hit: number | null;
  counter_hit: number | null;
  guard_burst: number | null;
  notes: string | null;
};

const columnHelper = createColumnHelper<MoveData>();

const columns = [
  columnHelper.accessor('command', {
    header: 'Command',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('hit_level', {
    header: 'Hit Level',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('impact', {
    header: 'Impact',
    cell: info => info.getValue(),
  }),
  columnHelper.accessor('damage', {
    header: 'Damage',
    cell: info => info.getValue() || '-',
  }),
  columnHelper.accessor('block', {
    header: 'Block',
    cell: info => info.getValue() || '-',
  }),
  columnHelper.accessor('hit', {
    header: 'Hit',
    cell: info => info.getValue() || '-',
  }),
  columnHelper.accessor('counter_hit', {
    header: 'Counter Hit',
    cell: info => info.getValue() || '-',
  }),
  columnHelper.accessor('guard_burst', {
    header: 'Guard Burst',
    cell: info => info.getValue() || '-',
  }),
  columnHelper.accessor('notes', {
    header: 'Notes',
    cell: info => info.getValue() || '-',
  }),
];

export default function DataTable() {
  const [data, setData] = useState<MoveData[]>([]);
  const [db, setDb] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tables, setTables] = useState<string[]>([]);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    // Initialize SQL.js
    const initDb = async () => {
      try {
        // Use the globally available SQL.js instance
        const SQL = await window.initSqlJs();
        
        // Check if we can load the existing database
        const response = await fetch('/Framedata.db');
        const arrayBuffer = await response.arrayBuffer();
        const db = new SQL.Database(new Uint8Array(arrayBuffer));
        setDb(db);
        
        // Initialize the database (create tables if they don't exist)
        const success = await initializeDatabase(db);
        setInitialized(success);
        
        if (success) {
        // First, let's check what tables exist in the database
        const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
        if (tablesResult.length > 0) {
            const tableNames = tablesResult[0].values.map((row: any) => String(row[0]));
            setTables(tableNames);
            console.log("Tables in database:", tableNames);
            
            // Query moves for 2B
            const result = db.exec(`
            SELECT m.* 
            FROM moves m
            JOIN characters c ON m.character_id = c.id
            WHERE c.name = '2B'
            `);
            
            if (result.length > 0) {
            const rows = result[0].values.map((row: any[]) => ({
                id: row[0],
                character_id: row[1],
                command: row[2],
                stance: row[3],
                hit_level: row[4],
                impact: row[5],
                damage: row[6],
                block: row[7],
                hit: row[8],
                counter_hit: row[9],
                guard_burst: row[10],
                notes: row[11],
            }));
            setData(rows);
            } else {
            console.log("No moves found for 2B");
            }
        }
        } else {
        setError("Failed to initialize database schema");
        }

      } catch (err) {
        console.error('Error initializing SQL.js:', err);
        setError(err instanceof Error ? err.message : 'Error initializing SQL.js');
      } finally {
        setLoading(false);
      }
    };

    initDb();
  }, []);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  if (error) {
    return (
      <div className="p-4 space-y-4">
        <div className="text-red-500">Error: {error}</div>
        <div>
          <div className="font-bold">Database Status:</div>
          <div>Initialized: {initialized ? 'Yes' : 'No'}</div>
          <div>Tables: {tables.length > 0 ? tables.join(', ') : 'None found'}</div>
        </div>
        {tables.length > 0 && (
          <div>
            <h3 className="font-bold">Available Tables:</h3>
            <ul className="list-disc pl-5 mt-2">
              {tables.map(table => (
                <li key={table}>{table}</li>
              ))}
            </ul>
          </div>
        )}
        <div className="flex gap-4">
          <Button
            variant="default"
            onClick={() => {
              if (db) {
                try {
                  // Try to run a simple query to get the database schema
                  const schema = db.exec("SELECT sql FROM sqlite_master WHERE type='table'");
                  console.log("Database schema:", schema);
                  if (schema.length > 0) {
                    alert(`Database schema found. Check console for details.`);
                  } else {
                    alert("No schema information available.");
                  }
                } catch (err) {
                  console.error("Error getting schema:", err);
                  alert(`Error getting schema: ${err}`);
                }
              }
            }}
          >
            Show Database Schema
          </Button>
          <Button
            variant="default"
            onClick={async () => {
              if (db) {
                try {
                  // Re-initialize the database
                  const success = await initializeDatabase(db);
                  if (success) {
                    alert("Database initialized successfully!");
                    window.location.reload();
                  } else {
                    alert("Failed to initialize database.");
                  }
                } catch (err) {
                  console.error("Error initializing database:", err);
                  alert(`Error initializing database: ${err}`);
                }
              }
            }}
          >
            Reinitialize Database
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">2B Move List</h2>
        <div className="flex items-center gap-2">
          <span>Database Status: {initialized ? '✅ Initialized' : '❌ Not Initialized'}</span>
          <Button 
            variant="outline"
            onClick={() => {
              if (db) {
                const data = db.export();
                const blob = new Blob([data], { type: 'application/octet-stream' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'Framedata.db';
                a.click();
                URL.revokeObjectURL(url);
              }
            }}
          >
            Export Database
          </Button>
        </div>
      </div>

      <div className="border rounded-md">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map(headerGroup => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map(header => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map(row => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map(cell => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
} 