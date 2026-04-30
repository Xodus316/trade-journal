import 'dotenv/config';

import { createApp } from './lib/create-app.js';
import { ensureSchema } from './lib/migrations.js';

const port = Number(process.env.API_PORT ?? 4000);
const app = createApp();

await ensureSchema();

app.listen(port, () => {
  console.log(`trade-journal api listening on ${port}`);
});
