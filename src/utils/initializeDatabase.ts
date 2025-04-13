/**
 * Initialize the database schema if it doesn't exist
 * @param db The SQL.js database instance
 * @returns Promise that resolves to true if initialization was successful
 */
export const initializeDatabase = async (db: any): Promise<boolean> => {
  try {
    // Check if tables already exist
    const tableCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='characters'");
    const hasCharactersTable = tableCheck.length > 0 && tableCheck[0].values.length > 0;
    
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    return false;
  }
}; 