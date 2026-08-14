import asyncio
from fastapi import HTTPException


async def run_cscli(*args):
    process = await asyncio.create_subprocess_exec(
        "cscli", *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout, stderr = await process.communicate()
    if process.returncode != 0:
        raise HTTPException(status_code=500, detail=stderr.decode())
    return stdout