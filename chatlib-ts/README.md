## chatlib-ts (kaj.gg)

### install

```bash
npm i kajgg-chatlib
```

### quickstart

```js
const { Client, Events } = require("kajgg-chatlib");

const client = new Client({
  baseUrl: "http://localhost:8080",
});

client.once(Events.ClientReady, (readyClient) => {
  console.log("ready");
});

client.on(Events.MessageCreated, async (ctx) => {
  await ctx.send("yo");
});

// either pass a token string, or pass username/password
client.login({ username: "username", password: "password" });
```
