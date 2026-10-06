# backend/app/services/receipt_ai/claude.py

import logging

import anthropic

from app.config.settings import settings
from app.services.receipt_ai.base import ExtractionError, ExtractionResult, ReceiptExtractor
from app.services.receipt_ai.prompt import SYSTEM_PROMPT, user_text
from app.services.receipt_ai.schema import ReceiptExtraction

logger = logging.getLogger(__name__)

# Models without adaptive thinking / effort (older generations) get a plain request
_NO_THINKING_PREFIXES = ("claude-haiku-4", "claude-3")
# Server-side fallback when Opus 5's safety classifier declines (rare for receipts)
_FALLBACK_MODELS = {"claude-opus-5"}
_FALLBACK_BETA = "server-side-fallback-2026-07-01"


class ClaudeExtractor(ReceiptExtractor):
    provider = "anthropic"

    async def extract(self, images, note, model, api_key) -> ExtractionResult:
        client = anthropic.AsyncAnthropic(api_key=api_key, timeout=settings.RECEIPT_AI_TIMEOUT_SECONDS, max_retries=2)
        content = [
            {"type": "image", "source": {"type": "base64", "media_type": media_type, "data": data}}
            for media_type, data in images
        ]
        content.append({"type": "text", "text": user_text(note, len(images))})

        kwargs: dict = {}
        if not model.startswith(_NO_THINKING_PREFIXES):
            kwargs["thinking"] = {"type": "adaptive"}
            kwargs["output_config"] = {"effort": "high"}
        if model in _FALLBACK_MODELS:
            kwargs["betas"] = [_FALLBACK_BETA]
            kwargs["fallbacks"] = "default"

        try:
            response = await client.beta.messages.parse(
                model=model,
                max_tokens=16000,
                system=[{"type": "text", "text": SYSTEM_PROMPT, "cache_control": {"type": "ephemeral"}}],
                messages=[{"role": "user", "content": content}],
                output_format=ReceiptExtraction,
                **kwargs,
            )
        except anthropic.AuthenticationError:
            raise ExtractionError("The Claude API key was rejected")
        except anthropic.PermissionDeniedError:
            raise ExtractionError("This Claude API key can't use that model")
        except anthropic.RateLimitError:
            raise ExtractionError("Claude is busy or the key is out of credit. Try again in a minute")
        except anthropic.APITimeoutError:
            raise ExtractionError("Reading the receipt took too long. Try again")
        except anthropic.APIStatusError as e:
            logger.warning("Claude receipt scan failed: %s %s", e.status_code, getattr(e, "message", ""))
            raise ExtractionError("Claude couldn't read this receipt right now")
        except anthropic.APIConnectionError:
            raise ExtractionError("Couldn't reach Claude. Try again")

        if response.stop_reason == "refusal":
            raise ExtractionError("Claude declined to read this image")
        if response.stop_reason == "max_tokens" or response.parsed_output is None:
            raise ExtractionError("The receipt was too long to read in one go")

        usage = response.usage
        return ExtractionResult(
            data=response.parsed_output,
            model=response.model,
            usage={
                "input_tokens": usage.input_tokens,
                "output_tokens": usage.output_tokens,
                "cache_read_input_tokens": getattr(usage, "cache_read_input_tokens", None),
            },
        )
