import { migrate } from "./db/prisma";
import { createApp } from "./app";

migrate();
const app = createApp();
const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => console.log(`Clawkpit running on :${port}`));
