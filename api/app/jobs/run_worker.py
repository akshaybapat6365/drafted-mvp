from __future__ import annotations

from ..db import init_db
from .worker import worker_loop


def main() -> None:
    init_db()
    worker_loop()


if __name__ == "__main__":
    main()
