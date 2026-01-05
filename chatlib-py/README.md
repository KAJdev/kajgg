## kajgg python client

### install

```bash
uv add kajgg-chatlib
```

### quickstart

```py
import asyncio

from kajgg import listen, EventType, run
from kajgg.events import MessageCreated


@listen(EventType.MESSAGE_CREATED)
async def on_message_created(ctx: MessageCreated):
    await ctx.send("a response in the same channel")


asyncio.run(run("username", "password"))
```
