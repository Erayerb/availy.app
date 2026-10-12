import pytest

from app.occupancy import AreaOccupancy, Level, average_occupancy
from app.venues import escape_like, parse_tags


def test_parse_tags_empty_means_no_filter():
    assert parse_tags(None) == []
    assert parse_tags("") == []


def test_parse_tags_dedupes_and_trims():
    assert parse_tags(" quiet,coworking,quiet ") == ["coworking", "quiet"]


def test_parse_tags_rejects_unknown():
    with pytest.raises(ValueError, match="party"):
        parse_tags("quiet,party")


def test_average_occupancy():
    assert average_occupancy([0.2, 0.5, 0.9]) == AreaOccupancy(level=Level.MEDIUM, ratio=0.53)
    assert average_occupancy([0.9, 0.8]).level == Level.HIGH


def test_average_occupancy_requires_values():
    with pytest.raises(ValueError):
        average_occupancy([])


def test_escape_like():
    assert escape_like("50%_off\\") == "50\\%\\_off\\\\"
    assert escape_like("Kafe") == "Kafe"
