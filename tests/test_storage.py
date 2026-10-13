"""Database failures become one sentence, with the real error kept as the cause."""

from __future__ import annotations

from unittest.mock import MagicMock

import pytest

from agent.errors import StorageError
from agent.schemas import UserProfile
from agent.session import Session, SessionStore


def test_session_save_hides_the_database_error() -> None:
    store = SessionStore.__new__(SessionStore)
    store._client = MagicMock()
    store._client.table.return_value.upsert.return_value.execute.side_effect = (
        RuntimeError("supabase password leaked")
    )
    session = Session(profile=UserProfile(goal="maintain", calorie_target=2000))

    with pytest.raises(StorageError) as caught:
        store.save("abc", session)

    assert caught.value.detail == StorageError.LOAD
    assert caught.value.status_code == 503
    assert "leaked" not in caught.value.detail
    assert isinstance(caught.value.__cause__, RuntimeError)
