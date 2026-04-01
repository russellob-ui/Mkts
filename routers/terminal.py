"""
WebSocket endpoint for remote terminal access.

Spawns a PTY shell and pipes stdin/stdout over WebSocket,
enabling browser-based terminal control via xterm.js.
"""

import asyncio
import fcntl
import logging
import os
import pty
import select
import signal
import struct
import termios
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = logging.getLogger(__name__)


class TerminalSession:
    """Manages a single PTY session connected to a WebSocket."""

    def __init__(self, ws: WebSocket):
        self.ws = ws
        self.fd: Optional[int] = None
        self.pid: Optional[int] = None

    async def start(self) -> None:
        await self.ws.accept()

        # Spawn a shell in a PTY
        pid, fd = pty.openpty()
        self.pid = os.fork()

        if self.pid == 0:
            # Child process — become the shell
            os.close(pid)
            os.setsid()
            os.dup2(fd, 0)
            os.dup2(fd, 1)
            os.dup2(fd, 2)
            if fd > 2:
                os.close(fd)

            shell = os.environ.get("SHELL", "/bin/bash")
            os.execvp(shell, [shell, "--login"])
        else:
            # Parent process
            os.close(fd)
            self.fd = pid

            # Set non-blocking
            flags = fcntl.fcntl(self.fd, fcntl.F_GETFL)
            fcntl.fcntl(self.fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

            # Run read/write loops concurrently
            read_task = asyncio.create_task(self._read_loop())
            write_task = asyncio.create_task(self._write_loop())

            try:
                await asyncio.gather(read_task, write_task)
            except (WebSocketDisconnect, Exception):
                read_task.cancel()
                write_task.cancel()
            finally:
                self.cleanup()

    async def _read_loop(self) -> None:
        """Read PTY output and send to WebSocket."""
        loop = asyncio.get_event_loop()
        while True:
            try:
                data = await loop.run_in_executor(None, self._blocking_read)
                if data:
                    await self.ws.send_bytes(data)
                else:
                    # PTY closed
                    break
            except (OSError, WebSocketDisconnect):
                break

    def _blocking_read(self) -> Optional[bytes]:
        """Blocking read from PTY fd (runs in thread)."""
        try:
            r, _, _ = select.select([self.fd], [], [], 0.1)
            if r:
                return os.read(self.fd, 4096)
            return b""
        except OSError:
            return None

    async def _write_loop(self) -> None:
        """Read WebSocket input and write to PTY."""
        while True:
            try:
                msg = await self.ws.receive()

                if msg["type"] == "websocket.disconnect":
                    break

                if "text" in msg:
                    text = msg["text"]
                    # Handle resize messages: \x1b[R<rows>;<cols>
                    if text.startswith("\x1b[R"):
                        self._handle_resize(text[3:])
                    else:
                        os.write(self.fd, text.encode("utf-8", errors="replace"))
                elif "bytes" in msg:
                    os.write(self.fd, msg["bytes"])

            except (WebSocketDisconnect, Exception):
                break

    def _handle_resize(self, size_str: str) -> None:
        """Resize the PTY to match the client terminal size."""
        try:
            rows, cols = size_str.split(";")
            rows, cols = int(rows), int(cols)
            winsize = struct.pack("HHHH", rows, cols, 0, 0)
            fcntl.ioctl(self.fd, termios.TIOCSWINSZ, winsize)
            # Signal the shell about the resize
            os.kill(self.pid, signal.SIGWINCH)
        except (ValueError, OSError) as e:
            logger.debug("Resize failed: %s", e)

    def cleanup(self) -> None:
        """Close PTY and kill the shell process."""
        if self.fd is not None:
            try:
                os.close(self.fd)
            except OSError:
                pass
            self.fd = None

        if self.pid is not None:
            try:
                os.kill(self.pid, signal.SIGTERM)
                os.waitpid(self.pid, os.WNOHANG)
            except (OSError, ChildProcessError):
                pass
            self.pid = None


@router.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    session = TerminalSession(websocket)
    try:
        await session.start()
    except Exception as e:
        logger.error("Terminal session error: %s", e)
        session.cleanup()
