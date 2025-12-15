import aiohttp, asyncio, uuid

token = "YTRvOHFsY2p2MQ==.MTc2NTQyMzM4NA.a61xlk9s8x"

max_workers = asyncio.Semaphore(1)
channel_id = "kfc7gsl64w"
count = 0


async def send_message():
    global count
    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                f"https://chat.kaj.gg/api/v1/channels/{channel_id}/messages",
                headers={"Authorization": token},
                json={"content": str(count)},
            ) as response:
                j = await response.json()
                count += 1
                if "id" in j:
                    print(f"Message sent: {j['id']}")
                else:
                    print(f"Error sending message: {j}")
    except Exception as e:
        print(f"Error sending message: {e}")
    finally:
        max_workers.release()


async def main():
    while True:
        await max_workers.acquire()
        asyncio.create_task(send_message())


asyncio.run(main())
