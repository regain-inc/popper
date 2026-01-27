import { createDB } from '@popper/db';

const DATABASE_URL = process.env.DATABASE_URL || 'postgres://localhost:5432/popper';

export const db = createDB(DATABASE_URL);
