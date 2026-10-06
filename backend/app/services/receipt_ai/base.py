# backend/app/services/receipt_ai/base.py

from dataclasses import dataclass, field

from app.services.receipt_ai.schema import ReceiptExtraction


class ExtractionError(Exception):
    """A scan failed; the message is safe to show to the person."""


@dataclass
class ExtractionResult:
    data: ReceiptExtraction
    model: str
    usage: dict = field(default_factory=dict)


class ReceiptExtractor:
    provider = ""

    async def extract(self, images: list[tuple[str, str]], note: str | None, model: str, api_key: str) -> ExtractionResult:
        raise NotImplementedError
