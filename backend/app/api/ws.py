"""WebSocket endpoint for real-time optimization progress.

Broadcasts events to connected clients during optimization and
simulation runs. Events include:
- optimization_start: Solver begins
- route_update: A vehicle's route is computed
- optimization_complete: All routes finalized
- simulation_progress: Monte Carlo run N of M
"""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger(__name__)

router = APIRouter()

# Active WebSocket connections
_connections: set[WebSocket] = set()


@router.websocket("/ws/live")
async def websocket_live(websocket: WebSocket) -> None:
    """WebSocket endpoint for live optimization updates."""
    await websocket.accept()
    _connections.add(websocket)
    logger.info("WebSocket client connected (%d total)", len(_connections))

    try:
        while True:
            # Keep connection alive, receive pings/messages
            data = await websocket.receive_text()
            # Echo back as acknowledgment
            await websocket.send_json({"type": "ack", "data": data})
    except WebSocketDisconnect:
        _connections.discard(websocket)
        logger.info("WebSocket client disconnected (%d remaining)", len(_connections))


async def broadcast(event_type: str, data: dict[str, Any]) -> None:
    """Broadcast an event to all connected WebSocket clients."""
    if not _connections:
        return

    message = json.dumps({"type": event_type, "data": data})
    dead: set[WebSocket] = set()

    for ws in _connections:
        try:
            await ws.send_text(message)
        except Exception:
            dead.add(ws)

    # Mutate in place; rebinding (`-=`) would shadow the module global and
    # raise UnboundLocalError on the read above.
    _connections.difference_update(dead)
