"""
Token Slim MCP Server — Exposes prompt optimization tools via MCP.
Run: python3 mcp_server.py
"""

import time
from fastmcp import FastMCP

mcp = FastMCP("Token Slim")

_compressor = None


def _get_compressor():
    global _compressor
    if _compressor is None:
        from llmlingua import PromptCompressor
        _compressor = PromptCompressor(
            model_name="microsoft/llmlingua-2-bert-base-multilingual-cased-meetingbank",
            use_llmlingua2=True,
        )
    return _compressor


@mcp.tool()
def compress_prompt(text: str, rate: float = 0.5) -> dict:
    """Compress a prompt using LLMLingua-2 to reduce token count."""
    if not text.strip():
        return {"error": "Empty text"}

    compressor = _get_compressor()
    t = time.time()
    result = compressor.compress_prompt(text, rate=rate, force_tokens=["\n", "?", "!", "."])

    saved = result["origin_tokens"] - result["compressed_tokens"]
    return {
        "compressed_text": result["compressed_prompt"],
        "original_tokens": result["origin_tokens"],
        "compressed_tokens": result["compressed_tokens"],
        "ratio": f"{round(result['ratio'], 2)}x",
        "tokens_saved": saved,
        "time_ms": round((time.time() - t) * 1000),
    }


@mcp.tool()
def estimate_tokens(text: str) -> dict:
    """Estimate token count of a text (rough: max of words vs chars/4)."""
    words = len(text.split())
    return {
        "estimated_tokens": max(words, len(text) // 4),
        "words": words,
        "characters": len(text),
    }


if __name__ == "__main__":
    mcp.run()
