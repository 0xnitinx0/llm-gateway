from app.config import Settings
from providers.cerebras_provider import CerebrasProvider
from providers.gemini_provider import GeminiProvider
from providers.groq_provider import GroqProvider
from providers.local_provider import LocalFakeProvider


def build_provider_registry(settings: Settings, token_counter):
    local = LocalFakeProvider("balanced", token_counter, settings.local_token_delay_ms)
    return {
        "local": local,
        "gemini": GeminiProvider(settings.gemini_model),
        "groq": GroqProvider(settings.groq_model),
        "cerebras": CerebrasProvider(settings.cerebras_model),
        "local-concise": LocalFakeProvider("concise", token_counter, settings.local_token_delay_ms),
        "local-analytical": LocalFakeProvider("analytical", token_counter, settings.local_token_delay_ms),
        "local-practical": LocalFakeProvider("practical", token_counter, settings.local_token_delay_ms),
        "local-judge": LocalFakeProvider("judge", token_counter, 0),
    }
