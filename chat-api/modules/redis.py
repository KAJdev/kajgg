from os import getenv
import redis.asyncio as redis
from redis.exceptions import ResponseError
from redis.commands.search.indexDefinition import IndexDefinition, IndexType
from redis.commands.search.query import Query
from redis.commands.search.field import TextField, VectorField
from modules.utils import print
import aiohttp

client = None

# fields
id = TextField("id")
type = TextField("type")
embeddings = VectorField(
    "embeddings",
    "FLAT",
    {
        "TYPE": "FLOAT32",
        "DIM": 1024,
        "DISTANCE_METRIC": "COSINE",
    },
)

fields = [id, type, embeddings]


async def create_fields():
    if not client:
        return

    try:
        await client.ft(f"embeddings-{getenv('ENV')}").info()
        print("Index exists", important=True)
    except ResponseError:
        print("Creating index", important=True)
        await client.ft(f"embeddings-{getenv('ENV')}").create_index(
            fields=fields,
            definition=IndexDefinition(
                prefix=[f"{getenv('ENV')}-doc"], index_type=IndexType.HASH
            ),
        )


async def store_embeddings(id: str, type: str, embeddings: bytes):
    await client.hset(
        f"{getenv('ENV')}-doc:{id}",
        mapping={"id": id, "type": type, "embeddings": embeddings},
    )


async def delete_embeddings(id: str):
    await client.delete(f"{getenv('ENV')}-doc:{id}")


async def knn(
    query: str,
    k: int,
    vector_field: str,
    embedded_query: bytes,
) -> list[tuple[str, float]]:
    if not embedded_query:
        return []

    base_query = f"*=>[KNN {k} @{vector_field} $vector AS vector_score]"

    query = (
        Query(base_query)
        .return_fields("id", "vector_score")
        .sort_by("vector_score")
        .paging(0, k)
        .dialect(2)
    )

    results = await client.ft(f"embeddings-{getenv('ENV')}").search(
        query, {"vector": embedded_query}
    )

    return [(result.id.split(":")[-1], result.vector_score) for result in results.docs]


async def embedding_api(query: str, k: int = 20) -> list[tuple[str, float]]:
    async with aiohttp.ClientSession() as session:
        async with session.get(
            f"{getenv('EMBEDDING_URL')}/v1/embeddings?q={query}&k={k}&env={getenv('ENV')}"
        ) as resp:
            if resp.status != 200:
                print(f"Failed to get embeddings: {await resp.text()}", important=True)
                return []

            data = await resp.json()

    return data.get("results", [])


async def search_panels(query: str, k: int = 20) -> list[tuple[str, float]]:
    return await embedding_api(
        f"Represent this sentence for searching relevant passages: {query}", k
    )


async def get_similar_panels(id: str, url: str, k: int = 50) -> list[tuple[str, float]]:
    panel = await client.hgetall(f"{getenv('ENV')}-doc:{id}")

    if not panel:
        return []

    clip_embeddings = panel.get(b"clip_embeddings")
    if not clip_embeddings:
        return []

    panels = await knn(None, k + 1, "clip_embeddings", "image", clip_embeddings)
    return [p for p in panels if p[0] != id][:k]


async def reconfigure_index():
    await client.ft(f"embeddings-{getenv('ENV')}").dropindex(delete_documents=False)
    await create_fields()


async def publish(channel: str, message: str):
    return await client.publish(channel, message)


async def init():
    global client
    client = redis.from_url(getenv("REDIS_URL"))
    print("Connected to Redis", important=True)

    await create_fields()
