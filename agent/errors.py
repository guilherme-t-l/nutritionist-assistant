# Sentences the page is allowed to show, plus the database-failure type.
#
# Routes and stores raise these. src/app/main.py turns them into JSON.
# The original exception stays attached with `raise ... from exc` so the
# server log still has the real reason.

from __future__ import annotations

import functools
from collections.abc import Callable
from typing import TypeVar


# The model replied, but the JSON was not a meal plan. Same sentence for
# chat, a new plan, and import — the log has the validation detail.
INVALID_PLAN = "Gemini returned a plan I couldn't use. Try again."

EXPIRED_SESSION = "This chat expired. Start a new plan."
NO_PLAN_TO_EDIT = "There's no plan to edit yet. Build one first."
NO_PLAN_TO_SAVE = "There's no plan to save yet."
SIGN_IN_TO_SAVE = "Sign in again to save this."

UNEXPECTED = "Something went wrong. Try again."


F = TypeVar("F", bound=Callable)


class StorageError(Exception):
    """Supabase (or a missing database setting) failed.

    The default sentence is for reads and ordinary saves. After the coach
    has already answered, the route raises this again with AFTER_COACH so
    the person knows the reply was not stored.
    """

    LOAD = "Couldn't load your plan. Try again in a moment."
    AFTER_COACH = "The coach answered, but I couldn't save it. Send that again."

    def __init__(self, detail: str = LOAD) -> None:
        self.status_code = 503
        self.detail = detail
        super().__init__(detail)


def guard_storage(method: F) -> F:
    """Turn any database failure into StorageError.

    This is a decorator (Chapter 5): it wraps a function and runs extra
    code around the call. StorageError is let through so a second wrap
    does not hide the original cause.
    """

    @functools.wraps(method)
    def wrapped(*args, **kwargs):
        try:
            return method(*args, **kwargs)
        except StorageError:
            raise
        except Exception as exc:
            raise StorageError() from exc

    return wrapped  # type: ignore[return-value]
