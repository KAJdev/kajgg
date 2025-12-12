# kaj.gg

this is a little collection of services that make up https://kaj.gg

getting this up and running yourself should honestly be pretty straightforward.

## Prerequisites

You'll need docker installed, and if you want to run the chat client you'll need a javascript runtime & package manager of your choice (I use nodejs + npm).

## getting Started

cloe the repo

```
git clone https://github.com/KAJdev/kajgg
```

start the backend services

this will start:

- mongodb database with a volume
- redis instance with a volume
- build & run an api service (/api)
- build & run a gateway service (/gateway)
- build & run a treafik reverse proxy

```
cd kajgg && docker compose up --build
```

start the web client

```
cd kajgg/chat-web && npm i && npm run dev
```

## How it works

### API

All API nodes are built using the `chat-api` service. This is the main CRUD interface for clients, and allows bulk resource fetching. All API nodes maintain connections to mongodb for obvious reasons & redis for writing to the event stream.

### Gateway

In order to recieve realtime events, clients must connect to a gateway node. Gateway nodes are also built using `chat-api` but only register the `/gateway` route. This way types, db models, and helper methods can be shared between the services without much hassle. The `/gateway` endpoint is an SSE endpoint. This means its essentially a normal HTTP endpoint, but connections are held open indefinitely. it returns `content-type: text/event-stream` and will stream data in the form of SSE events.

An SSE event looks like this:

```
data: {...}
error: {...}

```

So, for something like a `MESSAGE_CREATED` event, it would look something like this:

```
data: {"t":"MESSAGE_CREATED","d":{"message":{"id":"ah37oko1se","type":"default","author_id":"a4o8qlcjv1","channel_id":"sly8lpn7ro","created_at":"2025-12-12T09:05:05.344000Z","content":"test","nonce":"9b084170-d899-48d3-a257-1911ca59a99c","updated_at":null,"files":[]},"author":{"id":"a4o8qlcjv1","username":"kaj","status":"online","avatar_url":null,"bio":null,"created_at":"2025-12-11T03:23:04.445000Z","updated_at":"2025-12-11T03:23:04.445000Z"}},"ts":"1765530305366"}

```

Most notably, You will see the base Event payload looks like:

```json
{
  "t": "",
  "d": {},
  "ts": 1234
}
```

`t` is the `EventType`. You can see a full list in the events type definition [`typegen/types/events.toml`](https://github.com/KAJdev/kajgg/blob/main/typegen/types/events.toml)

`d` is an event object, which holds various other nested data types. see the definition above for an exhaustive list

`ts` is the timestamp of the event. This is important, since the connection is not very durable for any number of reasons (gateway node going poof, cloudflare proxy deciding it doesn't like you, etc.) clients will have to reconnect periodically. This means there's a few milliseconds where the client no longer will recieve events. This isn't an issue though, since you can provide this timestamp when you do reconnect (`/gateway?last_event_ts=...`) and that gateway node will replay the events you missed.
