import { createApp } from './app.js';

const { httpServer } = createApp();

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
