from fastapi import APIRouter
from fastapi.responses import PlainTextResponse

from ..cscli import run_cscli

router = APIRouter(prefix="/allowlists/check", tags=["Allowlists"])


@router.get("/{ip}")
async def check_allowlist(ip: str):
    stdout = await run_cscli("allowlists", "check", ip)

    # Thuần text, giữ nguyên output mặc định của cscli
    return PlainTextResponse(stdout.decode().strip())