import os

from dotenv import load_dotenv


load_dotenv()


def get_env(name: str, default: str | None = None) -> str | None:
    value = os.getenv(name)
    if value is None or value.strip() == "":
        return default
    return value


GEMINI_API_KEY = get_env("GEMINI_API_KEY") or get_env("API_KEY")
GEMINI_MODEL = get_env("GEMINI_MODEL", "models/gemini-flash-latest")
# google-generativeai embed_content commonly expects a "models/..." name.
# This default is widely available across accounts/regions.
GEMINI_EMBED_MODEL = get_env("GEMINI_EMBED_MODEL", "models/gemini-embedding-001")

FAISS_DIR = get_env("FAISS_DIR", os.path.join("data", "faiss_index"))
CHUNK_SIZE = int(get_env("CHUNK_SIZE", "500") or "500")
CHUNK_OVERLAP = int(get_env("CHUNK_OVERLAP", "50") or "50")
TOP_K = int(get_env("TOP_K", "3") or "3")
